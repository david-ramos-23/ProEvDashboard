import { describe, it, expect } from 'vitest';
import { promedioEngagement } from './engagement';
import { ESTADO } from '@/utils/constants';

describe('promedioEngagement', () => {
  it('averages active students and prospects', () => {
    expect(promedioEngagement([
      { estado: ESTADO.PAGADO, score: 90 },
      { estado: ESTADO.PREINSCRITO, score: 70 },
    ])).toBe(80);
  });

  it('excludes Rechazado from the average', () => {
    // Without the filter a perfect Rechazado would pull the average to 75.
    expect(promedioEngagement([
      { estado: ESTADO.PAGADO, score: 50 },
      { estado: ESTADO.RECHAZADO, score: 100 },
    ])).toBe(50);
  });

  it('excludes Privado from the average', () => {
    // Test/internal records live here and must not move the KPI.
    expect(promedioEngagement([
      { estado: ESTADO.PAGADO, score: 50 },
      { estado: ESTADO.PRIVADO, score: 100 },
    ])).toBe(50);
  });

  it('keeps Finalizado — they are real students', () => {
    expect(promedioEngagement([
      { estado: ESTADO.PAGADO, score: 100 },
      { estado: ESTADO.FINALIZADO, score: 50 },
    ])).toBe(75);
  });

  it('skips missing scores instead of counting them as zero', () => {
    expect(promedioEngagement([
      { estado: ESTADO.PAGADO, score: 80 },
      { estado: ESTADO.APROBADO, score: null },
      { estado: ESTADO.RESERVA, score: undefined },
    ])).toBe(80);
  });

  it('returns 0 when nothing qualifies', () => {
    expect(promedioEngagement([])).toBe(0);
    expect(promedioEngagement([{ estado: ESTADO.RECHAZADO, score: 100 }])).toBe(0);
  });
});
