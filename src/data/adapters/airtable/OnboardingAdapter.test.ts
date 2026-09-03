import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AirtableRecord } from './AirtableClient';

const listRecordsMock = vi.fn();

vi.mock('./AirtableClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AirtableClient')>();
  return {
    ...actual,
    listRecords: (...args: unknown[]) => listRecordsMock(...args),
  };
});

import { fetchOnboarding } from './OnboardingAdapter';

function fakeRecord(id: string, createdTime: string, fields: Record<string, unknown>): AirtableRecord<Record<string, unknown>> {
  return { id, createdTime, fields };
}

// Upstream field names, verbatim — misspelled at the source and intentionally
// NOT "corrected" here. If someone fixes the typo in constants.ts, this fixture
// stops matching what the adapter reads and the mapping assertions below fail.
const INSTAGRAM_CONSENT_FIELD =
  'Do you give us permission to use your Instagram account in future posts related to the course content?\n*This includes the possibility of tagging you in photos, videos, or collaborations created during the event.';

const FULL_SUBMISSION = {
  'T-Shirt Size?': 'L',
  'Kind os T-Shirt?': 'Male',
  'Name on the T-Shirt': 'Ana',
  'Languaje on the Welcome book?': '🇪🇸 Español',
  [INSTAGRAM_CONSENT_FIELD]: '✅ Yes, I give my consent',
  'Instagram username: (only if you selected "Yes")': '@ana',
  'Timestamp': '2026-09-01T10:00:00.000Z',
  'Alumnos': ['recALU1'],
};

describe('fetchOnboarding — mapping', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('maps a full submission onto all six Onboarding fields', async () => {
    listRecordsMock.mockResolvedValue([
      fakeRecord('recOB1', '2026-09-01T00:00:00.000Z', FULL_SUBMISSION),
    ]);

    const [result] = await fetchOnboarding();

    expect(result.id).toBe('recOB1');
    expect(result.alumnoId).toBe('recALU1');
    expect(result.tshirtSize).toBe('L');
    expect(result.tshirtKind).toBe('Male');
    expect(result.tshirtName).toBe('Ana');
    expect(result.welcomeBookLanguage).toBe('🇪🇸 Español');
    expect(result.instagramConsent).toBe('✅ Yes, I give my consent');
    expect(result.instagramUsername).toBe('@ana');
    expect(result.submittedAt).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('fetchOnboarding — client-side alumno filter (D-A2 regression guard)', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('filters by alumnoId client-side and never passes filterByFormula or maxRecords', async () => {
    listRecordsMock.mockResolvedValue([
      fakeRecord('recOB1', '2026-09-01T00:00:00.000Z', { ...FULL_SUBMISSION, 'Alumnos': ['recALU1'] }),
      fakeRecord('recOB2', '2026-09-02T00:00:00.000Z', { ...FULL_SUBMISSION, 'Alumnos': ['recALU2'] }),
      fakeRecord('recOB3', '2026-09-03T00:00:00.000Z', { ...FULL_SUBMISSION, 'Alumnos': ['recALU1'] }),
    ]);

    const results = await fetchOnboarding({ alumnoId: 'recALU1' });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.alumnoId === 'recALU1')).toBe(true);

    expect(listRecordsMock).toHaveBeenCalledTimes(1);
    const [, options] = listRecordsMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(options?.filterByFormula).toBeUndefined();
    expect(options?.maxRecords).toBeUndefined();
  });
});

describe('fetchOnboarding — latest-by-Timestamp tie-break', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('sorts newest-first even when the source array is oldest-first', async () => {
    listRecordsMock.mockResolvedValue([
      fakeRecord('recOB1', '2026-08-01T00:00:00.000Z', { ...FULL_SUBMISSION, 'Timestamp': '2026-08-01T10:00:00.000Z' }),
      fakeRecord('recOB2', '2026-09-01T00:00:00.000Z', { ...FULL_SUBMISSION, 'Timestamp': '2026-09-01T10:00:00.000Z' }),
    ]);

    const results = await fetchOnboarding();

    expect(results[0].id).toBe('recOB2');
    expect(results[0].submittedAt).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('fetchOnboarding — empty result', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('returns an empty array without throwing', async () => {
    listRecordsMock.mockResolvedValue([]);

    const results = await fetchOnboarding();

    expect(results).toEqual([]);
  });
});

describe('fetchOnboarding — missing alumno link', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('maps to an empty alumnoId and excludes the record from a student filter', async () => {
    listRecordsMock.mockResolvedValue([
      fakeRecord('recOB1', '2026-09-01T00:00:00.000Z', { ...FULL_SUBMISSION, 'Alumnos': undefined }),
    ]);

    const all = await fetchOnboarding();
    expect(all[0].alumnoId).toBe('');

    const filtered = await fetchOnboarding({ alumnoId: 'recALU1' });
    expect(filtered).toEqual([]);
  });
});

describe('fetchOnboarding — sparse submission', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
  });

  it('leaves unanswered fields undefined and falls back submittedAt to createdTime', async () => {
    listRecordsMock.mockResolvedValue([
      fakeRecord('recOB1', '2026-09-01T00:00:00.000Z', { 'T-Shirt Size?': 'M' }),
    ]);

    const [result] = await fetchOnboarding();

    expect(result.tshirtSize).toBe('M');
    expect(result.tshirtKind).toBeUndefined();
    expect(result.tshirtName).toBeUndefined();
    expect(result.welcomeBookLanguage).toBeUndefined();
    expect(result.instagramConsent).toBeUndefined();
    expect(result.instagramUsername).toBeUndefined();
    expect(result.submittedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});
