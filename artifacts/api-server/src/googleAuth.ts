import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from './auth';
import type { Express } from 'express';
import crypto from 'crypto';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Determine the base URL for Google OAuth callback
// In production, always use the custom domain to match Google Cloud Console configuration
const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://jobrunner.com.au';
  }
  if (process.env.APP_DOMAIN) {
    return `https://${process.env.APP_DOMAIN}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
  if (domains[0]) {
    return `https://${domains[0]}`;
  }
  return process.env.REPL_URL || 'http://localhost:5000';
};
const BASE_URL = getBaseUrl();

export function setupGoogleAuth(app: Express) {
  // Development mode - simulate Google OAuth without real credentials
  if (process.env.NODE_ENV === 'development' && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_ID === 'demo-client-id')) {
    console.log('🔧 Google OAuth in development mode - using simulation with persistent accounts');
    
    // Simulate Google OAuth flow for development with persistent demo accounts
    app.get('/api/auth/google', async (req: any, res) => {
      try {
        // Check if this is a mobile request
        const isMobile = req.query.mobile === 'true';
        
        // Check query parameter for selected account (from frontend account picker)
        const selectedAccount = req.query.account;
        
        // Define persistent demo Google accounts (like real Google account picker)
        const demoAccounts = [
          {
            googleId: 'demo-google-primary',
            email: 'demo.google@jobrunner.com.au',
            firstName: 'Primary',
            lastName: 'Account',
            profileImageUrl: null,
            emailVerified: true
          },
          {
            googleId: 'demo-google-secondary',
            email: 'test.google@jobrunner.com.au',
            firstName: 'Test',
            lastName: 'Account',
            profileImageUrl: null,
            emailVerified: true
          }
        ];

        // Use the first account by default, or selected account from query
        const accountIndex = selectedAccount ? parseInt(selectedAccount as string, 10) : 0;
        const demoGoogleUser = demoAccounts[accountIndex] || demoAccounts[0];

        // Track if this is a new user for onboarding
        let isNewUser = false;
        
        // Check if user already exists by Google ID (most reliable)
        let user = await AuthService.findUserByGoogleId(demoGoogleUser.googleId);
        
        if (!user) {
          // Check by email as fallback
          user = await AuthService.findUserByEmail(demoGoogleUser.email);
        }
        
        if (!user) {
          // Create new Google user (first-time login)
          console.log(`🆕 Creating new Google user: ${demoGoogleUser.email}`);
          user = await AuthService.createGoogleUser(demoGoogleUser);
          isNewUser = true;
        } else {
          // Existing user found - link Google ID if not already linked
          console.log(`✅ Existing Google user found: ${demoGoogleUser.email}`);
          if (!user.googleId) {
            await AuthService.linkGoogleAccount(user.id, demoGoogleUser.googleId);
          }
        }

        // Set session and explicitly save before redirecting
        req.session.userId = user.id;
        req.session.user = user;
        req.session.save((err: any) => {
          if (err) {
            console.error('Session save error:', err);
            if (isMobile) {
              return res.redirect('jobrunner://?error=session_failed');
            }
            return res.redirect('/?error=session_failed');
          }
          // Redirect based on platform with isNewUser flag
          if (isMobile) {
            console.log(`🔐 Mobile OAuth success (dev mode, isNewUser: ${isNewUser}), redirecting to app deep link`);
            return res.redirect(`jobrunner://?auth=google_success&isNewUser=${isNewUser}`);
          }
          res.redirect(`/?auth=google_success&isNewUser=${isNewUser}`);
        });
      } catch (error) {
        console.error('Demo Google auth error:', error);
        const isMobile = req.query.mobile === 'true';
        if (isMobile) {
          res.redirect('jobrunner://?error=auth_failed');
        } else {
          res.redirect('/?error=auth_failed');
        }
      }
    });

    app.get('/api/auth/google/callback', (req: any, res) => {
      res.redirect('/?auth=google_success');
    });

    return;
  }

  // Production mode with real Google OAuth
  console.log('🔐 Google OAuth in production mode - using real credentials');
  console.log('🔐 OAuth Callback URL:', `${BASE_URL}/api/auth/google/callback`);
  console.log('🔐 REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await AuthService.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Log the OAuth callback URL for debugging
  const callbackURL = `${BASE_URL}/api/auth/google/callback`;
  console.log(`🔐 Google OAuth Callback URL: ${callbackURL}`);
  console.log(`🔐 Google OAuth env: APP_DOMAIN=${process.env.APP_DOMAIN || 'not set'}, VITE_APP_URL=${process.env.VITE_APP_URL || 'not set'}, REPLIT_DOMAINS=${process.env.REPLIT_DOMAINS || 'not set'}`);

  // Google OAuth Strategy with passReqToCallback to access session
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: callbackURL,
    passReqToCallback: true
  }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Track if this is a new user for onboarding purposes
      let isNewUser = false;
      
      // Check if user already exists with this Google ID
      const existingUser = await AuthService.findUserByGoogleId(profile.id);
      
      if (existingUser) {
        // Attach isNewUser flag to user object for callback to use
        (existingUser as any).isNewUser = false;
        console.log('🔐 Google OAuth - Found existing user:', {
          email: existingUser.email,
          isPlatformAdmin: existingUser.isPlatformAdmin,
          is_platform_admin: (existingUser as any).is_platform_admin,
          googleId: profile.id
        });
        return done(null, existingUser);
      }

      // Check if user exists with the same email (password-based or other OAuth)
      const googleEmail = profile.emails?.[0]?.value || '';
      const emailUser = await AuthService.findUserByEmail(googleEmail);
      
      if (emailUser) {
        // Link Google account to existing user (may have password set)
        console.log('🔐 Google OAuth - Linking Google account to existing email user:', {
          email: googleEmail,
          userId: emailUser.id,
          hadGoogleId: !!(emailUser as any).googleId
        });
        await AuthService.linkGoogleAccount(emailUser.id, profile.id, profile.photos?.[0]?.value || null);
        (emailUser as any).isNewUser = false;
        return done(null, emailUser);
      }

      // Create new user - this is a first-time user who needs onboarding
      isNewUser = true;
      const newUser = await AuthService.createGoogleUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value || '',
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        profileImageUrl: profile.photos?.[0]?.value || null,
        emailVerified: true // Google accounts are pre-verified
      });

      // Beta cohort assignment removed — production mode active.

      // Attach isNewUser flag for callback to use
      (newUser as any).isNewUser = isNewUser;
      return done(null, newUser);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, undefined);
    }
  }));

  // Google OAuth routes - use state parameter to track mobile requests
  app.get('/api/auth/google', (req: any, res, next) => {
    const isMobile = req.query.mobile === 'true';
    // Generate a cryptographically random nonce and bind it to the initiating
    // session so the callback can verify the request originated here.
    const nonce = crypto.randomBytes(16).toString('hex');
    const platform = isMobile ? 'mobile' : 'web';
    // Encode both nonce and platform in state; nonce is hex so ':' is safe.
    const state = `${nonce}:${platform}`;
    req.session.oauthNonce = nonce;
    console.log(`🔐 Starting Google OAuth - platform: ${platform}`);

    req.session.save((saveErr: any) => {
      if (saveErr) {
        console.error('🔐 Failed to save session before Google OAuth redirect:', saveErr);
        return res.redirect('/?error=session_failed');
      }
      passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account',
        state: state
      })(req, res, next);
    });
  });

  app.get('/api/auth/google/callback', (req: any, res, next) => {
    // Parse state: <nonce>:<platform>
    const rawState = (req.query.state as string) || '';
    const colonIdx = rawState.indexOf(':');
    const returnedNonce = colonIdx !== -1 ? rawState.slice(0, colonIdx) : '';
    const platform = colonIdx !== -1 ? rawState.slice(colonIdx + 1) : '';
    const isMobile = platform === 'mobile';

    // Verify the nonce matches the one stored in the initiating session.
    const expectedNonce = req.session.oauthNonce;
    if (!returnedNonce || !expectedNonce || returnedNonce !== expectedNonce) {
      console.error('🔐 Google OAuth callback: state nonce mismatch (possible CSRF)');
      return res.redirect('/?error=auth_failed');
    }
    // Consume the nonce so it cannot be reused.
    delete req.session.oauthNonce;

    console.log(`🔐 Google OAuth callback - platform: ${platform}, isMobile: ${isMobile}`);
    
    passport.authenticate('google', (err: any, user: any, info: any) => {
      if (err || !user) {
        console.error('Google OAuth failed:', err || 'No user returned');
        if (isMobile) {
          console.log('🔐 Mobile OAuth failed, redirecting to app deep link');
          return res.redirect('jobrunner://?error=auth_failed');
        }
        return res.redirect('/?error=auth_failed');
      }
      
      // Login the user
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          if (isMobile) {
            return res.redirect('jobrunner://?error=login_failed');
          }
          return res.redirect('/?error=login_failed');
        }
        
        // Set session data
        req.session.userId = user.id;
        req.session.user = user;
        
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            if (isMobile) {
              return res.redirect('jobrunner://?error=session_failed');
            }
            return res.redirect('/?error=session_failed');
          }
          
          // Check if this is a new user (set by the Passport strategy)
          const isNewUser = (user as any).isNewUser === true;
          
          // Redirect based on platform
          if (isMobile) {
            // Pass session token and isNewUser flag in URL for mobile app
            const sessionToken = req.sessionID;
            console.log(`🔐 Mobile OAuth success (isNewUser: ${isNewUser}), redirecting to app deep link`);
            return res.redirect(`jobrunner://?auth=google_success&token=${sessionToken}&isNewUser=${isNewUser}`);
          }
          
          // Redirect to web app with isNewUser flag so frontend knows to show onboarding
          console.log(`🔐 Web OAuth success (isNewUser: ${isNewUser}), redirecting to web app`);
          res.redirect(`/?auth=google_success&isNewUser=${isNewUser}`);
        });
      });
    })(req, res, next);
  });
}

