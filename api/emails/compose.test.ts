import { describe, it, expect } from 'vitest';
import { VALID_ORIGINS_FIELD } from './compose';

describe('VALID_ORIGINS_FIELD', () => {
  it('excludes the stale automatico_workflow origin', () => {
    expect(VALID_ORIGINS_FIELD).not.toContain('automatico_workflow');
  });

  it('includes bulk', () => {
    expect(VALID_ORIGINS_FIELD).toContain('bulk');
  });
});
