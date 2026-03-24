/**
 * Cliente base para la API REST de Airtable.
 *
 * In production, calls go through /api/airtable/ serverless proxy (PAT stays server-side).
 * In development, calls go directly to Airtable API using VITE_ env vars.
 *
 * Rate limit del plan free: 5 requests/segundo.
 */

const USE_PROXY = import.meta.env.PROD || !import.meta.env.VITE_AIRTABLE_PAT;
const DIRECT_BASE_URL = 'https://api.airtable.com/v0';
const PROXY_BASE_URL = '/api/airtable';
const PAT = import.meta.env.VITE_AIRTABLE_PAT;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

/** Respuesta genérica de Airtable */
interface AirtableResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

/** Registro individual de Airtable */
export interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

/** Opciones para listar registros */
export interface ListOptions {
  filterByFormula?: string;
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  maxRecords?: number;
  pageSize?: number;
  view?: string;
  fields?: string[];
}

/** Cola simple para respetar rate limits (5 req/s) */
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 210; // ~5 req/s con margen

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Realiza una petición autenticada a la API de Airtable.
 */
async function airtableFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  await throttle();

  const url = endpoint.startsWith('http')
    ? endpoint
    : USE_PROXY
      ? `${PROXY_BASE_URL}/${endpoint}`
      : `${DIRECT_BASE_URL}/${BASE_ID}/${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!USE_PROXY && PAT) {
    headers['Authorization'] = `Bearer ${PAT}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers as Record<string, string>,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Airtable API Error ${response.status}: ${error?.error?.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Lista todos los registros de una tabla con paginación automática.
 * Recoge todas las páginas usando el offset de Airtable.
 */
export async function listRecords<T>(
  tableId: string,
  options: ListOptions = {}
): Promise<AirtableRecord<T>[]> {
  const allRecords: AirtableRecord<T>[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula);
    if (options.maxRecords) params.set('maxRecords', String(options.maxRecords));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.view) params.set('view', options.view);
    if (offset) params.set('offset', offset);

    // Sort params
    options.sort?.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction);
    });

    // Fields
    options.fields?.forEach(f => params.append('fields[]', f));

    const query = params.toString();
    const url = `${tableId}${query ? `?${query}` : ''}`;
    
    const response = await airtableFetch<AirtableResponse<T>>(url);
    allRecords.push(...response.records);
    offset = response.offset;

    // Parar si alcanzamos maxRecords
    if (options.maxRecords && allRecords.length >= options.maxRecords) {
      break;
    }
  } while (offset);

  return options.maxRecords ? allRecords.slice(0, options.maxRecords) : allRecords;
}

/**
 * Obtiene un registro individual por ID.
 */
export async function getRecord<T>(
  tableId: string,
  recordId: string
): Promise<AirtableRecord<T>> {
  return airtableFetch<AirtableRecord<T>>(`${tableId}/${recordId}`);
}

/**
 * Actualiza campos de un registro existente (PATCH).
 * Solo envía los campos que se quieren cambiar.
 */
export async function updateRecord<T>(
  tableId: string,
  recordId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  return airtableFetch<AirtableRecord<T>>(`${tableId}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
}

/**
 * Crea un nuevo registro en una tabla.
 */
export async function createRecord<T>(
  tableId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const response = await airtableFetch<{ records: AirtableRecord<T>[] }>(tableId, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  return response.records[0];
}
