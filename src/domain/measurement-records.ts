import type { MeasurementDataPayload } from './measurement-payload';

export const MEASUREMENT_RECORD_STORAGE_KEY = 'formona_measurement_records_v1';
export const MAX_MEASUREMENT_RECORDS = 100;

export interface StoredMeasurementRecord {
  id: string;
  savedAtIso: string;
  payload: MeasurementDataPayload;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value)
);

const isIsoDateString = (value: unknown) => {
  if (typeof value !== 'string') return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

export const isMeasurementDataPayload = (value: unknown): value is MeasurementDataPayload => {
  if (!isObjectRecord(value)) return false;

  const selectedStyle = value.selectedStyle;
  const pupilIpd = value.pupilIpd;
  const quality = value.quality;

  return (
    value.schemaVersion === 'formona.measurement.v1'
    && isIsoDateString(value.measuredAtIso)
    && typeof value.faceShape === 'string'
    && (
      selectedStyle === null
      || (
        isObjectRecord(selectedStyle)
        && typeof selectedStyle.id === 'string'
        && typeof selectedStyle.name === 'string'
      )
    )
    && isFiniteNumber(value.ipdMm)
    && isFiniteNumber(value.pxToMmScale)
    && isObjectRecord(pupilIpd)
    && Array.isArray(value.metrics)
    && value.metrics.length > 0
    && isObjectRecord(value.goldenRatioGuides)
    && isObjectRecord(value.overlayAnchors)
    && isObjectRecord(quality)
    && typeof quality.reportable === 'boolean'
    && typeof quality.alignmentReady === 'boolean'
  );
};

const isRecordLike = (value: unknown): value is StoredMeasurementRecord => {
  if (!value || typeof value !== 'object') return false;

  const record = value as Partial<StoredMeasurementRecord>;

  return (
    typeof record.id === 'string'
    && typeof record.savedAtIso === 'string'
    && isMeasurementDataPayload(record.payload)
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
