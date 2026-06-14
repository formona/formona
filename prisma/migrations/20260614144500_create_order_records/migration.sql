CREATE TABLE "order_records" (
    "id" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measurementRecordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "baseAddress" TEXT NOT NULL,
    "detailAddress" TEXT NOT NULL,
    "deliveryMemo" TEXT,
    "faceShape" TEXT NOT NULL,
    "selectedStyleId" TEXT,
    "selectedStyleName" TEXT,
    "ipdMm" DOUBLE PRECISION NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "order_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_records"
ADD CONSTRAINT "order_records_measurementRecordId_fkey"
FOREIGN KEY ("measurementRecordId") REFERENCES "measurement_records"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "order_records_orderedAt_idx" ON "order_records"("orderedAt");
CREATE INDEX "order_records_measurementRecordId_idx" ON "order_records"("measurementRecordId");
CREATE INDEX "order_records_status_idx" ON "order_records"("status");
CREATE INDEX "order_records_phone_idx" ON "order_records"("phone");
