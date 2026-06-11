import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_DEMO_AUTH_CONFIG } from '../../../../constants';
import type { StoredMeasurementRecord } from '../../../../domain/measurement-records';
import { GET } from './route';

const databaseMock = vi.hoisted(() => ({
  listMeasurementRecords: vi.fn(),
}));

vi.mock('../../../../infrastructure/database/measurement-records', () => databaseMock);

const records: StoredMeasurementRecord[] = [
  {
    id: 'measurement-1',
    savedAtIso: '2026-06-12T00:01:00.000Z',
    payload: {
      schemaVersion: 'formona.measurement.v1',
      measuredAtIso: '2026-06-12T00:00:00.000Z',
      faceShape: '계란형',
      selectedStyle: null,
      ipdMm: 63,
      pxToMmScale: 0.3,
      pupilIpd: {
        source: 'iris',
        ipdPx: 210,
        normalizedIpd: 0.2,
        confidence: 1,
      },
      metrics: [],
      goldenRatioGuides: {},
      overlayAnchors: {},
      quality: {
        overallConfidence: 1,
        maxEstimatedErrorMm: 0,
        reportable: true,
        alignmentReady: true,
      },
    },
  },
];

describe('GET /api/admin/measurements', () => {
  beforeEach(() => {
    databaseMock.listMeasurementRecords.mockReset();
    databaseMock.listMeasurementRecords.mockResolvedValue(records);
    vi.unstubAllEnvs();
  });

  it('rejects requests without the admin passcode header', async () => {
    const response = await GET(new Request('http://localhost/api/admin/measurements'));

    expect(response.status).toBe(401);
    expect(databaseMock.listMeasurementRecords).not.toHaveBeenCalled();
  });

  it('returns records when the server admin passcode matches', async () => {
    vi.stubEnv('FORMONA_ADMIN_PASSCODE', 'server-passcode');

    const response = await GET(new Request('http://localhost/api/admin/measurements', {
      headers: {
        'x-formona-admin-passcode': 'server-passcode',
      },
    }));

    await expect(response.json()).resolves.toEqual({ records });
    expect(response.status).toBe(200);
    expect(databaseMock.listMeasurementRecords).toHaveBeenCalledTimes(1);
  });

  it('uses the demo passcode when no server passcode is configured', async () => {
    const response = await GET(new Request('http://localhost/api/admin/measurements', {
      headers: {
        'x-formona-admin-passcode': ADMIN_DEMO_AUTH_CONFIG.defaultPasscode,
      },
    }));

    expect(response.status).toBe(200);
    expect(databaseMock.listMeasurementRecords).toHaveBeenCalledTimes(1);
  });
});
