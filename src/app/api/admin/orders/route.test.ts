import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_DEMO_AUTH_CONFIG } from '../../../../constants';
import type { StoredOrderRecord } from '../../../../domain/order-records';
import { GET } from './route';

const databaseMock = vi.hoisted(() => ({
  listOrderRecords: vi.fn(),
}));

vi.mock('../../../../infrastructure/database/order-records', () => databaseMock);

const records: StoredOrderRecord[] = [
  {
    id: 'order-1',
    orderedAtIso: '2026-06-12T00:03:00.000Z',
    measurementRecordId: 'measurement-1',
    status: 'submitted',
    payload: {
      schemaVersion: 'formona.order.v1',
      orderedAtIso: '2026-06-12T00:03:00.000Z',
      measurementRecordId: 'measurement-1',
      status: 'submitted',
      shippingAddress: {
        recipient: '홍길동',
        phone: '010-1234-5678',
        postalCode: '06142',
        baseAddress: '서울 강남구 테헤란로 123',
        detailAddress: '101동 1203호',
        deliveryMemo: '문 앞에 놓아주세요',
      },
      measurement: {
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
        metrics: [{ key: 'sp', label: 'SP', description: 'SP', valueMm: 10, displayValue: '10.0mm', reportable: true, confidence: null, estimatedErrorMm: null }],
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
    measurement: {
      id: 'measurement-1',
      savedAtIso: '2026-06-12T00:02:00.000Z',
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
        metrics: [{ key: 'sp', label: 'SP', description: 'SP', valueMm: 10, displayValue: '10.0mm', reportable: true, confidence: null, estimatedErrorMm: null }],
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
  },
];

describe('GET /api/admin/orders', () => {
  beforeEach(() => {
    databaseMock.listOrderRecords.mockReset();
    databaseMock.listOrderRecords.mockResolvedValue(records);
    vi.unstubAllEnvs();
  });

  it('rejects requests without the admin passcode header', async () => {
    const response = await GET(new Request('http://localhost/api/admin/orders'));

    expect(response.status).toBe(401);
    expect(databaseMock.listOrderRecords).not.toHaveBeenCalled();
  });

  it('returns order records when the server admin passcode matches', async () => {
    vi.stubEnv('FORMONA_ADMIN_PASSCODE', 'server-passcode');

    const response = await GET(new Request('http://localhost/api/admin/orders', {
      headers: {
        'x-formona-admin-passcode': 'server-passcode',
      },
    }));

    await expect(response.json()).resolves.toEqual({ records });
    expect(response.status).toBe(200);
    expect(databaseMock.listOrderRecords).toHaveBeenCalledTimes(1);
  });

  it('uses the demo passcode when no server passcode is configured', async () => {
    const response = await GET(new Request('http://localhost/api/admin/orders', {
      headers: {
        'x-formona-admin-passcode': ADMIN_DEMO_AUTH_CONFIG.defaultPasscode,
      },
    }));

    expect(response.status).toBe(200);
    expect(databaseMock.listOrderRecords).toHaveBeenCalledTimes(1);
  });
});
