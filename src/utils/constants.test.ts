import { describe, it, expect } from 'vitest';
import { ORIGEN_COLORS } from './constants';

describe('ORIGEN_COLORS', () => {
  it('resolves a defined color for the bulk origin', () => {
    expect(ORIGEN_COLORS['bulk']).toBeDefined();
    expect(typeof ORIGEN_COLORS['bulk']).toBe('string');
  });
});
