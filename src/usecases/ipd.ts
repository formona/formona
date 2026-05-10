import { IPD_CONFIG } from '../constants';

export type IpdFallbackSource = 'input' | 'last-valid' | 'default';

export type IpdResolution = {
  value: number;
  source: IpdFallbackSource;
};

export const parseValidIpd = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) return null;
  if (parsed < IPD_CONFIG.minMm || parsed > IPD_CONFIG.maxMm) return null;

  return Number(parsed.toFixed(1));
};

export const resolveIpdFallback = (
  candidate: string | number | null | undefined,
  lastValidIpd?: number | null,
): IpdResolution => {
  const parsedCandidate = parseValidIpd(candidate);
  if (parsedCandidate !== null) {
    return { value: parsedCandidate, source: 'input' };
  }

  const parsedLastValid = parseValidIpd(lastValidIpd);
  if (parsedLastValid !== null) {
    return { value: parsedLastValid, source: 'last-valid' };
  }

  return { value: IPD_CONFIG.defaultMm, source: 'default' };
};
