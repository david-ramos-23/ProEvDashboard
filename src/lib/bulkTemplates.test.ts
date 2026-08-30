import { describe, it, expect } from 'vitest';
import { resolveRecipients, bulkTemplateOptions } from './bulkTemplates';
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

describe('bulkTemplateOptions', () => {
  it('excludes libre when Tipo options do not include it', () => {
    const options = bulkTemplateOptions(['disculpa', 'informacion', 'recordatorio', 'seguimiento', 'bienvenida', 'felicitacion', 'urgente']);
    expect(options.map(o => o.key)).not.toContain('libre');
  });

  it('includes libre once it appears in the live Tipo options', () => {
    const options = bulkTemplateOptions(['disculpa', 'libre']);
    expect(options.map(o => o.key)).toContain('libre');
  });

  it('returns an empty set when Tipo options are empty', () => {
    expect(bulkTemplateOptions([])).toEqual([]);
  });
});
