import { assert, describe, expect, it } from 'vitest';

import {
  analyzeFaceLandmarks,
  extractFaceDimensions,
} from './face-analysis';
import { EYEBROW_METRIC_DISPLAY_ROWS } from './measurement-copy';
import {
  getReferenceValidationFixture,
  REFERENCE_VALIDATION_FIXTURES,
  type FaceMeasurementMm,
  type ReferenceValidationFixture,
} from './reference-validation-fixtures';
import type {
  EyebrowMetricConfidence,
  EyebrowMetricKey,
  EyebrowMetrics,
  FaceDimensions,
  VideoDimensions,
} from './types';

const REQUIRED_METRIC_TARGET_TOLERANCE_MM = 3;
const REQUIRED_METRIC_MAX_TOLERANCE_MM = 5;

const toFaceMeasurementMm = (
  dimensions: FaceDimensions,
  videoDimensions: VideoDimensions,
  pxToMmScale: number,
): FaceMeasurementMm => ({
  faceWidth: dimensions.faceWidth * videoDimensions.width * pxToMmScale,
  faceHeight: dimensions.faceHeight * videoDimensions.height * pxToMmScale,
  foreheadWidth: dimensions.foreheadWidth * videoDimensions.width * pxToMmScale,
  cheekWidth: dimensions.cheekWidth * videoDimensions.width * pxToMmScale,
  jawWidth: dimensions.jawWidth * videoDimensions.width * pxToMmScale,
});

const expectFaceMeasurementsCloseTo = (
  actual: FaceMeasurementMm,
  expected: FaceMeasurementMm,
  toleranceMm: number,
) => {
  expect(actual.faceWidth).toBeCloseTo(expected.faceWidth, 1);
  expect(actual.faceHeight).toBeCloseTo(expected.faceHeight, 1);
  expect(actual.foreheadWidth).toBeCloseTo(expected.foreheadWidth, 1);
  expect(actual.cheekWidth).toBeCloseTo(expected.cheekWidth, 1);
  expect(actual.jawWidth).toBeCloseTo(expected.jawWidth, 1);

  for (const key of Object.keys(expected) as (keyof FaceMeasurementMm)[]) {
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(toleranceMm);
  }
};

const getEstimatedErrorMm = (
  value: EyebrowMetricConfidence | number | undefined,
) => {
  if (typeof value === 'number') return value;

  return value?.estimatedErrorMm;
};

const expectEyebrowMetricsWithinTolerance = ({
  fixtureId,
  actual,
  expected,
  fixtureToleranceMm,
  estimatedErrorsMm = {},
}: {
  fixtureId: string;
  actual: EyebrowMetrics;
  expected: EyebrowMetrics;
  fixtureToleranceMm: number;
  estimatedErrorsMm?: Partial<Record<EyebrowMetricKey, EyebrowMetricConfidence | number>>;
}) => {
  const toleranceMm = Math.min(fixtureToleranceMm, REQUIRED_METRIC_MAX_TOLERANCE_MM);
  const failures = EYEBROW_METRIC_DISPLAY_ROWS
    .map((row) => {
      const actualValue = actual[row.key];
      const expectedValue = expected[row.key];
      const deltaMm = Math.abs(actualValue - expectedValue);

      return {
        key: row.key,
        label: row.label,
        actualValue,
        expectedValue,
        deltaMm,
        estimatedErrorMm: getEstimatedErrorMm(estimatedErrorsMm[row.key]),
      };
    })
    .filter((item) => item.deltaMm > toleranceMm);

  if (failures.length === 0) return;

  assert.fail([
    `Eyebrow metrics out of range for ${fixtureId}.`,
    `Required tolerance: +/-${REQUIRED_METRIC_TARGET_TOLERANCE_MM}-${REQUIRED_METRIC_MAX_TOLERANCE_MM}mm; fixture tolerance: +/-${fixtureToleranceMm}mm; applied tolerance: +/-${toleranceMm}mm.`,
    ...failures.map((failure) => {
      const estimatedErrorText = typeof failure.estimatedErrorMm === 'number'
        ? `, estimated error +/-${failure.estimatedErrorMm.toFixed(1)}mm`
        : '';

      return [
        `${failure.label} (${failure.key})`,
        `expected ${failure.expectedValue.toFixed(1)}mm`,
        `actual ${failure.actualValue.toFixed(1)}mm`,
        `delta ${failure.deltaMm.toFixed(1)}mm`,
        `limit ${toleranceMm.toFixed(1)}mm${estimatedErrorText}`,
      ].join(': ');
    }),
  ].join('\n'));
};

