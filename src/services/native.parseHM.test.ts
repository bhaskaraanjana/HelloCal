import { describe, it, expect } from 'vitest';
import { parseHM } from './native';

describe('parseHM', () => {
  it('parses valid 24h times', () => {
    expect(parseHM('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseHM('4:05')).toEqual({ hour: 4, minute: 5 });
    expect(parseHM('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseHM('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('rejects out-of-range or malformed values', () => {
    expect(parseHM('24:00')).toBeNull();
    expect(parseHM('12:60')).toBeNull();
    expect(parseHM('8')).toBeNull();
    expect(parseHM('ab:cd')).toBeNull();
    expect(parseHM('')).toBeNull();
    expect(parseHM('-1:30')).toBeNull();
  });
});
