/**
 * Table-level operations: list (GET) and create (POST).
 *
 *   GET  /api/airtable/{tableId}?filterByFormula=...
 *   POST /api/airtable/{tableId}   body: { records: [{ fields }] }
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

async function forwardToAirtable(
  req: VercelRequest,
  res: VercelResponse,
  pathSegments: string[],
): Promise<void> {
  const path = pathSegments.map(encodeURIComponent).join('/');

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (validateRequest(req, res) !== null) return;

  const tableId = req.query.tableId;
  if (typeof tableId !== 'string' || !tableId) {
    return res.status(400).json({ error: 'Missing tableId' });
  }

  await forwardToAirtable(req, res, [tableId]);
}