describe('reference validation fixtures', () => {
  it('contains reusable known landmark inputs with expected face and eyebrow mm outputs', () => {
    expect(REFERENCE_VALIDATION_FIXTURES.length).toBeGreaterThanOrEqual(2);

    for (const fixture of REFERENCE_VALIDATION_FIXTURES) {
      expect(fixture.landmarks).toHaveLength(478);
      expect(fixture.ipdMm).toBeGreaterThan(0);
      expect(fixture.expected.pxToMmScale).toBeGreaterThan(0);
      expect(Object.values(fixture.expected.faceMm).every((value) => value > 0)).toBe(true);
      expect(Object.values(fixture.expected.eyebrowMm).every((value) => value > 0)).toBe(true);
      expect(fixture.rationale).toEqual(expect.any(String));
    }
  });

  it.each(REFERENCE_VALIDATION_FIXTURES)(
    'validates $id against the real FaceMesh analysis pipeline',
    ({ id, landmarks, ipdMm, dimensions, expected, toleranceMm }: ReferenceValidationFixture) => {
      const result = analyzeFaceLandmarks(landmarks, ipdMm, dimensions);
      const extractedDimensions = extractFaceDimensions(landmarks);

      expect(result).not.toBeNull();
      expect(extractedDimensions).not.toBeNull();
      expect(result?.faceShape).toBe(expected.faceShape);
      expect(result?.pupilIpd.source).toBe(expected.pupilSource);
      expect(result?.pxToMmScale).toBeCloseTo(expected.pxToMmScale, 5);
      expect(result?.measurements).toHaveLength(7);

      expectFaceMeasurementsCloseTo(
        toFaceMeasurementMm(extractedDimensions!, dimensions, result!.pxToMmScale),
        expected.faceMm,
        toleranceMm,
      );
      expectEyebrowMetricsWithinTolerance({
        fixtureId: id,
        actual: result!.metrics,
        expected: expected.eyebrowMm,
        fixtureToleranceMm: toleranceMm,
        estimatedErrorsMm: result!.metricConfidence?.metrics,
      });
    },
  );

  it.each(REFERENCE_VALIDATION_FIXTURES)(
    'validates demo eyebrow measurement rows for $id',
    ({ id, landmarks, ipdMm, dimensions, expected, toleranceMm }: ReferenceValidationFixture) => {
      const result = analyzeFaceLandmarks(landmarks, ipdMm, dimensions);

      expect(result).not.toBeNull();
      expect(result?.measurements).toHaveLength(EYEBROW_METRIC_DISPLAY_ROWS.length);
      expect(result?.metricConfidence?.reportable).toBe(true);

      EYEBROW_METRIC_DISPLAY_ROWS.forEach((row, index) => {
        const measurement = result!.measurements[index];

        expect(measurement).toMatchObject({
          label: row.label,
          description: row.description,
          value: `${result!.metrics[row.key].toFixed(1)}mm`,
        });
        expect(measurement.confidence).toMatchObject({
          key: row.key,
          reportable: true,
        });
        expect(measurement.confidence?.estimatedErrorMm).toBeLessThanOrEqual(REQUIRED_METRIC_MAX_TOLERANCE_MM);
      });
      expectEyebrowMetricsWithinTolerance({
        fixtureId: id,
        actual: result!.metrics,
        expected: expected.eyebrowMm,
        fixtureToleranceMm: toleranceMm,
        estimatedErrorsMm: result!.metricConfidence?.metrics,
      });
    },
  );

  it('reports clear out-of-range eyebrow metric failures', () => {
    const fixture = REFERENCE_VALIDATION_FIXTURES[0];
    let failureMessage = '';

    try {
      expectEyebrowMetricsWithinTolerance({
        fixtureId: fixture.id,
        actual: {
          ...fixture.expected.eyebrowMm,
          hp: fixture.expected.eyebrowMm.hp + REQUIRED_METRIC_MAX_TOLERANCE_MM + 0.6,
        },
        expected: fixture.expected.eyebrowMm,
        fixtureToleranceMm: REQUIRED_METRIC_MAX_TOLERANCE_MM,
        estimatedErrorsMm: { hp: REQUIRED_METRIC_MAX_TOLERANCE_MM },
      });
    } catch (error) {
      failureMessage = error instanceof Error ? error.message : String(error);
    }

    expect(failureMessage).toContain(`Eyebrow metrics out of range for ${fixture.id}.`);
    expect(failureMessage).toContain(`Required tolerance: +/-${REQUIRED_METRIC_TARGET_TOLERANCE_MM}-${REQUIRED_METRIC_MAX_TOLERANCE_MM}mm`);
    expect(failureMessage).toContain('눈썹 최고점 (HP) (hp)');
    expect(failureMessage).toContain('delta 5.6mm');
    expect(failureMessage).toContain('limit 5.0mm');
    expect(failureMessage).toContain('estimated error +/-5.0mm');
  });

  it('returns reference fixtures by stable id', () => {
    for (const fixture of REFERENCE_VALIDATION_FIXTURES) {
      expect(getReferenceValidationFixture(fixture.id)).toBe(fixture);
    }

    expect(getReferenceValidationFixture('missing-reference')).toBeNull();
  });
});
