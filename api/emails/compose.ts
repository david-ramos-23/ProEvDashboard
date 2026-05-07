import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionRole } from '../_lib/auth';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const COLA_EMAILS_TABLE = 'tblVqFfucbW5POC5u';

const ALLOWED_ORIGINS = [
  'https://dashboard-eight-jade-69.vercel.app',
  'https://proev-dashboard.dravaautomations.com',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

const VALID_TEMPLATE_KEYS = [
  'disculpa', 'informacion', 'recordatorio',
  'seguimiento', 'bienvenida', 'felicitacion', 'urgente',
] as const;
type TemplateKey = typeof VALID_TEMPLATE_KEYS[number];

function isValidTemplateKey(key: string): key is TemplateKey {
  return (VALID_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — only echo back a literal allowlist value (never the raw request header)
  const origin = req.headers['origin'] as string | undefined;
  const matchedOrigin = origin ? ALLOWED_ORIGINS.find(o => o === origin) : undefined;
  if (matchedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', matchedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ProEv-Session');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Env guard
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing Airtable credentials' });
  }

  // Auth — 401 if no/empty session, 403 if role not admin or revisor
  const sessionEmail = req.headers['x-proev-session'] as string | undefined;
  const role = getSessionRole(sessionEmail);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== 'admin' && role !== 'revisor') return res.status(403).json({ error: 'Forbidden' });

  // Input validation — all fields required, non-empty strings
  const { alumnoRecordId, asunto, mensaje, templateKey } = req.body ?? {};

  if (!alumnoRecordId || typeof alumnoRecordId !== 'string') {
    return res.status(400).json({ error: 'alumnoRecordId is required', field: 'alumnoRecordId' });
  }
  if (!asunto || typeof asunto !== 'string') {
    return res.status(400).json({ error: 'asunto is required', field: 'asunto' });
  }
  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ error: 'mensaje is required', field: 'mensaje' });
  }
  if (!templateKey || typeof templateKey !== 'string') {
    return res.status(400).json({ error: 'templateKey is required', field: 'templateKey' });
  }
  if (!isValidTemplateKey(templateKey)) {
    return res.status(400).json({ error: 'Invalid templateKey', field: 'templateKey' });
  }

  // Write to Airtable Cola de Emails
  try {
    const airtableRes = await fetch(
      `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${COLA_EMAILS_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                'Alumno': [alumnoRecordId],
                'Tipo': templateKey,
                'Mensaje': mensaje,
                'Asunto Generado': asunto,
                'Estado': 'Pendiente',
              },
            },
          ],
        }),
      }
    );

    const data = await airtableRes.json() as {
      records?: Array<{ id: string }>;
      error?: { type: string; message: string } | string;
    };

    if (!airtableRes.ok) {
      const errorMsg = typeof data.error === 'object'
        ? data.error?.message ?? 'Airtable error'
        : (data.error ?? 'Airtable error');
      const status = airtableRes.status === 422 ? 422 : 500;
      return res.status(status).json({ error: errorMsg, detail: JSON.stringify(data.error) });
    }

    const recordId = data.records?.[0]?.id;
    return res.status(200).json({ id: recordId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create email record' });
  }
}
