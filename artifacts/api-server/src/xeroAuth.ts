import { AuthService } from './auth';
import type { Express } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;

const XERO_AUTH_SCOPES = 'openid profile email';
const XERO_ISSUER = 'https://identity.xero.com';
const XERO_JWKS_URI = 'https://identity.xero.com/.well-known/openid-configuration/jwks';

const jwks = jwksClient({ jwksUri: XERO_JWKS_URI, cache: true, rateLimit: true });

function getSigningKey(header: any): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err: any, key: any) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function verifyIdToken(token: string): Promise<any> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) throw new Error('Invalid id_token format');
  const signingKey = await getSigningKey(decoded.header);
  return jwt.verify(token, signingKey, {
    issuer: XERO_ISSUER,
    audience: XERO_CLIENT_ID!,
    algorithms: ['RS256'],
  });
}

const getBaseUrl = () => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
    if (domains[0]) {
      return `https://${domains[0]}`;
    }
    return process.env.REPL_URL || 'http://localhost:5000';
  }
  if (process.env.APP_DOMAIN) {
    return `https://${process.env.APP_DOMAIN}`;
  }
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL;
  }
  const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
  const customDomain = domains.find(d => !d.endsWith('.replit.app') && !d.endsWith('.replit.dev') && !d.endsWith('.repl.co'));
  if (customDomain) {
    return `https://${customDomain}`;
  }
  if (domains[0]) {
    return `https://${domains[0]}`;
  }
  return 'http://localhost:5000';
};

const pendingStates = new Map<string, { platform: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of Array.from(pendingStates)) {
    if (now - val.createdAt > 10 * 60 * 1000) pendingStates.delete(key);
  }
}, 5 * 60 * 1000);

export function setupXeroAuth(app: Express) {
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    console.log('Xero Auth: XERO_CLIENT_ID or XERO_CLIENT_SECRET not set - Xero sign-in disabled');
    return;
  }

  const BASE_URL = getBaseUrl();
  const CALLBACK_URL = `${BASE_URL}/api/auth/xero/callback`;

  console.log('Xero Auth: Sign Up with Xero enabled');
  console.log('Xero Auth Callback URL:', CALLBACK_URL);

  app.get('/api/auth/xero', (req: any, res) => {
    const isMobile = req.query.mobile === 'true';
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, { platform: isMobile ? 'mobile' : 'web', createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: XERO_CLIENT_ID!,
      redirect_uri: CALLBACK_URL,
      scope: XERO_AUTH_SCOPES,
      state,
    });

    const consentUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
    console.log(`Xero Auth: Starting OAuth flow - platform: ${isMobile ? 'mobile' : 'web'}`);
    res.redirect(consentUrl);
  });

  app.get('/api/auth/xero/callback', async (req: any, res) => {
    try {
      const { code, state, error: oauthError } = req.query;

      const stateData = state ? pendingStates.get(state as string) : undefined;
      const isMobile = stateData?.platform === 'mobile';

      if (oauthError) {
        console.error('Xero Auth: OAuth error:', oauthError);
        return redirect(res, isMobile, '/?error=xero_auth_denied');
      }

      if (!code || !state) {
        console.error('Xero Auth: Missing code or state');
        return redirect(res, isMobile, '/?error=xero_auth_failed');
      }

      if (!stateData) {
        console.error('Xero Auth: Invalid or expired state');
        return redirect(res, isMobile, '/?error=xero_auth_expired');
      }
      pendingStates.delete(state as string);

      const tokenRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: CALLBACK_URL,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error('Xero Auth: Token exchange failed:', errBody);
        return redirect(res, isMobile, '/?error=xero_auth_failed');
      }

      const tokenData = await tokenRes.json() as any;
      const idToken = tokenData.id_token;

      if (!idToken) {
        console.error('Xero Auth: No id_token in response');
        return redirect(res, isMobile, '/?error=xero_auth_failed');
      }

      let payload: any;
      try {
        payload = await verifyIdToken(idToken);
      } catch (verifyErr) {
        console.error('Xero Auth: id_token verification failed:', verifyErr);
        return redirect(res, isMobile, '/?error=xero_auth_failed');
      }
      const xeroId = payload.sub;
      const email = payload.email || '';
      const firstName = payload.given_name || payload.name?.split(' ')[0] || '';
      const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
      const emailVerified = payload.email_verified === true;

      if (!xeroId) {
        console.error('Xero Auth: No sub claim in id_token');
        return redirect(res, isMobile, '/?error=xero_auth_failed');
      }

      let isNewUser = false;
      let user;

      const existingXeroUser = await AuthService.findUserByXeroId(xeroId);
      if (existingXeroUser) {
        user = existingXeroUser;
        console.log('Xero Auth: Found existing user by Xero ID:', user.email);
      } else if (email && emailVerified) {
        const emailUser = await AuthService.findUserByEmail(email.toLowerCase().trim());
        if (emailUser) {
          await AuthService.linkXeroAccount(emailUser.id, xeroId);
          user = emailUser;
          console.log('Xero Auth: Linked Xero to existing email user:', user.email);
        }
      } else if (email && !emailVerified) {
        console.log('Xero Auth: Email not verified, skipping auto-link for:', email);
      }

      if (!user) {
        if (!email) {
          console.error('Xero Auth: No email available for new user');
          return redirect(res, isMobile, '/?error=xero_no_email');
        }
        isNewUser = true;
        user = await AuthService.createXeroUser({
          xeroId,
          email,
          firstName,
          lastName,
          emailVerified,
        });

        // Beta cohort assignment removed — production mode active.

        console.log('Xero Auth: Created new user:', user.email);
      }

      req.login(user, (loginErr: any) => {
        if (loginErr) {
          console.error('Xero Auth: Login error:', loginErr);
          return redirect(res, isMobile, '/?error=xero_login_failed');
        }

        req.session.userId = user!.id;
        req.session.user = user;

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('Xero Auth: Session save error:', saveErr);
            return redirect(res, isMobile, '/?error=xero_session_failed');
          }

          if (isMobile) {
            const sessionToken = req.sessionID;
            console.log(`Xero Auth: Mobile success (isNewUser: ${isNewUser})`);
            return res.redirect(`jobrunner://?auth=xero_success&token=${sessionToken}&isNewUser=${isNewUser}`);
          }

          console.log(`Xero Auth: Web success (isNewUser: ${isNewUser})`);
          res.redirect(`/?auth=xero_success&isNewUser=${isNewUser}`);
        });
      });
    } catch (error) {
      console.error('Xero Auth: Callback error:', error);
      return res.redirect('/?error=xero_auth_failed');
    }
  });
}

function redirect(res: any, isMobile: boolean | undefined, webUrl: string) {
  if (isMobile) {
    const params = webUrl.includes('?') ? webUrl.split('?')[1] : '';
    return res.redirect(`jobrunner://?${params}`);
  }
  return res.redirect(webUrl);
}
