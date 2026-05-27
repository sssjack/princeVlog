import { describe, expect, it } from 'vitest';
import { locationForIp, provinceForIp } from '../server/geo.js';

describe('geo province mapping', () => {
  it('renders Chinese region abbreviations as province names', () => {
    expect(provinceForIp('111.37.19.212')).toBe('山东');
  });

  it('returns country and province for visit analytics', () => {
    expect(locationForIp('111.37.19.212')).toMatchObject({
      country: '中国',
      province: '山东'
    });
  });
});
