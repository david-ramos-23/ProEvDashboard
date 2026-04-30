/**
 * Shared helpers for Airtable proxy routes.
 *
 * Centralizes env loading, origin allowlist, session auth, and the
 * actual forwarding to api.airtable.com so each route file stays small.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

const ALLOWED_ORIGINS = [
  'https://dashboard-eight-jade-69.vercel.app',
  'https://proev-dashboard.dravaautomations.com',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

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

/**
 * Validate request basics (env + origin + session) before forwarding.
 * Returns `null` if valid, otherwise sends a response and returns the
 * status that was sent so the caller can early-return.
 */
function validateRequest(req: VercelRequest, res: VercelResponse): number | null {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    res.status(500).json({ error: 'Server misconfigured: missing Airtable credentials' });
    return 500;
  }

  const origin = req.headers['origin'] as string | undefined;
  if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    res.status(403).json({ error: 'Forbidden' });
    return 403;
  }

  if (req.method !== 'GET') {
    const sessionEmail = req.headers['x-proev-session'] as string | undefined;
    if (!isAuthorizedSession(sessionEmail)) {
      res.status(401).json({ error: 'Unauthorized' });
      return 401;
    }
  }

  return null;
}

/**
 * Forward the request to Airtable preserving method, body, and query string.
 * `pathSegments` is appended after the base id, e.g. ['tblXXX', 'recYYY']
 * yields `https://api.airtable.com/v0/{BASE_ID}/tblXXX/recYYY?<query>`.
 */
async function forwardToAirtable(
  req: VercelRequest,
  res: VercelResponse,
  pathSegments: string[],
): Promise<void> {
  const path = pathSegments.map(encodeURIComponent).join('/');

  // Preserve original query string (filterByFormula, sort[], etc.)
  const rawUrl = req.url || '';
  const queryIndex = rawUrl.indexOf('?');
  const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';

  const url = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${path}${query}`;

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
    res.status(airtableRes.status).json(data);
  } catch {
    res.status(502).json({ error: 'Failed to proxy request to Airtable' });
  }
}

export { validateRequest, forwardToAirtable };
