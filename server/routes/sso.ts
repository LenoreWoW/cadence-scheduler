/**
 * Google SSO — sign-in / sign-up via Google account. Separate from the
 * Calendar OAuth flow (which requests calendar scopes); SSO only needs
 * `openid email profile`.
 *
 * Flow:
 *   1. GET /google/login   -> 302 to Google with a signed state param.
 *   2. GET /google/callback -> verify state, exchange code, find-or-create
 *      a user, issue a JWT, redirect to FRONTEND_URL with `#token=...`.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../database';
import { generateTokens } from '../middleware/auth';
import { signState, verifyState } from '../utils/signedState';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Distinct redirect URI from the Calendar OAuth flow so the scope set stays clean.
const SSO_REDIRECT_URI =
  process.env.GOOGLE_SSO_REDIRECT_URI ||
  'http://localhost:3001/api/sso/google/callback';

const SCOPES = ['openid', 'email', 'profile'].join(' ');

function isConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;
}

// GET /google/login — redirect into Google's OAuth UI
router.get('/google/login', (_req: Request, res: Response) => {
  if (!isConfigured()) {
    return res.status(400).json({ error: 'Google SSO is not configured' });
  }
  const state = signState({ flow: 'sso' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', SSO_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  res.redirect(url.toString());
});

// GET /google/callback — exchange code, sign user in
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) return res.redirect(`${FRONTEND_URL}/login?sso_error=${encodeURIComponent(error)}`);
    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/login?sso_error=missing_params`);
    }

    const decoded = verifyState<{ flow?: string }>(state);
    if (!decoded || decoded.flow !== 'sso') {
      return res.redirect(`${FRONTEND_URL}/login?sso_error=invalid_state`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: SSO_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error('Google SSO token exchange failed:', errText);
      return res.redirect(`${FRONTEND_URL}/login?sso_error=token_exchange`);
    }
    const tokenJson: any = await tokenRes.json();
    const accessToken = tokenJson.access_token;
    if (!accessToken) return res.redirect(`${FRONTEND_URL}/login?sso_error=no_access_token`);

    // Fetch userinfo
    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return res.redirect(`${FRONTEND_URL}/login?sso_error=userinfo_failed`);
    const profile: any = await userRes.json();
    const email = (profile.email || '').toLowerCase();
    const name = profile.name || profile.given_name || email;
    const avatar = profile.picture || null;
    if (!email) return res.redirect(`${FRONTEND_URL}/login?sso_error=missing_email`);

    // Find or create a user
    let user = db.connection.prepare(
      `SELECT id, username, role, email FROM users WHERE lower(email) = ?`
    ).get(email) as any;

    if (!user) {
      // Generate a unique username from the email local-part
      const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user';
      let username = base;
      let i = 1;
      while (db.connection.prepare(`SELECT id FROM users WHERE username = ?`).get(username)) {
        username = `${base}${i++}`;
      }

      // Random password — they'll never use it (SSO-only by default).
      const randomPwd = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
      const passwordHash = await bcrypt.hash(randomPwd, 12);
      const userId = uuidv4();
      db.connection.prepare(`
        INSERT INTO users (id, username, password_hash, name, email, role, avatar, email_verified)
        VALUES (?, ?, ?, ?, ?, 'guest', ?, 1)
      `).run(userId, username, passwordHash, name, email, avatar);
      db.connection.prepare(
        `INSERT INTO user_availability (id, user_id) VALUES (?, ?)`
      ).run(uuidv4(), userId);
      user = { id: userId, username, role: 'guest', email };
    }

    // Issue JWT + session
    const payload = { userId: user.id, username: user.username, role: user.role };
    const { accessToken: jwt, refreshToken } = generateTokens(payload);
    const sessionId = uuidv4();
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.connection.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)
    `).run(sessionId, user.id, refreshToken, sessionExpiry);

    // Use a URL fragment so the token never lands in server logs.
    const redirect = `${FRONTEND_URL}/sso-callback#token=${encodeURIComponent(jwt)}&refresh=${encodeURIComponent(refreshToken)}`;
    res.redirect(redirect);
  } catch (e) {
    console.error('SSO callback error:', e);
    res.redirect(`${FRONTEND_URL}/login?sso_error=unexpected`);
  }
});

export default router;
