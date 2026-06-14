import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeFaceLandmarks } from '../../../domain/face-analysis';
import { EYEBROW_METRIC_FIXTURES } from '../../../domain/eyebrow-metric-fixtures';
import { buildMeasurementDataPayload } from '../../../domain/measurement-payload';
import {
  buildOrderDataPayload,
  buildOrderSubmissionPayload,
  type StoredOrderRecord,
} from '../../../domain/order-records';
import { POST } from './route';

const databaseMock = vi.hoisted(() => ({
  createOrderRecord: vi.fn(),
}));

vi.mock('../../../infrastructure/database/order-records', () => databaseMock);

const buildPayload = () => {
  const fixture = EYEBROW_METRIC_FIXTURES[0];
  const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

  if (!analysis) throw new Error('Expected fixture analysis');

  return buildOrderSubmissionPayload({
    submittedAtIso: '2026-06-12T00:02:00.000Z',
    measurement: buildMeasurementDataPayload({
      analysis,
      measuredAtIso: '2026-06-12T00:00:00.000Z',
    }),
    shippingAddress: {
      recipient: '홍길동',
      phone: '010-1234-5678',
      postalCode: '06142',
      baseAddress: '서울 강남구 테헤란로 123',
      detailAddress: '101동 1203호',
      deliveryMemo: '문 앞에 놓아주세요',
    },
  });
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    databaseMock.createOrderRecord.mockReset();
  });

  it('persists a valid order submission payload', async () => {
    const payload = buildPayload();
    const record: StoredOrderRecord = {
      id: 'order-1',
      orderedAtIso: payload.submittedAtIso,
      measurementRecordId: 'measurement-1',
      status: 'submitted',
      payload: buildOrderDataPayload({
        submission: payload,
        measurementRecordId: 'measurement-1',
        orderedAtIso: payload.submittedAtIso,
      }),
      measurement: {
        id: 'measurement-1',
        savedAtIso: '2026-06-12T00:02:00.000Z',
        payload: payload.measurement,
      },
    };
    databaseMock.createOrderRecord.mockResolvedValue(record);

    const response = await POST(new Request('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    await expect(response.json()).resolves.toEqual({ record });
    expect(response.status).toBe(201);
    expect(databaseMock.createOrderRecord).toHaveBeenCalledWith(payload);
  });

  it('rejects an invalid order payload', async () => {
    const response = await POST(new Request('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: 'wrong' }),
    }));

    expect(response.status).toBe(400);
    expect(databaseMock.createOrderRecord).not.toHaveBeenCalled();
  });
});
