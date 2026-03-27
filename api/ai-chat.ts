/**
 * AI Chat API — Serverless proxy for the ProEv AI assistant.
 *
 * Uses OpenRouter (OpenAI-compatible) with function calling to query Airtable
 * tables server-side and answer questions about dashboard data.
 *
 * Required env vars: OPENROUTER_API_KEY, AIRTABLE_PAT, AIRTABLE_BASE_ID
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

// ── Auth helpers ──────────────────────────────────────────────────────────

const AUTHORIZED_USERS: Record<string, { role: string }> = {
  'andara14@gmail.com': { role: 'admin' },
  'david@dravaautomations.com': { role: 'admin' },
  'proevolutioncourse@gmail.com': { role: 'admin' },
  'alonsoynoelia17@gmail.com': { role: 'revisor' },
};
const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;
const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;

function isAuthorizedSession(email: string | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return !!AUTHORIZED_USERS[e] || TEST_USER_PATTERN.test(e) || ADMIN_ALIAS_PATTERN.test(e) || REVISOR_ALIAS_PATTERN.test(e);
}

/** Sanitize a value for safe interpolation into Airtable formulas */
function sanitizeForFormula(value: unknown): string {
  return String(value ?? '').replace(/'/g, "\\'").replace(/[\\{}()\[\]]/g, '');
}

const TABLES = {
  ALUMNOS: 'tblmfv5beVBGOZ2sb',
  REVISIONES: 'tbluWapTseCcfcfXc',
  PAGOS: 'tblWC5K2xuLr3XXQ4',
  COLA_EMAILS: 'tblVqFfucbW5POC5u',
  INBOX: 'tblyp8NSzdpnTqkPD',
};

// ── Airtable helper ────────────────────────────────────────────────────────

async function airtable(tableId: string, params?: Record<string, string>) {
  const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  return res.json();
}

async function airtablePatch(tableId: string, recordId: string, fields: Record<string, unknown>) {
  const res = await fetch(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  return res.json();
}

// ── Tool definitions (OpenAI function-calling format) ──────────────────────

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_alumnos',
      description: 'Search and list alumnos from the ProEv system. Returns name, email, estado, módulo, engagement score.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by name or email (optional)' },
          estado: { type: 'string', description: 'Filter by estado: Preinscrito, En revision de video, Aprobado, Rechazado, Pendiente de pago, Reserva, Pagado, Finalizado, Plazo Vencido, Pago Fallido, Privado' },
          limit: { type: 'number', description: 'Max results (default 10, max 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_alumno',
      description: 'Get full details of a specific alumno by Airtable record ID (starts with rec).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Airtable record ID' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_inbox',
      description: 'List inbox emails. Can filter by direction (Recibido/Enviado), estado, or requiereAtencion.',
      parameters: {
        type: 'object',
        properties: {
          direccion: { type: 'string', description: 'Recibido or Enviado' },
          requiereAtencion: { type: 'boolean', description: 'Only show emails requiring attention' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_revisiones',
      description: 'List video reviews. Optionally filter by alumno ID or estado.',
      parameters: {
        type: 'object',
        properties: {
          alumnoId: { type: 'string', description: 'Filter by alumno record ID' },
          estado: { type: 'string', description: 'Pendiente, Aprobado, Rechazado, Revision Necesaria' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pagos',
      description: 'List payment records. Optionally filter by alumno ID.',
      parameters: {
        type: 'object',
        properties: {
          alumnoId: { type: 'string', description: 'Filter by alumno record ID' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_cola_emails',
      description: 'List email queue (cola de emails). Optionally filter by estado.',
      parameters: {
        type: 'object',
        properties: {
          estado: { type: 'string', description: 'Pendiente Aprobacion, Pendiente, Enviado, Error' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_alumno_estado',
      description: 'Update the estado of an alumno. Only use when the user explicitly asks to change a status.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Airtable record ID of the alumno' },
          estado: { type: 'string', description: 'New estado value' },
        },
        required: ['id', 'estado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_email',
      description: 'Move an email in the cola from Pendiente Aprobacion to Pendiente (approved for sending). Only use when explicitly asked.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Airtable record ID of the cola email' },
        },
        required: ['id'],
      },
    },
  },
];

// ── Tool executor ──────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_alumnos': {
        const formulas: string[] = [];
        if (input.estado) formulas.push(`{Estado General} = '${sanitizeForFormula(input.estado)}'`);
        if (input.search) {
          const s = sanitizeForFormula(input.search);
          formulas.push(`OR(FIND(LOWER('${s}'), LOWER({Nombre})), FIND(LOWER('${s}'), LOWER({Email})))`);
        }
        const filterByFormula = formulas.length > 1
          ? `AND(${formulas.join(', ')})`
          : formulas[0];
        const params: Record<string, string> = {
          maxRecords: String(Math.min(Number(input.limit) || 10, 50)),
          'fields[]': 'Nombre',
          sort: JSON.stringify([{ field: 'Ultima Modificacion', direction: 'desc' }]),
        };
        if (filterByFormula) params.filterByFormula = filterByFormula;
        // Fetch multiple fields
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.ALUMNOS}`);
        url.searchParams.set('maxRecords', String(Math.min(Number(input.limit) || 10, 50)));
        if (filterByFormula) url.searchParams.set('filterByFormula', filterByFormula);
        ['Nombre', 'Email', 'Estado General', 'Modulo Solicitado', 'Engagement Score'].forEach(f =>
          url.searchParams.append('fields[]', f)
        );
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        if (!data.records) return JSON.stringify({ error: 'No records returned' });
        return JSON.stringify(data.records.map((r: Record<string, unknown>) => ({
          id: r.id,
          ...(r.fields as object),
        })));
      }

      case 'get_alumno': {
        const res = await fetch(
          `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.ALUMNOS}/${input.id}`,
          { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
        );
        const data = await res.json();
        return JSON.stringify({ id: data.id, ...data.fields });
      }

      case 'list_inbox': {
        const formulas: string[] = [];
        if (input.direccion) formulas.push(`{Direccion} = '${sanitizeForFormula(input.direccion)}'`);
        if (input.requiereAtencion) formulas.push(`{Requiere Atencion} = TRUE()`);
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.INBOX}`);
        url.searchParams.set('maxRecords', String(Number(input.limit) || 10));
        if (formulas.length > 0) url.searchParams.set('filterByFormula', formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`);
        ['Asunto', 'De', 'Para', 'Estado', 'Direccion', 'Requiere Atencion', 'Resumen IA'].forEach(f =>
          url.searchParams.append('fields[]', f)
        );
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        return JSON.stringify((data.records || []).map((r: Record<string, unknown>) => ({ id: r.id, ...(r.fields as object) })));
      }

      case 'list_revisiones': {
        const formulas: string[] = [];
        if (input.alumnoId) formulas.push(`FIND('${sanitizeForFormula(input.alumnoId)}', ARRAYJOIN({Alumno}))`);
        if (input.estado) formulas.push(`{Estado de Revisión} = '${sanitizeForFormula(input.estado)}'`);
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.REVISIONES}`);
        url.searchParams.set('maxRecords', String(Number(input.limit) || 10));
        if (formulas.length > 0) url.searchParams.set('filterByFormula', formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        return JSON.stringify((data.records || []).map((r: Record<string, unknown>) => ({ id: r.id, ...(r.fields as object) })));
      }

      case 'list_pagos': {
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.PAGOS}`);
        url.searchParams.set('maxRecords', String(Number(input.limit) || 10));
        if (input.alumnoId) url.searchParams.set('filterByFormula', `FIND('${sanitizeForFormula(input.alumnoId)}', ARRAYJOIN({Alumno}))`);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        return JSON.stringify((data.records || []).map((r: Record<string, unknown>) => ({ id: r.id, ...(r.fields as object) })));
      }

      case 'list_cola_emails': {
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.COLA_EMAILS}`);
        url.searchParams.set('maxRecords', String(Number(input.limit) || 10));
        if (input.estado) url.searchParams.set('filterByFormula', `{Estado} = '${sanitizeForFormula(input.estado)}'`);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        return JSON.stringify((data.records || []).map((r: Record<string, unknown>) => ({ id: r.id, ...(r.fields as object) })));
      }

      case 'update_alumno_estado': {
        const data = await airtablePatch(TABLES.ALUMNOS, String(input.id), { 'Estado General': input.estado });
        return JSON.stringify({ updated: true, id: data.id, estado: (data.fields as Record<string, unknown>)?.['Estado General'] });
      }

      case 'approve_email': {
        const data = await airtablePatch(TABLES.COLA_EMAILS, String(input.id), { 'Estado': 'Pendiente' });
        return JSON.stringify({ approved: true, id: data.id });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

type OAIMessage = { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Authenticate: require valid session email in header
  const sessionEmail = req.headers['x-proev-session'] as string | undefined;
  if (!isAuthorizedSession(sessionEmail)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!OPENROUTER_API_KEY || !AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing API credentials' });
  }

  const { messages, pageContext } = req.body as {
    messages: Array<{ role: string; content: string }>;
    pageContext?: string;
  };

  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const systemPrompt = `Eres el asistente de IA del dashboard ProEv, un sistema de gestión para un curso de formación profesional.

Tienes acceso a datos reales del sistema mediante herramientas (tools). Puedes:
- Buscar y ver información de alumnos
- Ver el inbox de emails entrantes/salientes
- Ver revisiones de vídeo pendientes
- Ver pagos
- Ver la cola de emails pendientes de aprobación
- Actualizar el estado de un alumno (solo si el usuario lo pide explícitamente)
- Aprobar emails en la cola (solo si el usuario lo pide explícitamente)

Para acciones de escritura (update_alumno_estado, approve_email), confirma siempre con el usuario antes de ejecutarlas, a menos que ya te haya dado instrucción explícita.

Responde siempre en el mismo idioma que el usuario (español o inglés). Sé conciso y directo.

Contexto de página actual: ${pageContext || 'Dashboard principal'}`;

  try {
    // Agentic loop using OpenAI-compatible format (OpenRouter)
    let conversationMessages: OAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];
    let finalText = '';
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://dashboard-eight-jade-69.vercel.app',
          'X-Title': 'ProEv Dashboard Assistant',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 1024,
          tools,
          messages: conversationMessages,
        }),
      });

      const data = await orRes.json();

      if (data.error) {
        return res.status(500).json({ error: data.error.message || 'OpenRouter error' });
      }

      const choice = data.choices?.[0];
      if (!choice) break;

      const assistantMsg = choice.message as OAIMessage;
      conversationMessages = [...conversationMessages, assistantMsg];

      if (choice.finish_reason === 'tool_calls' && assistantMsg.tool_calls?.length) {
        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          (assistantMsg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>).map(
            async (tc) => {
              let input: Record<string, unknown> = {};
              try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
              const result = await executeTool(tc.function.name, input);
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                name: tc.function.name,
                content: result,
              };
            }
          )
        );
        conversationMessages = [...conversationMessages, ...toolResults];
        continue;
      }

      // end_turn / stop
      finalText = typeof assistantMsg.content === 'string' ? assistantMsg.content : '';
      break;
    }

    return res.status(200).json({ text: finalText || 'No pude generar una respuesta. Intenta de nuevo.' });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ error: 'Error procesando la consulta' });
  }
}
