import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AirtableRecord } from './AirtableClient';

const createRecordMock = vi.fn();

vi.mock('./AirtableClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AirtableClient')>();
  return {
    ...actual,
    createRecord: (...args: unknown[]) => createRecordMock(...args),
  };
});

import { crearEnvio } from './EnviosEmailsAdapter';

function fakeRecord(fields: Record<string, unknown>): AirtableRecord<Record<string, unknown>> {
  return { id: 'recFake123', createdTime: '2026-08-30T00:00:00.000Z', fields };
}

describe('crearEnvio', () => {
  beforeEach(() => {
    createRecordMock.mockReset();
  });

  it('always writes Estado: Borrador, regardless of caller input', async () => {
    createRecordMock.mockImplementation((_tableId: string, fields: Record<string, unknown>) =>
      Promise.resolve(fakeRecord(fields))
    );

    await crearEnvio({
      nombre: 'Campaña de prueba',
      alumnosIds: ['rec1', 'rec2', 'rec3'],
      tipo: 'informacion',
      mensaje: 'Hola a todos',
    });

    expect(createRecordMock).toHaveBeenCalledTimes(1);
    const [, fields] = createRecordMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fields['Estado']).toBe('Borrador');
  });

  it('sets Total Emails to the number of resolved recipient IDs', async () => {
    createRecordMock.mockImplementation((_tableId: string, fields: Record<string, unknown>) =>
      Promise.resolve(fakeRecord(fields))
    );

    const alumnosIds = ['rec1', 'rec2', 'rec3', 'rec4'];
    await crearEnvio({
      nombre: 'Campaña de prueba',
      alumnosIds,
      tipo: 'informacion',
      mensaje: 'Hola a todos',
    });

    const [, fields] = createRecordMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fields['Total Emails']).toBe(alumnosIds.length);
  });
});
