/**
 * POST /api/auth/send-magic-link
 *
 * Generates a signed magic-link token and emails it to the user via Resend.
 * Returns { success: true } regardless of whether the email exists (prevents enumeration).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
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
};

const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;
const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;

function isAuthorized(email: string): boolean {
  if (TEST_USER_PATTERN.test(email)) return true;
  if (ADMIN_ALIAS_PATTERN.test(email)) return true;
  if (REVISOR_ALIAS_PATTERN.test(email)) return true;
  return !!AUTHORIZED_USERS[email];
}

function createToken(email: string): string {
  if (!MAGIC_LINK_SECRET) throw new Error('MAGIC_LINK_SECRET not configured');
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + 10 * 60 * 1000, // 10 min
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', MAGIC_LINK_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function buildEmailHtml(magicLink: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0C5A45;padding:32px 40px;text-align:center;">
            <div style="font-size:20px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.9);text-transform:uppercase;">ProEv</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">Dashboard</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;font-size:16px;color:#1A1A1A;">Hola ${name},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#4A4A4A;line-height:1.5;">
              Haz clic en el boton para acceder a tu dashboard. Este enlace expira en 10 minutos.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:#0C5A45;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                  Acceder al Dashboard
                </a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#A9A9A9;line-height:1.5;">
              Si no solicitaste este enlace, puedes ignorar este email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' });
  }

  const normalized = email.toLowerCase().trim();

  // Always return success to prevent email enumeration
  if (!isAuthorized(normalized)) {
    return res.status(200).json({ success: true });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const token = createToken(normalized);

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${proto}://${host}`;
  const magicLink = `${baseUrl}/login?token=${token}`;

  const userName = AUTHORIZED_USERS[normalized]?.name || normalized.split('@')[0];

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ProEv Dashboard <onboarding@resend.dev>',
      to: [normalized],
      subject: 'Tu enlace de acceso - ProEv Dashboard',
      html: buildEmailHtml(magicLink, userName),
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error('Resend error:', errText);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ success: true });
}
