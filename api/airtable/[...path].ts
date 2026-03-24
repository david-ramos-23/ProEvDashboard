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
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing Airtable credentials' });
  }

  // Reject requests from disallowed browser origins.
  // Note: the Origin header is set by browsers for cross-origin requests; same-origin
  // requests and server-side calls typically omit it, so we only block when it IS present.
  const origin = req.headers['origin'] as string | undefined;
  if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    return res.status(403).json({ error: 'Forbidden' });
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
