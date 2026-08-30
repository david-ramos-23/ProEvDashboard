/**
 * Integration test: twin parity. The same logical input to `crearEnvio` on both
 * backends must produce an identical `EnvioEmail` shape (field values, not id/createdTime,
 * which are inherently source-specific).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AirtableRecord } from './airtable/AirtableClient';

const airtableCreateRecordMock = vi.fn();
vi.mock('./airtable/AirtableClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./airtable/AirtableClient')>();
  return {
    ...actual,
    createRecord: (...args: unknown[]) => airtableCreateRecordMock(...args),
  };
});

const supabaseSingleMock = vi.fn();
vi.mock('./supabase/SupabaseClient', () => ({
  supabase: {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => supabaseSingleMock(),
        }),
      }),
    }),
  },
  withAudit: async (fn: () => unknown) => fn(),
}));

import { crearEnvio as crearEnvioAirtable } from './airtable/EnviosEmailsAdapter';
import { crearEnvio as crearEnvioSupabase } from './supabase/EnviosEmailsAdapter';

const input = {
  nombre: 'Campaña de prueba',
  alumnosIds: ['rec1', 'rec2', 'rec3'],
  tipo: 'informacion',
  mensaje: 'Hola a todos',
  descripcion: 'Nota interna',
};

describe('EnviosEmailsAdapter twin parity', () => {
  beforeEach(() => {
    airtableCreateRecordMock.mockReset();
    supabaseSingleMock.mockReset();
  });

  it('produces the same EnvioEmail field values from both backends for the same input', async () => {
    airtableCreateRecordMock.mockImplementation((_tableId: string, fields: Record<string, unknown>) =>
      Promise.resolve({
        id: 'recFake',
        createdTime: '2026-08-30T00:00:00.000Z',
        fields,
      } satisfies AirtableRecord<Record<string, unknown>>)
    );

    supabaseSingleMock.mockResolvedValue({
      data: {
        id: 'uuid-fake',
        created_at: '2026-08-30T00:00:00.000Z',
        nombre: input.nombre,
        alumnos_ids: input.alumnosIds,
        tipo: input.tipo,
        mensaje: input.mensaje,
        descripcion: input.descripcion,
        estado: 'Borrador',
        total_emails: input.alumnosIds.length,
        emails_creados: null,
        fecha_completado: null,
      },
      error: null,
    });

    const fromAirtable = await crearEnvioAirtable(input);
    const fromSupabase = await crearEnvioSupabase(input);

    const strip = (envio: typeof fromAirtable) => {
      const rest: Partial<typeof envio> = { ...envio };
      delete rest.id;
      delete rest.createdTime;
      return rest;
    };

    expect(strip(fromAirtable)).toEqual(strip(fromSupabase));
    expect(fromAirtable.estado).toBe('Borrador');
    expect(fromSupabase.estado).toBe('Borrador');
    expect(fromAirtable.totalEmails).toBe(input.alumnosIds.length);
    expect(fromSupabase.totalEmails).toBe(input.alumnosIds.length);
  });
});
