/**
 * GET /api/airtable/schema
 *
 * Fetches Airtable base metadata (tables + fields) and returns
 * a structured map of Single Select / Multi Select field options.
 *
 * Cached in-memory for 1 hour to avoid hitting Airtable rate limits.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

interface AirtableChoice {
  id: string;
  name: string;
  color?: string;
}

interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: {
    choices?: AirtableChoice[];
  };
}

interface AirtableTable {
  id: string;
  name: string;
  fields: AirtableField[];
}

interface SchemaCache {
  data: Record<string, Record<string, string[]>>;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: SchemaCache | null = null;

async function fetchSchema(): Promise<Record<string, Record<string, string[]>>> {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
    { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable metadata API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const tables: AirtableTable[] = data.tables || [];

  // Build a map: { tableName: { fieldName: [option1, option2, ...] } }
  const schema: Record<string, Record<string, string[]>> = {};

  for (const table of tables) {
    const fields: Record<string, string[]> = {};

    for (const field of table.fields) {
      if (
        (field.type === 'singleSelect' || field.type === 'multipleSelects') &&
        field.options?.choices
      ) {
        fields[field.name] = field.options.choices.map(c => c.name);
      }
    }

    if (Object.keys(fields).length > 0) {
      schema[table.name] = fields;
    }
  }

  return schema;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    // Return cached if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      res.setHeader('X-Schema-Cache', 'hit');
      return res.status(200).json(cache.data);
    }

    const schema = await fetchSchema();
    cache = { data: schema, timestamp: Date.now() };

    res.setHeader('X-Schema-Cache', 'miss');
    // Tell browsers to cache for 30 min
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    return res.status(200).json(schema);
  } catch (err) {
    console.error('Schema fetch error:', err);

    // Return stale cache if available
    if (cache) {
      res.setHeader('X-Schema-Cache', 'stale');
      return res.status(200).json(cache.data);
    }

    return res.status(500).json({ error: 'Failed to fetch schema' });
  }
}
