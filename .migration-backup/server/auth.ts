import bcrypt from 'bcrypt';
import { storage, db } from './storage';
import { loginSchema, insertUserSchema, SafeUser, User, clients, teamMembers } from '@shared/schema';
import { and, eq, isNull, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

export type EmailConflictSource = 'user' | 'team_member' | 'client' | 'subcontractor' | 'invitation';

export interface EmailConflict {
  source: EmailConflictSource;
  message: string;
  code: string;
}

const EMAIL_CONFLICT_MESSAGES: Record<EmailConflictSource, { code: string; message: string }> = {
  user: {
    code: 'email_in_use_account',
    message: 'An account with this email already exists. Please log in instead.',
  },
  team_member: {
    code: 'email_in_use_team_member',
    message:
      "This email is already in use by a team member under another business. Please log in or use a different email.",
  },
  subcontractor: {
    code: 'email_in_use_subcontractor',
    message:
      "This email is already in use by a subcontractor under another business. Please log in or use a different email.",
  },
  client: {
    code: 'email_in_use_client',
    message:
      "This email is already in use by a client under another business. Please use a different email.",
  },
  invitation: {
    code: 'email_in_use_invitation',
    message:
      "This email has a pending team invitation. Please accept the invitation from your email, or use a different email.",
  },
};

// Strip fields that must never leave the server (auth secrets, receipt blobs).
// Use on every response that returns a user object to the client.
export function sanitizeUserResponse(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const {
    password,
    emailVerificationToken,
    emailVerificationExpiresAt,
    passwordResetToken,
    passwordResetExpiresAt,
    appleReceiptData,
    ...safe
  } = user;
  return safe;
}

export class AuthService {
  /**
   * Look for a conflicting identity for the given email across users, clients,
   * team_members (including pending invitations and subcontractor roles).
   * Returns null if no conflict.
   */
  static async findEmailConflict(
    rawEmail: string,
    options?: { ignoreInviteToken?: string; inviteTrusted?: boolean },
  ): Promise<EmailConflict | null> {
    const email = rawEmail.toLowerCase().trim();
    if (!email) return null;
    const ignoreInviteToken = options?.ignoreInviteToken?.trim() || null;

    // 1) Existing user account (any auth provider)
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return { source: 'user', ...EMAIL_CONFLICT_MESSAGES.user };
    }

    // Trusted team-invite acceptance: the invite link proves the invitee owns
    // this inbox, so identities under OTHER businesses (a pending invite or a
    // client record that merely shares this email) must NOT block creating
    // their account. An existing USER account (checked above) still blocks.
    if (options?.inviteTrusted) {
      return null;
    }

    // 2) Active team_member rows — pending invites (memberId IS NULL,
    //    inviteStatus = 'pending') or accepted-but-unlinked. Declined/expired
    //    rows are not active and should not block. We treat any row whose
    //    inviteStatus is in ('pending','accepted') as a live identity.
    // SECURITY: this lookup must fail CLOSED — if the DB read errors, we
    // re-throw so the caller returns a controlled 503, never silently
    // permitting an account collision under another business's workspace.
    const teamRows = (await db
      .select({
        id: teamMembers.id,
        inviteStatus: teamMembers.inviteStatus,
        memberId: teamMembers.memberId,
        roleId: teamMembers.roleId,
        inviteToken: teamMembers.inviteToken,
      })
      .from(teamMembers)
      .where(
        and(
          sql`lower(${teamMembers.email}) = ${email}`,
          inArray(teamMembers.inviteStatus, ['pending', 'accepted']),
        ),
      )
      .limit(5)) as Array<{ id: string; inviteStatus: string; memberId: string | null; roleId: string; inviteToken: string | null }>;

    // When the caller is accepting a specific invitation, that exact pending
    // invite is not a conflict with itself — exclude it so the invitee can
    // create their account. Other live invites/identities still block.
    const relevantTeamRows = ignoreInviteToken
      ? teamRows.filter((r) => r.inviteToken !== ignoreInviteToken)
      : teamRows;

    if (relevantTeamRows.length > 0) {
      // Distinguish pending invitations vs. already-accepted team identities.
      const pending = relevantTeamRows.find((r) => r.inviteStatus === 'pending' && !r.memberId);
      if (pending) {
        // Best-effort subcontractor classification using the role name. We avoid
        // an extra join: if any team role lookup fails, fall back to the
        // generic "invitation" message.
        try {
          const { userRoles } = await import('@shared/schema');
          const roleRow = await db
            .select({ name: userRoles.name })
            .from(userRoles)
            .where(eq(userRoles.id, pending.roleId))
            .limit(1);
          if (roleRow[0]?.name && /sub-?contractor/i.test(roleRow[0].name)) {
            return { source: 'subcontractor', ...EMAIL_CONFLICT_MESSAGES.subcontractor };
          }
        } catch {
          // ignore — fall through to invitation message
        }
        return { source: 'invitation', ...EMAIL_CONFLICT_MESSAGES.invitation };
      }
      return { source: 'team_member', ...EMAIL_CONFLICT_MESSAGES.team_member };
    }

    // 3) Clients — owned email collision on a customer record under another
    //    business. We do not block on previously deleted (cascade) clients.
    //    Also fails CLOSED for the same reason as #2.
    const clientRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(${clients.email}) = ${email}`)
      .limit(1);
    if (clientRows.length > 0) {
      return { source: 'client', ...EMAIL_CONFLICT_MESSAGES.client };
    }

    return null;
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    tradeType?: string;
    intendedTier?: string;
    inviteToken?: string;
  }): Promise<{ success: true; user: SafeUser; preVerified?: boolean } | { success: false; error: string; code?: string }> {
    try {
      // Normalize email
      const normalizedEmail = userData.email.toLowerCase().trim();
      
      // Validate input
      const validatedData = insertUserSchema.parse({
        ...userData,
        email: normalizedEmail,
      });

      // Prevent registering demo email in production
      if (process.env.NODE_ENV === 'production' && validatedData.email === 'demo@jobrunner.com.au') {
        return { success: false, error: 'This email address is reserved.' };
      }

      // Ensure required fields are present
      if (!validatedData.email || !validatedData.password) {
        return { success: false, error: 'Email and password are required' };
      }

      if (validatedData.password.length < 8 || !/[A-Z]/.test(validatedData.password) || !/[^A-Za-z0-9]/.test(validatedData.password)) {
        return { success: false, error: 'Password must be at least 8 characters with one uppercase letter and one special character' };
      }

      // Determine whether this is a TRUSTED team-invite acceptance: the token
      // matches a still-pending team_member whose email equals the email being
      // registered. Receiving the invite link at that inbox proves email
      // ownership, so we (a) pre-verify the new account and (b) skip the
      // cross-business identity block — other-business pending invites or
      // client records that merely share this email must NOT prevent the
      // invitee from creating their account. Only an existing USER blocks.
      let inviteTrusted = false;
      if (userData.inviteToken) {
        try {
          const teamMember = await storage.getTeamMemberByInviteToken(userData.inviteToken);
          if (
            teamMember &&
            teamMember.inviteStatus === 'pending' &&
            teamMember.email &&
            teamMember.email.toLowerCase().trim() === validatedData.email
          ) {
            inviteTrusted = true;
          }
        } catch (e) {
          console.error('[auth.register] inviteToken lookup failed:', e);
        }
      }

      // Check if email collides with any existing identity (user, team
      // member, client, subcontractor, pending invitation). Prevents orphan
      // accounts under another business owner's workspace.
      // SECURITY: findEmailConflict fails CLOSED — if any DB read errors we
      // surface a controlled "identity_check_failed" code so the route can
      // return 503 instead of allowing the signup to proceed.
      let conflict: EmailConflict | null = null;
      try {
        conflict = await AuthService.findEmailConflict(validatedData.email, {
          ignoreInviteToken: userData.inviteToken,
          inviteTrusted,
        });
      } catch (lookupErr) {
        console.error('[auth.register] email conflict lookup failed:', lookupErr);
        return {
          success: false,
          error: "We couldn't verify your email right now. Please try again in a moment.",
          code: 'identity_check_failed',
        };
      }
      if (conflict) {
        return { success: false, error: conflict.message, code: conflict.code };
      }

      if (validatedData.username) {
        const existingUsername = await storage.getUserByUsername(validatedData.username);
        if (existingUsername) {
          return { success: false, error: 'Username already taken' };
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(validatedData.password);

      // Trusted invite acceptance proves inbox ownership → pre-verify email.
      const preVerified = inviteTrusted;

      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
        ...(preVerified ? { emailVerified: true } : {}),
      } as any);

      // Note: Welcome email is sent AFTER email verification, not at registration
      // This prevents duplicate emails (verification + welcome at signup)

      // Return user without password
      const { password, ...safeUser } = user;
      return { success: true, user: safeUser, preVerified };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  static async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ success: true; user: SafeUser } | { success: false; error: string }> {
    try {
      const validatedCredentials = loginSchema.parse(credentials);

      const normalizedEmail = validatedCredentials.email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if user is active
      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated. Please contact support.' };
      }

      // Verify password FIRST so we don't leak account existence to attackers
      // via the "please verify your email" branch (B1 — account enumeration).
      // OAuth-only users (no password set) also get the generic error.
      if (!user.password) {
        return { success: false, error: 'Invalid email or password' };
      }
      const isValidPassword = await this.verifyPassword(validatedCredentials.password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Only AFTER credentials are confirmed do we surface verification status.
      const isDemoUser = user.email === 'demo@jobrunner.com.au';
      if (!user.emailVerified && !isDemoUser) {
        return { success: false, error: 'Please verify your email address before logging in. Check your email for verification instructions.' };
      }

      // Return user without password
      const { password, ...safeUser } = user;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  static async getUserById(userId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) return null;

      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async createEmailVerificationToken(userId: string): Promise<string> {
    const token = this.generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRY_HOURS);

    await storage.updateUser(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });

    return token;
  }

  static async verifyEmail(token: string): Promise<{ success: true; user: SafeUser } | { success: false; error: string }> {
    try {
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return { success: false, error: 'Invalid or expired verification token' };
      }

      // Check if token has expired
      if (user.emailVerificationExpiresAt && new Date() > user.emailVerificationExpiresAt) {
        return { success: false, error: 'Verification token has expired. Please request a new one.' };
      }

      // Mark email as verified and clear verification token
      const updatedUser = await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      });

      if (!updatedUser) {
        return { success: false, error: 'Failed to verify email' };
      }

      const { password, ...safeUser } = updatedUser;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, error: 'Email verification failed. Please try again.' };
    }
  }

  static async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (user.emailVerified) {
        return { success: false, error: 'Email is already verified' };
      }

      // Generate new verification token
      await this.createEmailVerificationToken(user.id);

      return { success: true };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { success: false, error: 'Failed to resend verification email' };
    }
  }

  // Password Reset methods
  static async createPasswordResetToken(email: string): Promise<{ success: true; token: string } | { success: false; error: string }> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists - security best practice
        return { success: true, token: '' };
      }

      const token = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

      await storage.updateUser(user.id, {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      });

      return { success: true, token };
    } catch (error) {
      console.error('Create password reset token error:', error);
      return { success: false, error: 'Failed to create password reset token' };
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ success: true } | { success: false; error: string }> {
    try {
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        return { success: false, error: 'Password must be at least 8 characters with one uppercase letter and one special character' };
      }

      const user = await storage.getUserByPasswordResetToken(token);
      if (!user) {
        return { success: false, error: 'Invalid or expired reset token' };
      }

      // Check if token has expired
      if (user.passwordResetExpiresAt && new Date() > user.passwordResetExpiresAt) {
        return { success: false, error: 'Password reset token has expired. Please request a new one.' };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      });

      // Security: revoke all existing sessions for this user so any device still
      // logged in with the OLD password is signed out after a reset.
      try {
        await db.execute(sql`DELETE FROM session WHERE (sess->>'userId') = ${user.id}`);
      } catch (revokeErr) {
        console.error('Failed to revoke sessions after password reset:', revokeErr);
      }

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'Failed to reset password. Please try again.' };
    }
  }

  // Google OAuth methods
  static async findUserByGoogleId(googleId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByGoogleId(googleId);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      return null;
    }
  }

  static async findUserByEmail(email: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  static async linkGoogleAccount(userId: string, googleId: string, profileImageUrl?: string | null): Promise<void> {
    try {
      await storage.linkGoogleAccount(userId, googleId, profileImageUrl);
    } catch (error) {
      console.error('Error linking Google account:', error);
      throw error;
    }
  }

  static async createGoogleUser(userData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    emailVerified: boolean;
  }): Promise<SafeUser> {
    try {
      // Normalize email
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Google verifies email ownership, so identities under OTHER businesses
      // (a pending team invitation, a client record, or an unlinked team_member
      // sharing this email) must NOT block creating the account — same trust as
      // an accepted invite link. An existing `users` row is still handled by the
      // caller, which prefers linking.
      const conflict = await AuthService.findEmailConflict(normalizedEmail, { inviteTrusted: true });
      if (conflict && conflict.source !== 'user') {
        const err = new Error(conflict.message);
        (err as any).code = conflict.code;
        (err as any).status = 409;
        throw err;
      }

      // Generate username from email
      const username = normalizedEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      
      // Create base user
      const user = await storage.createUser({
        email: normalizedEmail,
        username: username,
        password: undefined, // No password for Google users
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      // Update with Google-specific fields
      await storage.updateUser(user.id, {
        profileImageUrl: userData.profileImageUrl,
        emailVerified: userData.emailVerified,
        googleId: userData.googleId,
      } as any);

      // Fetch the updated user
      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) throw new Error('Failed to fetch updated user');

      // Seed default templates for new Google user (async, don't block)
      storage.seedDefaultBusinessTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed business templates for Google user:', err);
      });
      storage.ensureDefaultTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed message templates for Google user:', err);
      });

      // Welcome email is intentionally NOT sent at signup. It is sent once the
      // user finishes onboarding (POST /api/onboarding/complete).

      // Return safe user data without password
      const { password, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error creating Google user:', error);
      throw error;
    }
  }

  // Apple Sign In methods
  static async findUserByAppleId(appleId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByAppleId(appleId);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by Apple ID:', error);
      return null;
    }
  }

  static async linkAppleAccount(userId: string, appleId: string): Promise<void> {
    try {
      await storage.linkAppleAccount(userId, appleId);
    } catch (error) {
      console.error('Error linking Apple account:', error);
      throw error;
    }
  }

  static async createAppleUser(userData: {
    appleId: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  }): Promise<SafeUser> {
    try {
      // Normalize email
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Block creation if email is already attached to another business.
      // NOTE: unlike the Google path, the Apple identityToken signature is not
      // yet verified server-side, so we do NOT grant the invite-trusted bypass
      // here — a forged token must not be able to skip cross-business conflict
      // checks. Re-enable the bypass only once Apple JWT verification is added.
      const conflict = await AuthService.findEmailConflict(normalizedEmail);
      if (conflict && conflict.source !== 'user') {
        const err = new Error(conflict.message);
        (err as any).code = conflict.code;
        (err as any).status = 409;
        throw err;
      }

      // Generate username from email
      const username = normalizedEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      
      // Create base user
      const user = await storage.createUser({
        email: normalizedEmail,
        username: username,
        password: undefined, // No password for Apple users
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      // Update with Apple-specific fields
      await storage.updateUser(user.id, {
        emailVerified: userData.emailVerified,
        appleId: userData.appleId,
      } as any);

      // Fetch the updated user
      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) throw new Error('Failed to fetch updated user');

      // Seed default templates for new Apple user (async, don't block)
      storage.seedDefaultBusinessTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed business templates for Apple user:', err);
      });
      storage.ensureDefaultTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed message templates for Apple user:', err);
      });

      // Welcome email is intentionally NOT sent at signup. It is sent once the
      // user finishes onboarding (POST /api/onboarding/complete).

      // Return safe user data without password
      const { password, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error creating Apple user:', error);
      throw error;
    }
  }
  static async findUserByXeroId(xeroId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByXeroId(xeroId);
      if (!user) return null;
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by Xero ID:', error);
      return null;
    }
  }

  static async linkXeroAccount(userId: string, xeroId: string): Promise<void> {
    try {
      await storage.linkXeroAccount(userId, xeroId);
    } catch (error) {
      console.error('Error linking Xero account:', error);
      throw error;
    }
  }

  static async createXeroUser(userData: {
    xeroId: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  }): Promise<SafeUser> {
    try {
      const normalizedEmail = userData.email.toLowerCase().trim();
      const username = normalizedEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);

      const user = await storage.createUser({
        email: normalizedEmail,
        username: username,
        password: undefined,
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      await storage.updateUser(user.id, {
        emailVerified: userData.emailVerified,
        xeroId: userData.xeroId,
      } as any);

      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) throw new Error('Failed to fetch updated user');

      storage.seedDefaultBusinessTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed business templates for Xero user:', err);
      });
      storage.ensureDefaultTemplates(updatedUser.id).catch(err => {
        console.error('Failed to seed message templates for Xero user:', err);
      });

      // Welcome email is intentionally NOT sent at signup. It is sent once the
      // user finishes onboarding (POST /api/onboarding/complete).

      const { password, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error creating Xero user:', error);
      throw error;
    }
  }
}

// Session middleware type
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: SafeUser;
}