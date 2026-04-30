/**
 * Table-level operations: list (GET) and create (POST).
 *
 *   GET  /api/airtable/{tableId}?filterByFormula=...
 *   POST /api/airtable/{tableId}   body: { records: [{ fields }] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateRequest, forwardToAirtable } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (validateRequest(req, res) !== null) return;

  const tableId = req.query.tableId;
  if (typeof tableId !== 'string' || !tableId) {
    return res.status(400).json({ error: 'Missing tableId' });
  }

  await forwardToAirtable(req, res, [tableId]);
}
