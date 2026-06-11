import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeFaceLandmarks } from '../../../domain/face-analysis';
import { EYEBROW_METRIC_FIXTURES } from '../../../domain/eyebrow-metric-fixtures';
import { buildMeasurementDataPayload } from '../../../domain/measurement-payload';
import type { StoredMeasurementRecord } from '../../../domain/measurement-records';
import { POST } from './route';

const databaseMock = vi.hoisted(() => ({
  createMeasurementRecord: vi.fn(),
}));

vi.mock('../../../infrastructure/database/measurement-records', () => databaseMock);

const buildPayload = () => {
  const fixture = EYEBROW_METRIC_FIXTURES[0];
  const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

  if (!analysis) throw new Error('Expected fixture analysis');

  return buildMeasurementDataPayload({
    analysis,
    measuredAtIso: '2026-06-12T00:00:00.000Z',
  });
};

describe('POST /api/measurements', () => {
  beforeEach(() => {
    databaseMock.createMeasurementRecord.mockReset();
  });

  it('persists a valid measurement payload', async () => {
    const payload = buildPayload();
    const record: StoredMeasurementRecord = {
      id: 'measurement-1',
      savedAtIso: '2026-06-12T00:01:00.000Z',
      payload,
    };
    databaseMock.createMeasurementRecord.mockResolvedValue(record);

    const response = await POST(new Request('http://localhost/api/measurements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    await expect(response.json()).resolves.toEqual({ record });
    expect(response.status).toBe(201);
    expect(databaseMock.createMeasurementRecord).toHaveBeenCalledWith(payload);
  });

  it('rejects an invalid measurement payload', async () => {
    const response = await POST(new Request('http://localhost/api/measurements', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: 'wrong' }),
    }));

    expect(response.status).toBe(400);
    expect(databaseMock.createMeasurementRecord).not.toHaveBeenCalled();
  });
});
