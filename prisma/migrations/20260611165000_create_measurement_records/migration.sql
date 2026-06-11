CREATE TABLE "measurement_records" (
    "id" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "faceShape" TEXT NOT NULL,
    "selectedStyleId" TEXT,
    "selectedStyleName" TEXT,
    "ipdMm" DOUBLE PRECISION NOT NULL,
    "reportable" BOOLEAN NOT NULL,
    "overallConfidence" DOUBLE PRECISION,
    "maxEstimatedErrorMm" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,

    CONSTRAINT "measurement_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "measurement_records_savedAt_idx" ON "measurement_records"("savedAt");
CREATE INDEX "measurement_records_faceShape_idx" ON "measurement_records"("faceShape");
CREATE INDEX "measurement_records_reportable_idx" ON "measurement_records"("reportable");
