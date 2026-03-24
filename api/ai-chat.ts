/**
 * AI Chat API — Serverless proxy for the ProEv AI assistant.
 *
 * Uses Claude (claude-haiku-4-5) with tool_use to query Airtable tables
 * server-side and answer questions about dashboard data.
 *
 * Required env vars: ANTHROPIC_API_KEY, AIRTABLE_PAT, AIRTABLE_BASE_ID
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

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

// ── Tool definitions ───────────────────────────────────────────────────────

const tools = [
  {
    name: 'search_alumnos',
    description: 'Search and list alumnos from the ProEv system. Returns name, email, estado, módulo, engagement score.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by name or email (optional)' },
        estado: { type: 'string', description: 'Filter by estado: Preinscrito, En revision de video, Aprobado, Rechazado, Pendiente de pago, Reserva, Pagado, Finalizado, Plazo Vencido, Pago Fallido, Privado' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
    },
  },
  {
    name: 'get_alumno',
    description: 'Get full details of a specific alumno by Airtable record ID (starts with rec).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Airtable record ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_inbox',
    description: 'List inbox emails. Can filter by direction (Recibido/Enviado), estado, or requiereAtencion.',
    input_schema: {
      type: 'object',
      properties: {
        direccion: { type: 'string', description: 'Recibido or Enviado' },
        requiereAtencion: { type: 'boolean', description: 'Only show emails requiring attention' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'list_revisiones',
    description: 'List video reviews. Optionally filter by alumno ID or estado.',
    input_schema: {
      type: 'object',
      properties: {
        alumnoId: { type: 'string', description: 'Filter by alumno record ID' },
        estado: { type: 'string', description: 'Pendiente, Aprobado, Rechazado, Revision Necesaria' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'list_pagos',
    description: 'List payment records. Optionally filter by alumno ID.',
    input_schema: {
      type: 'object',
      properties: {
        alumnoId: { type: 'string', description: 'Filter by alumno record ID' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'list_cola_emails',
    description: 'List email queue (cola de emails). Optionally filter by estado.',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Pendiente Aprobacion, Pendiente, Enviado, Error' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'update_alumno_estado',
    description: 'Update the estado of an alumno. Only use when the user explicitly asks to change a status.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Airtable record ID of the alumno' },
        estado: { type: 'string', description: 'New estado value' },
      },
      required: ['id', 'estado'],
    },
  },
  {
    name: 'approve_email',
    description: 'Move an email in the cola from Pendiente Aprobacion to Pendiente (approved for sending). Only use when explicitly asked.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Airtable record ID of the cola email' },
      },
      required: ['id'],
    },
  },
];

// ── Tool executor ──────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_alumnos': {
        const formulas: string[] = [];
        if (input.estado) formulas.push(`{Estado General} = '${input.estado}'`);
        if (input.search) {
          const s = String(input.search).replace(/'/g, "\\'");
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
        if (input.direccion) formulas.push(`{Direccion} = '${input.direccion}'`);
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
        if (input.alumnoId) formulas.push(`FIND('${input.alumnoId}', ARRAYJOIN({Alumno}))`);
        if (input.estado) formulas.push(`{Estado de Revisión} = '${input.estado}'`);
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
        if (input.alumnoId) url.searchParams.set('filterByFormula', `FIND('${input.alumnoId}', ARRAYJOIN({Alumno}))`);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        const data = await res.json();
        return JSON.stringify((data.records || []).map((r: Record<string, unknown>) => ({ id: r.id, ...(r.fields as object) })));
      }

      case 'list_cola_emails': {
        const url = new URL(`${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${TABLES.COLA_EMAILS}`);
        url.searchParams.set('maxRecords', String(Number(input.limit) || 10));
        if (input.estado) url.searchParams.set('filterByFormula', `{Estado} = '${input.estado}'`);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!ANTHROPIC_API_KEY || !AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
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
    // Agentic loop: keep calling until end_turn
    let conversationMessages = messages.map(m => ({ role: m.role, content: m.content }));
    let finalText = '';
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages: conversationMessages,
        }),
      });

      const claudeData = await anthropicRes.json();

      if (claudeData.error) {
        return res.status(500).json({ error: claudeData.error.message });
      }

      if (claudeData.stop_reason === 'end_turn') {
        finalText = claudeData.content
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('');
        break;
      }

      if (claudeData.stop_reason === 'tool_use') {
        // Execute all tool calls and collect results
        const toolUseBlocks = claudeData.content.filter((b: { type: string }) => b.type === 'tool_use');
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block: { id: string; name: string; input: Record<string, unknown> }) => ({
            type: 'tool_result',
            tool_use_id: block.id,
            content: await executeTool(block.name, block.input),
          }))
        );

        // Add assistant message + tool results to conversation
        conversationMessages = [
          ...conversationMessages,
          { role: 'assistant', content: claudeData.content },
          { role: 'user', content: toolResults },
        ];
        continue;
      }

      // Unexpected stop reason
      break;
    }

    return res.status(200).json({ text: finalText || 'No pude generar una respuesta. Intenta de nuevo.' });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ error: 'Error procesando la consulta' });
  }
}
