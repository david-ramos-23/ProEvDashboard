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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing Airtable credentials' });
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
