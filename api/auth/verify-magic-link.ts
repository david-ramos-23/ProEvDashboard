/**
 * POST /api/auth/verify-magic-link
 *
 * Verifies an HMAC-signed magic-link token and returns the user profile
 * if valid and not expired.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET;
if (!MAGIC_LINK_SECRET) {
  console.error('CRITICAL: MAGIC_LINK_SECRET env var is not set');
}

// ── Authorized users (mirrors AuthService.ts) ──────────────────────────────
const AUTHORIZED_USERS: Record<string, { role: string; name: string }> = {
  'andara14@gmail.com': { role: 'admin', name: 'David Ramos' },
  'david@dravaautomations.com': { role: 'admin', name: 'David Ramos' },
  'proevolutioncourse@gmail.com': { role: 'admin', name: 'Pro Evolution Course' },
  'alonsoynoelia17@gmail.com': { role: 'revisor', name: 'Alonso y Noelia' },
  'alonkickboxer@gmail.com': { role: 'revisor', name: 'Alonkickboxer' },
};

const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;
const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;

function resolveUser(email: string): { role: string; name: string } | null {
  if (TEST_USER_PATTERN.test(email)) return { role: 'admin', name: 'Test User' };
  if (ADMIN_ALIAS_PATTERN.test(email)) return { role: 'admin', name: 'Admin (alias)' };
  if (REVISOR_ALIAS_PATTERN.test(email)) return { role: 'revisor', name: 'Revisor (alias)' };
  return AUTHORIZED_USERS[email] || null;
}

function verifyToken(token: string): { email: string } | null {
  if (!MAGIC_LINK_SECRET) return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expected = crypto.createHmac('sha256', MAGIC_LINK_SECRET).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null; // different lengths
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.email || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = ['https://dashboard-eight-jade-69.vercel.app', 'https://proev-dashboard.dravaautomations.com', 'http://localhost:5173', 'http://localhost:4173'];
  const reqOrigin = req.headers['origin'] as string | undefined;
  const corsOrigin = reqOrigin && allowedOrigins.some(o => reqOrigin.startsWith(o)) ? reqOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  const result = verifyToken(token);
  if (!result) {
    return res.status(401).json({ error: 'Enlace invalido o expirado. Solicita uno nuevo.' });
  }

  const user = resolveUser(result.email);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no autorizado.' });
  }

  return res.status(200).json({
    success: true,
    user: {
      email: result.email,
      name: user.name,
      role: user.role,
    },
  });
}
