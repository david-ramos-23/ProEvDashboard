/**
 * Vercel Serverless Proxy for Airtable API.
 *
 * Keeps the Airtable PAT server-side. The client calls /api/airtable/TABLE_ID
 * and this function proxies to https://api.airtable.com/v0/BASE_ID/TABLE_ID.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

// Allowed origins: production URL + local dev. Add ALLOWED_ORIGINS env var (comma-separated) to extend.
const ALLOWED_ORIGINS = [
  'https://dashboard-eight-jade-69.vercel.app',
  'https://proev-dashboard.dravaautomations.com',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

// Authorized session emails
const AUTHORIZED_USERS = [
  'andara14@gmail.com',
  'david@dravaautomations.com',
  'proevolutioncourse@gmail.com',
  'alonsoynoelia17@gmail.com',
];
const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;
const ALIAS_PATTERN = /^andara14\+(admin|revisor)@gmail\.com$/i;

function isAuthorizedSession(email: string | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return AUTHORIZED_USERS.includes(e) || TEST_USER_PATTERN.test(e) || ALIAS_PATTERN.test(e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing Airtable credentials' });
  }

  // Reject requests from disallowed browser origins.
  const origin = req.headers['origin'] as string | undefined;
  if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Require session authentication for write operations
  if (req.method !== 'GET') {
    const sessionEmail = req.headers['x-proev-session'] as string | undefined;
    if (!isAuthorizedSession(sessionEmail)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Extract path + query from the raw URL after /api/airtable/
  const rawUrl = req.url || '';
  const prefixIndex = rawUrl.indexOf('/api/airtable/');
  if (prefixIndex === -1) {
    return res.status(400).json({ error: 'Missing table path' });
  }
  const remainder = rawUrl.slice(prefixIndex + '/api/airtable/'.length);
  if (!remainder || remainder === '') {
    return res.status(400).json({ error: 'Missing table path' });
  }

  // Build Airtable URL preserving the original query string
  const url = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${remainder}`;

  try {
    const airtableRes = await fetch(url, {
      method: req.method || 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      ...(req.method !== 'GET' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const data = await airtableRes.json();

    // Forward Airtable status code
    return res.status(airtableRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to proxy request to Airtable' });
  }
}
