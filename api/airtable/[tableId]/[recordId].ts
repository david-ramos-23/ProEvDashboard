/**
 * Record-level operations: read (GET), update (PATCH), delete (DELETE).
 *
 *   GET    /api/airtable/{tableId}/{recordId}
 *   PATCH  /api/airtable/{tableId}/{recordId}   body: { fields }
 *   DELETE /api/airtable/{tableId}/{recordId}
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateRequest, forwardToAirtable } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (validateRequest(req, res) !== null) return;

  const { tableId, recordId } = req.query;
  if (typeof tableId !== 'string' || !tableId) {
    return res.status(400).json({ error: 'Missing tableId' });
  }
  if (typeof recordId !== 'string' || !recordId) {
    return res.status(400).json({ error: 'Missing recordId' });
  }

  await forwardToAirtable(req, res, [tableId, recordId]);
}
