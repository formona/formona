import type { MeasurementDataPayload } from './measurement-payload';

export const MEASUREMENT_RECORD_STORAGE_KEY = 'formona_measurement_records_v1';
export const MAX_MEASUREMENT_RECORDS = 100;

export interface StoredMeasurementRecord {
  id: string;
  savedAtIso: string;
  payload: MeasurementDataPayload;
}

const isRecordLike = (value: unknown): value is StoredMeasurementRecord => {
  if (!value || typeof value !== 'object') return false;

  const record = value as Partial<StoredMeasurementRecord>;
  const payload = record.payload as Partial<MeasurementDataPayload> | undefined;

  return (
    typeof record.id === 'string'
    && typeof record.savedAtIso === 'string'
    && Boolean(payload)
    && payload?.schemaVersion === 'formona.measurement.v1'
    && typeof payload?.measuredAtIso === 'string'
    && Array.isArray(payload?.metrics)
  );
};

export const parseMeasurementRecords = (raw: string | null | undefined): StoredMeasurementRecord[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isRecordLike).slice(0, MAX_MEASUREMENT_RECORDS);
  } catch {
    return [];
  }
};

export const serializeMeasurementRecords = (records: StoredMeasurementRecord[]) => (
  JSON.stringify(records.slice(0, MAX_MEASUREMENT_RECORDS))
);

export const addMeasurementRecord = (
  records: StoredMeasurementRecord[],
  payload: MeasurementDataPayload,
  savedAt = new Date(),
): StoredMeasurementRecord[] => {
  const savedAtIso = savedAt.toISOString();
  const nextRecord: StoredMeasurementRecord = {
    id: `measurement-${savedAt.getTime()}-${records.length + 1}`,
    savedAtIso,
    payload,
  };

  return [nextRecord, ...records].slice(0, MAX_MEASUREMENT_RECORDS);
};
