import type { MeasurementRecord, Prisma } from '../../generated/prisma/client';
import type { MeasurementDataPayload } from '../../domain/measurement-payload';
import type { StoredMeasurementRecord } from '../../domain/measurement-records';
import { getPrisma } from './prisma';

const toNullableNumber = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const toMeasuredAtDate = (payload: MeasurementDataPayload) => {
  const measuredAt = new Date(payload.measuredAtIso);

  if (Number.isNaN(measuredAt.getTime())) {
    throw new Error('Invalid measuredAtIso.');
  }

  return measuredAt;
};

export const toStoredMeasurementRecord = (record: MeasurementRecord): StoredMeasurementRecord => ({
  id: record.id,
  savedAtIso: record.savedAt.toISOString(),
  payload: record.payload as unknown as MeasurementDataPayload,
});

export const createMeasurementRecord = async (payload: MeasurementDataPayload) => {
  const prisma = getPrisma();

  return toStoredMeasurementRecord(await prisma.measurementRecord.create({
    data: {
      measuredAt: toMeasuredAtDate(payload),
      faceShape: payload.faceShape,
      selectedStyleId: payload.selectedStyle?.id ?? null,
      selectedStyleName: payload.selectedStyle?.name ?? null,
      ipdMm: payload.ipdMm,
      reportable: payload.quality.reportable,
      overallConfidence: toNullableNumber(payload.quality.overallConfidence),
      maxEstimatedErrorMm: toNullableNumber(payload.quality.maxEstimatedErrorMm),
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  }));
};

export const listMeasurementRecords = async (take = 100) => {
  const prisma = getPrisma();

  const records = await prisma.measurementRecord.findMany({
    orderBy: { savedAt: 'desc' },
    take,
  });

  return records.map(toStoredMeasurementRecord);
};
