import { describe, expect, it } from 'vitest';

import { IPD_CONFIG } from '../constants';
import { parseValidIpd, resolveIpdFallback } from './ipd';

describe('IPD validation and fallback', () => {
  it('accepts finite values inside the supported demo range', () => {
    expect(parseValidIpd('63')).toBe(63);
    expect(parseValidIpd(' 63.4 ')).toBe(63.4);
    expect(parseValidIpd('62.56')).toBe(62.6);
    expect(parseValidIpd(IPD_CONFIG.minMm)).toBe(IPD_CONFIG.minMm);
    expect(parseValidIpd(IPD_CONFIG.maxMm)).toBe(IPD_CONFIG.maxMm);
  });

  it('rejects empty, non-finite, and out-of-range IPD values', () => {
    expect(parseValidIpd('')).toBeNull();
    expect(parseValidIpd('   ')).toBeNull();
    expect(parseValidIpd('abc')).toBeNull();
    expect(parseValidIpd(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseValidIpd(Number.NaN)).toBeNull();
    expect(parseValidIpd(IPD_CONFIG.minMm - 0.1)).toBeNull();
    expect(parseValidIpd(IPD_CONFIG.maxMm + 0.1)).toBeNull();
  });

  it('reuses the last valid IPD before falling back to the safe default', () => {
    expect(resolveIpdFallback('70', 63)).toEqual({ value: 70, source: 'input' });
    expect(resolveIpdFallback('100', 61.44)).toEqual({ value: 61.4, source: 'last-valid' });
    expect(resolveIpdFallback('100', Number.NaN)).toEqual({ value: IPD_CONFIG.defaultMm, source: 'default' });
    expect(resolveIpdFallback(null, null)).toEqual({ value: IPD_CONFIG.defaultMm, source: 'default' });
  });
});
