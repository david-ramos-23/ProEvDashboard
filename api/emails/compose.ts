import type { VercelRequest, VercelResponse } from '@vercel/node';

const AUTHORIZED_USERS: Record<string, 'admin' | 'revisor'> = {
  'andara14@gmail.com': 'admin',
  'david@dravaautomations.com': 'admin',
  'proevolutioncourse@gmail.com': 'admin',
  'alonsoynoelia17@gmail.com': 'revisor',
  'alonkickboxer@gmail.com': 'revisor',
};

const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;
// TEST_USER_PATTERN only active outside production to prevent admin backdoor in prod
const TEST_USER_PATTERN = process.env.NODE_ENV !== 'production'
  ? /^andara14\+test-.*@gmail\.com$/i
  : null;

function getSessionRole(email: string | undefined): 'admin' | 'revisor' | null {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  if (AUTHORIZED_USERS[e]) return AUTHORIZED_USERS[e];
  if (ADMIN_ALIAS_PATTERN.test(e)) return 'admin';
  if (REVISOR_ALIAS_PATTERN.test(e)) return 'revisor';
  if (TEST_USER_PATTERN?.test(e)) return 'admin';
  return null;
}

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const COLA_EMAILS_TABLE = 'tblVqFfucbW5POC5u';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = process.env.DATA_SOURCE === 'supabase';

const ALLOWED_ORIGINS = [
  'https://dashboard-eight-jade-69.vercel.app',
  'https://proev-dashboard.dravaautomations.com',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

const VALID_TEMPLATE_KEYS = [
  'disculpa', 'informacion', 'recordatorio',
  'seguimiento', 'bienvenida', 'felicitacion', 'urgente', 'libre',
] as const;
type TemplateKey = typeof VALID_TEMPLATE_KEYS[number];

function isValidTemplateKey(key: string): key is TemplateKey {
  return (VALID_TEMPLATE_KEYS as readonly string[]).includes(key);
}

const VALID_ORIGINS_FIELD = ['manual_template', 'manual_quick', 'bulk', 'automatico_workflow'] as const;
type ValidOrigenField = typeof VALID_ORIGINS_FIELD[number];

function isValidOrigenField(v: unknown): v is ValidOrigenField {
  return typeof v === 'string' && (VALID_ORIGINS_FIELD as readonly string[]).includes(v);
}

const ORIGEN_AIRTABLE_FIELD_ID = 'fld0QZocgnG8ioHSx';

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
  const { alumnoRecordId, asunto, mensaje, templateKey, origen: origenRaw } = req.body ?? {};

  // Resolve and validate origen; default to manual_template for backward compat
  const origen: ValidOrigenField = isValidOrigenField(origenRaw) ? origenRaw : 'manual_template';
  const isQuickMode = origen === 'manual_quick';

  if (!alumnoRecordId || typeof alumnoRecordId !== 'string') {
    return res.status(400).json({ error: 'alumnoRecordId is required', field: 'alumnoRecordId' });
  }
  // asunto is required in template mode, optional in quick mode (AI will generate it)
  if (!isQuickMode && (!asunto || typeof asunto !== 'string')) {
    return res.status(400).json({ error: 'asunto is required', field: 'asunto' });
  }
  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ error: 'mensaje is required', field: 'mensaje' });
  }
  // templateKey required only in template mode
  if (!isQuickMode) {
    if (!templateKey || typeof templateKey !== 'string') {
      return res.status(400).json({ error: 'templateKey is required', field: 'templateKey' });
    }
    if (!isValidTemplateKey(templateKey)) {
      return res.status(400).json({ error: 'Invalid templateKey', field: 'templateKey' });
    }
  }

  // Write to Cola de Emails — route by DATA_SOURCE env var
  if (USE_SUPABASE) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
    }
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/cola_emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          alumno_id: alumnoRecordId,
          ...(isQuickMode ? {} : { tipo: templateKey }),
          mensaje,
          ...(asunto ? { asunto } : {}),
          estado: 'Pendiente',
          ...(origen ? { origen } : {}),
        }),
      });
      const sbData = await sbRes.json() as Array<{ id: string }> | { message: string };
      if (!sbRes.ok) {
        const errMsg = !Array.isArray(sbData) ? ((sbData as { message: string }).message ?? 'Supabase error') : 'Supabase error';
        return res.status(500).json({ error: errMsg });
      }
      const recordId = Array.isArray(sbData) ? sbData[0]?.id : undefined;
      return res.status(200).json({ id: recordId });
    } catch {
      return res.status(500).json({ error: 'Failed to create email record in Supabase' });
    }
  }

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
                ...(isQuickMode ? {} : { 'Tipo': templateKey }),
                'Mensaje': mensaje,
                ...(asunto ? { 'Asunto Generado': asunto } : {}),
                'Estado': 'Pendiente',
                [ORIGEN_AIRTABLE_FIELD_ID]: origen,
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
