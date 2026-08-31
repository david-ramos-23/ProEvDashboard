import { describe, it, expect } from 'vitest';
import { resolveRecipients, bulkTipoOptions } from './bulkTemplates';
import type { Alumno } from '@/types';

function makeAlumno(overrides: Partial<Alumno>): Alumno {
  return {
    id: 'rec1',
    nombre: 'Test Alumno',
    email: 'test@example.com',
    estadoGeneral: 'Privado',
    idioma: 'Espanol',
    edicionNombres: [],
    ...overrides,
  };
}

describe('resolveRecipients', () => {
  it('returns an empty eligible/sinEmail set for an empty input', () => {
    const result = resolveRecipients([], {});
    expect(result.eligible).toEqual([]);
    expect(result.sinEmail).toEqual([]);
  });

  it('partitions students with no email into sinEmail, excluded from eligible', () => {
    const withEmail = makeAlumno({ id: 'rec1', email: 'a@example.com' });
    const noEmail = makeAlumno({ id: 'rec2', email: '' });
    const result = resolveRecipients([withEmail, noEmail], {});
    expect(result.eligible.map(a => a.id)).toEqual(['rec1']);
    expect(result.sinEmail.map(a => a.id)).toEqual(['rec2']);
  });

  it('keeps a multi-edition student when the filter edicion is any of their editions', () => {
    const multiEdicion = makeAlumno({ id: 'rec1', edicionNombres: ['Edicion A', 'Edicion B'] });
    const otherEdicion = makeAlumno({ id: 'rec2', edicionNombres: ['Edicion C'] });
    const result = resolveRecipients([multiEdicion, otherEdicion], { edicionNombre: 'Edicion B' });
    expect(result.eligible.map(a => a.id)).toEqual(['rec1']);
  });

  it('returns all eligible students when no edicion filter is given', () => {
    const a = makeAlumno({ id: 'rec1', edicionNombres: ['Edicion A'] });
    const b = makeAlumno({ id: 'rec2', edicionNombres: ['Edicion B'] });
    const result = resolveRecipients([a, b], {});
    expect(result.eligible.map(x => x.id).sort()).toEqual(['rec1', 'rec2']);
  });
});

describe('bulkTipoOptions', () => {
  // The live select as of 2026-08-31.
  const LIVE_TIPOS = ['disculpa', 'informacion', 'recordatorio', 'seguimiento', 'bienvenida', 'felicitacion', 'urgente'];

  it('offers EVERY type in the select, not just those with a canned template', () => {
    // Regression guard. The first implementation iterated UI_TEMPLATE_OPTIONS and
    // intersected, which silently dropped informacion/bienvenida/felicitacion/
    // urgente — 3 of 7 types selectable, with nothing to indicate the loss.
    const keys = bulkTipoOptions(LIVE_TIPOS).map(o => o.key);
    expect(keys).toEqual(LIVE_TIPOS);
  });

  it('borrows a template label when one shares the type name', () => {
    const opt = bulkTipoOptions(['disculpa'])[0];
    expect(opt.labelKey).toBe('emailCompose.templates.disculpa');
  });

  it('falls back to a per-type i18n key for a type with no template', () => {
    const opt = bulkTipoOptions(['felicitacion'])[0];
    expect(opt.labelKey).toBe('bulkCompose.tipos.felicitacion');
  });

  it('offers a type added in Airtable that the code has never seen', () => {
    // Adding an option in the Airtable UI must enable it with no code change.
    const keys = bulkTipoOptions([...LIVE_TIPOS, 'libre', 'tipo_inventado']).map(o => o.key);
    expect(keys).toContain('libre');
    expect(keys).toContain('tipo_inventado');
  });

  it('returns an empty set when Tipo options are empty', () => {
    expect(bulkTipoOptions([])).toEqual([]);
  });
});
