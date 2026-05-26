import { describe, expect, it } from 'vitest';
import { provinceForIp } from '../server/geo.js';

describe('geo province mapping', () => {
  it('renders Chinese region abbreviations as province names', () => {
    expect(provinceForIp('111.37.19.212')).toBe('山东');
  });
});
