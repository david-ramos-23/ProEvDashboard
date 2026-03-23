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

  // Extract the path segments after /api/airtable/
  const pathSegments = req.query.path;
  if (!pathSegments || (Array.isArray(pathSegments) && pathSegments.length === 0)) {
    return res.status(400).json({ error: 'Missing table path' });
  }

  const airtablePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;

  // Build Airtable URL with query params
  const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${airtablePath}`);

  // Forward query params (except 'path' which is the catch-all)
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const airtableRes = await fetch(url.toString(), {
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
