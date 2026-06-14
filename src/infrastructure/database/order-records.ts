import type { MeasurementRecord, OrderRecord, Prisma } from '../../generated/prisma/client';
import type { MeasurementDataPayload } from '../../domain/measurement-payload';
import {
  buildOrderDataPayload,
  type OrderSubmissionPayload,
  type StoredOrderRecord,
} from '../../domain/order-records';
import { toStoredMeasurementRecord } from './measurement-records';
import { getPrisma } from './prisma';

type OrderRecordWithMeasurement = OrderRecord & {
  measurementRecord: MeasurementRecord;
};

const toNullableNumber = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const toDate = (iso: string, label: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }

  return date;
};

const buildMeasurementRecordData = (payload: MeasurementDataPayload) => ({
  measuredAt: toDate(payload.measuredAtIso, 'measuredAtIso'),
  faceShape: payload.faceShape,
  selectedStyleId: payload.selectedStyle?.id ?? null,
  selectedStyleName: payload.selectedStyle?.name ?? null,
  ipdMm: payload.ipdMm,
  reportable: payload.quality.reportable,
  overallConfidence: toNullableNumber(payload.quality.overallConfidence),
  maxEstimatedErrorMm: toNullableNumber(payload.quality.maxEstimatedErrorMm),
  payload: payload as unknown as Prisma.InputJsonValue,
});

export const toStoredOrderRecord = (record: OrderRecordWithMeasurement): StoredOrderRecord => ({
  id: record.id,
  orderedAtIso: record.orderedAt.toISOString(),
  measurementRecordId: record.measurementRecordId,
  status: 'submitted',
  payload: record.payload as unknown as StoredOrderRecord['payload'],
  measurement: toStoredMeasurementRecord(record.measurementRecord),
});

export const createOrderRecord = async (submission: OrderSubmissionPayload) => {
  const prisma = getPrisma();

  return prisma.$transaction(async (transaction) => {
    const measurementRecord = await transaction.measurementRecord.create({
      data: buildMeasurementRecordData(submission.measurement),
    });
    const orderedAt = toDate(submission.submittedAtIso, 'submittedAtIso');
    const payload = buildOrderDataPayload({
      submission,
      measurementRecordId: measurementRecord.id,
      orderedAtIso: orderedAt.toISOString(),
    });
    const orderRecord = await transaction.orderRecord.create({
      data: {
        orderedAt,
        measurementRecordId: measurementRecord.id,
        status: payload.status,
        recipient: submission.shippingAddress.recipient,
        phone: submission.shippingAddress.phone,
        postalCode: submission.shippingAddress.postalCode,
        baseAddress: submission.shippingAddress.baseAddress,
        detailAddress: submission.shippingAddress.detailAddress,
        deliveryMemo: submission.shippingAddress.deliveryMemo || null,
        faceShape: submission.measurement.faceShape,
        selectedStyleId: submission.measurement.selectedStyle?.id ?? null,
        selectedStyleName: submission.measurement.selectedStyle?.name ?? null,
        ipdMm: submission.measurement.ipdMm,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      include: {
        measurementRecord: true,
      },
    });

    return toStoredOrderRecord(orderRecord);
  });
};

export const listOrderRecords = async (take = 100) => {
  const prisma = getPrisma();

  const records = await prisma.orderRecord.findMany({
    orderBy: { orderedAt: 'desc' },
    take,
    include: {
      measurementRecord: true,
    },
  });

  return records.map(toStoredOrderRecord);
};
