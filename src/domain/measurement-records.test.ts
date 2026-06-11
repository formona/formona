import { describe, expect, it } from 'vitest';

import { analyzeFaceLandmarks } from './face-analysis';
import { EYEBROW_METRIC_FIXTURES } from './eyebrow-metric-fixtures';
import { buildMeasurementDataPayload } from './measurement-payload';
import {
  addMeasurementRecord,
  MAX_MEASUREMENT_RECORDS,
  parseMeasurementRecords,
  serializeMeasurementRecords,
} from './measurement-records';

const buildPayload = () => {
  const fixture = EYEBROW_METRIC_FIXTURES[0];
  const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

  if (!analysis) throw new Error('Expected fixture analysis');

  return buildMeasurementDataPayload({
    analysis,
    measuredAtIso: '2026-06-12T00:00:00.000Z',
  });
};

describe('measurement records', () => {
  it('serializes, parses, and prepends bounded measurement records', () => {
    const payload = buildPayload();
    const first = addMeasurementRecord([], payload, new Date('2026-06-12T00:00:00.000Z'));
    const second = addMeasurementRecord(first, payload, new Date('2026-06-12T00:01:00.000Z'));

    expect(second).toHaveLength(2);
    expect(second[0]?.savedAtIso).toBe('2026-06-12T00:01:00.000Z');
    expect(parseMeasurementRecords(serializeMeasurementRecords(second))).toEqual(second);
    expect(parseMeasurementRecords('not-json')).toEqual([]);
  });

  it('keeps only the latest maximum record count', () => {
    const payload = buildPayload();
    const records = Array.from({ length: MAX_MEASUREMENT_RECORDS + 5 }).reduce(
      (currentRecords, _, index) => addMeasurementRecord(
        currentRecords,
        payload,
        new Date(Date.UTC(2026, 5, 12, 0, index)),
      ),
      [] as ReturnType<typeof addMeasurementRecord>,
    );

    expect(records).toHaveLength(MAX_MEASUREMENT_RECORDS);
    expect(records[0]?.savedAtIso).toBe('2026-06-12T01:44:00.000Z');
  });
});
