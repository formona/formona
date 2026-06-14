import type { MeasurementDataPayload } from './measurement-payload';
import {
  isMeasurementDataPayload,
  type StoredMeasurementRecord,
} from './measurement-records';

export const ORDER_RECORD_STORAGE_KEY = 'formona_order_records_v1';
export const MAX_ORDER_RECORDS = 100;

export type OrderStatus = 'submitted';

export interface ShippingAddressPayload {
  recipient: string;
  phone: string;
  postalCode: string;
  baseAddress: string;
  detailAddress: string;
  deliveryMemo: string;
}

export interface OrderSubmissionPayload {
  schemaVersion: 'formona.order-submission.v1';
  submittedAtIso: string;
  measurement: MeasurementDataPayload;
  shippingAddress: ShippingAddressPayload;
}

export interface OrderDataPayload {
  schemaVersion: 'formona.order.v1';
  orderedAtIso: string;
  measurementRecordId: string;
  status: OrderStatus;
  measurement: MeasurementDataPayload;
  shippingAddress: ShippingAddressPayload;
}

export interface StoredOrderRecord {
  id: string;
  orderedAtIso: string;
  measurementRecordId: string;
  status: OrderStatus;
  payload: OrderDataPayload;
  measurement: StoredMeasurementRecord;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isIsoDateString = (value: unknown) => {
  if (typeof value !== 'string') return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const isNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0
);

export const isShippingAddressPayload = (value: unknown): value is ShippingAddressPayload => (
  isObjectRecord(value)
    && isNonEmptyString(value.recipient)
    && isNonEmptyString(value.phone)
    && isNonEmptyString(value.postalCode)
    && isNonEmptyString(value.baseAddress)
    && isNonEmptyString(value.detailAddress)
    && typeof value.deliveryMemo === 'string'
);

export const isOrderSubmissionPayload = (value: unknown): value is OrderSubmissionPayload => (
  isObjectRecord(value)
    && value.schemaVersion === 'formona.order-submission.v1'
    && isIsoDateString(value.submittedAtIso)
    && isMeasurementDataPayload(value.measurement)
    && isShippingAddressPayload(value.shippingAddress)
);

export const isOrderDataPayload = (value: unknown): value is OrderDataPayload => (
  isObjectRecord(value)
    && value.schemaVersion === 'formona.order.v1'
    && isIsoDateString(value.orderedAtIso)
    && isNonEmptyString(value.measurementRecordId)
    && value.status === 'submitted'
    && isMeasurementDataPayload(value.measurement)
    && isShippingAddressPayload(value.shippingAddress)
);

export const buildOrderSubmissionPayload = ({
  measurement,
  shippingAddress,
  submittedAtIso = new Date().toISOString(),
}: {
  measurement: MeasurementDataPayload;
  shippingAddress: ShippingAddressPayload;
  submittedAtIso?: string;
}): OrderSubmissionPayload => ({
  schemaVersion: 'formona.order-submission.v1',
  submittedAtIso,
  measurement,
  shippingAddress: {
    recipient: shippingAddress.recipient.trim(),
    phone: shippingAddress.phone.trim(),
    postalCode: shippingAddress.postalCode.trim(),
    baseAddress: shippingAddress.baseAddress.trim(),
    detailAddress: shippingAddress.detailAddress.trim(),
    deliveryMemo: shippingAddress.deliveryMemo.trim(),
  },
});

export const buildOrderDataPayload = ({
  submission,
  measurementRecordId,
  orderedAtIso,
  status = 'submitted',
}: {
  submission: OrderSubmissionPayload;
  measurementRecordId: string;
  orderedAtIso: string;
  status?: OrderStatus;
}): OrderDataPayload => ({
  schemaVersion: 'formona.order.v1',
  orderedAtIso,
  measurementRecordId,
  status,
  measurement: submission.measurement,
  shippingAddress: submission.shippingAddress,
});

const isRecordLike = (value: unknown): value is StoredOrderRecord => {
  if (!isObjectRecord(value)) return false;

  return (
    typeof value.id === 'string'
    && typeof value.orderedAtIso === 'string'
    && typeof value.measurementRecordId === 'string'
    && value.status === 'submitted'
    && isOrderDataPayload(value.payload)
    && isObjectRecord(value.measurement)
    && typeof value.measurement.id === 'string'
    && typeof value.measurement.savedAtIso === 'string'
    && isMeasurementDataPayload(value.measurement.payload)
  );
};

export const parseOrderRecords = (raw: string | null | undefined): StoredOrderRecord[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isRecordLike).slice(0, MAX_ORDER_RECORDS);
  } catch {
    return [];
  }
};
