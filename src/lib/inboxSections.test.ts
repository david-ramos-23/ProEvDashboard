import { describe, it, expect } from 'vitest';
import { isSectionType } from './inboxSections';

describe('isSectionType', () => {
  it('accepts comunicaciones', () => {
    expect(isSectionType('comunicaciones')).toBe(true);
  });

  it('accepts bandeja and cola', () => {
    expect(isSectionType('bandeja')).toBe(true);
    expect(isSectionType('cola')).toBe(true);
  });

  it('rejects an unknown string', () => {
    expect(isSectionType('archivados')).toBe(false);
  });

  it('rejects null', () => {
    expect(isSectionType(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSectionType(undefined)).toBe(false);
  });
});
