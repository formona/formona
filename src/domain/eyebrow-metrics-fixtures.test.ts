import { describe, expect, it } from 'vitest';

import {
  analyzeFaceLandmarks,
  buildEyebrowMetricConfidenceModel,
  EYEBROW_METRIC_CONFIDENCE_THRESHOLDS,
  extractEyebrowPositionMetrics,
  extractPupilIpd,
  hasUsableEyebrowMetricInputs,
  validateLandmarkFrame,
} from './face-analysis';
import { extractFaceFeatureLandmarks } from './face-landmarks';
import {
  EYEBROW_METRIC_FIXTURES,
  type EyebrowMetricFixture,
  makeLowConfidenceEyebrowMetricLandmarks,
  makeOutOfFrameEyebrowMetricLandmarks,
} from './eyebrow-metric-fixtures';
import { createEyebrowMeasurementStabilizer } from './measurement-stability';
import type {
  EyebrowMetricConfidenceBand,
  EyebrowMetricConfidenceReason,
} from './types';

interface MeasurementValidationCase {
  state: string;
  confidence: number;
  ready: boolean;
  reportable: boolean;
  band: EyebrowMetricConfidenceBand;
  maxError: number;
  reasons: EyebrowMetricConfidenceReason[];
}

describe('eyebrow metric landmark fixtures', () => {
  it.each(EYEBROW_METRIC_FIXTURES)(
    'calculates the seven displayed brow metrics for $id',
    ({ landmarks, ipdMm, dimensions, expected }: EyebrowMetricFixture) => {
      const result = analyzeFaceLandmarks(landmarks, ipdMm, dimensions);

      expect(result).not.toBeNull();
      expect(result?.pupilIpd.source).toBe(expected.source);
      expect(result?.pxToMmScale).toBeCloseTo(expected.pxToMmScale, 5);
      expect(result?.measurements).toHaveLength(7);
      expect(result?.metricConfidence).toMatchObject({
        targetErrorMm: EYEBROW_METRIC_CONFIDENCE_THRESHOLDS.targetErrorMm,
        eligibilityErrorMm: EYEBROW_METRIC_CONFIDENCE_THRESHOLDS.eligibilityErrorMm,
        minReportableConfidence: EYEBROW_METRIC_CONFIDENCE_THRESHOLDS.minReportableConfidence,
        highConfidence: EYEBROW_METRIC_CONFIDENCE_THRESHOLDS.highConfidence,
        reportable: true,
      });
      expect(result?.metricConfidence?.maxEstimatedErrorMm).toBeLessThanOrEqual(5);
      expect(result?.metricConfidence?.metrics.totalLength.estimatedErrorMm).toBeLessThanOrEqual(3);
      expect(result?.metricConfidence?.metrics.totalLength.band).toBe('target');
      expect(result?.measurements.every((item) => item.confidence?.reportable)).toBe(true);
      expect(result?.metrics.sp).toBeCloseTo(expected.sp, 1);
      expect(result?.metrics.hp).toBeCloseTo(expected.hp, 1);
      expect(result?.metrics.ep).toBeCloseTo(expected.ep, 1);
      expect(result?.metrics.totalLength).toBeCloseTo(expected.totalLength, 1);
      expect(result?.metrics.thickness).toBeCloseTo(expected.thickness, 1);
      expect(result?.metrics.archHeight).toBeCloseTo(expected.archHeight, 1);
      expect(result?.metrics.gap).toBeCloseTo(expected.gap, 1);
      expect(result?.measurements.map((item) => item.value)).toEqual([
        `${result?.metrics.sp.toFixed(1)}mm`,
        `${result?.metrics.hp.toFixed(1)}mm`,
        `${result?.metrics.ep.toFixed(1)}mm`,
        `${result?.metrics.totalLength.toFixed(1)}mm`,
        `${result?.metrics.thickness.toFixed(1)}mm`,
        `${result?.metrics.archHeight.toFixed(1)}mm`,
        `${result?.metrics.gap.toFixed(1)}mm`,
      ]);
      expect(hasUsableEyebrowMetricInputs(
        landmarks,
        result?.pupilIpd ?? null,
        result?.pxToMmScale ?? 0,
        dimensions,
      )).toBe(true);
    },
  );

  it('captures asymmetry from representative landmarks without dropping the analysis', () => {
    const balanced = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[0].landmarks,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );
    const asymmetric = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[1].landmarks,
      EYEBROW_METRIC_FIXTURES[1].ipdMm,
      EYEBROW_METRIC_FIXTURES[1].dimensions,
    );

    expect(balanced).not.toBeNull();
    expect(asymmetric).not.toBeNull();
    expect(balanced?.eyebrowPosition.leftRightSymmetry).toBeCloseTo(100, 4);
    expect(asymmetric?.eyebrowPosition.leftRightSymmetry).toBeLessThan(96);
    expect(asymmetric?.eyebrowPosition.heightAsymmetry).toBeGreaterThan(0);
    expect(asymmetric?.eyebrowPosition.lengthAsymmetry).toBeGreaterThan(0);
    expect(asymmetric?.metrics.totalLength).toBeGreaterThan(balanced?.metrics.totalLength ?? 0);
    expect(asymmetric?.metrics.archHeight).toBeGreaterThan(balanced?.metrics.archHeight ?? 0);
  });

  it('rejects out-of-frame landmarks and marks low-confidence metric landmarks ineligible', () => {
    const outOfFrame = makeOutOfFrameEyebrowMetricLandmarks();
    const lowConfidence = makeLowConfidenceEyebrowMetricLandmarks();
    const pupilIpd = extractPupilIpd(
      lowConfidence,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );

    expect(validateLandmarkFrame(extractFaceFeatureLandmarks(outOfFrame))).toMatchObject({
      valid: false,
      reason: 'missing_eyebrow_landmarks',
      missingRequiredIndices: [55],
    });
    expect(analyzeFaceLandmarks(
      outOfFrame,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    )).toBeNull();

    expect(validateLandmarkFrame(extractFaceFeatureLandmarks(lowConfidence))).toMatchObject({
      valid: true,
      reason: null,
      confidence: 0.45,
    });
    expect(pupilIpd).not.toBeNull();
    expect(hasUsableEyebrowMetricInputs(
      lowConfidence,
      pupilIpd!,
      EYEBROW_METRIC_FIXTURES[0].expected.pxToMmScale,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    )).toBe(true);
    expect(extractEyebrowPositionMetrics(
      lowConfidence,
      pupilIpd!,
      EYEBROW_METRIC_FIXTURES[0].expected.pxToMmScale,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    )).not.toBeNull();
    const lowConfidenceAnalysis = analyzeFaceLandmarks(
      lowConfidence,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );
    expect(lowConfidenceAnalysis).not.toBeNull();
    expect(lowConfidenceAnalysis?.metricConfidence.reportable).toBe(false);
  });

  it('marks eyebrow metric reporting ineligible when expected error exceeds the 5mm threshold', () => {
    const result = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[0].landmarks,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );

    expect(result).not.toBeNull();

    const confidence = buildEyebrowMetricConfidenceModel({
      metrics: result!.metrics,
      pupilIpd: { ...result!.pupilIpd, confidence: 0.72 },
      alignment: { ...result!.alignment, confidence: 0.72, ready: false },
      eyebrowPosition: { ...result!.eyebrowPosition, confidence: 0.72 },
      eyeGeometry: { ...result!.eyeGeometry, confidence: 0.72 },
      overlayAnchors: { ...result!.overlayAnchors, confidence: 0.72 },
    });

    expect(confidence.reportable).toBe(false);
    expect(confidence.metrics.totalLength.reportable).toBe(false);
    expect(confidence.metrics.totalLength.band).toBe('ineligible');
    expect(confidence.metrics.totalLength.estimatedErrorMm).toBeGreaterThan(5);
  });

  it.each([
    {
      state: 'stable',
      confidence: 1,
      ready: true,
      reportable: true,
      band: 'target',
      maxError: 3,
      reasons: ['stable_iris_scale', 'alignment_stable', 'landmarks_stable'],
    },
    {
      state: 'unstable',
      confidence: 0.8,
      ready: false,
      reportable: true,
      band: 'eligible',
      maxError: 5,
      reasons: ['stable_iris_scale', 'alignment_unstable', 'landmarks_unstable'],
    },
    {
      state: 'low-confidence',
      confidence: 0.72,
      ready: false,
      reportable: false,
      band: 'ineligible',
      maxError: Number.POSITIVE_INFINITY,
      reasons: ['stable_iris_scale', 'alignment_unstable', 'landmarks_unstable'],
    },
  ] as MeasurementValidationCase[])(
    'classifies $state eyebrow measurement validation for debug gating',
    ({
      confidence: inputConfidence,
      ready,
      reportable,
      band,
      maxError,
      reasons,
    }: MeasurementValidationCase) => {
      const result = analyzeFaceLandmarks(
        EYEBROW_METRIC_FIXTURES[0].landmarks,
        EYEBROW_METRIC_FIXTURES[0].ipdMm,
        EYEBROW_METRIC_FIXTURES[0].dimensions,
      );

      expect(result).not.toBeNull();

      const confidence = buildEyebrowMetricConfidenceModel({
        metrics: result!.metrics,
        pupilIpd: { ...result!.pupilIpd, confidence: inputConfidence },
        alignment: { ...result!.alignment, confidence: inputConfidence, ready },
        eyebrowPosition: { ...result!.eyebrowPosition, confidence: inputConfidence },
        eyeGeometry: { ...result!.eyeGeometry, confidence: inputConfidence },
        overlayAnchors: { ...result!.overlayAnchors, confidence: inputConfidence },
      });
      const metricStates = Object.values(confidence.metrics);

      expect(confidence.overallConfidence).toBe(inputConfidence);
      expect(confidence.reportable).toBe(reportable);
      expect(confidence.maxEstimatedErrorMm).toBeLessThanOrEqual(maxError);
      expect(metricStates.every((metric) => metric.reportable === reportable)).toBe(true);
      expect(metricStates.every((metric) => metric.band === band)).toBe(true);
      expect(confidence.metrics.totalLength.reasons).toEqual(expect.arrayContaining(reasons));
    },
  );

  it('smooths small frame-to-frame FaceMesh eyebrow measurement jitter', () => {
    const stabilizer = createEyebrowMeasurementStabilizer({
      smoothingAlpha: 0.35,
      stableSampleCount: 3,
      resetDeltaMm: 8,
    });
    const baseline = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[0].landmarks,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );
    const jittered = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[1].landmarks,
      EYEBROW_METRIC_FIXTURES[1].ipdMm,
      EYEBROW_METRIC_FIXTURES[1].dimensions,
    );

    expect(baseline).not.toBeNull();
    expect(jittered).not.toBeNull();

    const first = stabilizer.filter(baseline, 0);
    const second = stabilizer.filter(jittered, 33);
    const third = stabilizer.filter(jittered, 66);

    expect(first?.measurementStability).toMatchObject({ state: 'warming', sampleCount: 1 });
    expect(second?.measurementStability).toMatchObject({ state: 'warming', sampleCount: 2 });
    expect(third?.measurementStability).toMatchObject({ state: 'stable', sampleCount: 3 });
    expect(second?.metrics.totalLength).toBeGreaterThan(baseline!.metrics.totalLength);
    expect(second?.metrics.totalLength).toBeLessThan(jittered!.metrics.totalLength);
    expect(second?.measurements.map((item) => item.value)).toEqual([
      `${second?.metrics.sp.toFixed(1)}mm`,
      `${second?.metrics.hp.toFixed(1)}mm`,
      `${second?.metrics.ep.toFixed(1)}mm`,
      `${second?.metrics.totalLength.toFixed(1)}mm`,
      `${second?.metrics.thickness.toFixed(1)}mm`,
      `${second?.metrics.archHeight.toFixed(1)}mm`,
      `${second?.metrics.gap.toFixed(1)}mm`,
    ]);
  });

  it('holds the recent stable eyebrow measurements through a brief iris dropout', () => {
    const stabilizer = createEyebrowMeasurementStabilizer({ maxHoldMs: 250 });
    const baseline = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[0].landmarks,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );

    expect(baseline).not.toBeNull();

    const first = stabilizer.filter(baseline, 1000);
    const held = stabilizer.filter(null, 1190);
    const expired = stabilizer.filter(null, 1260);

    expect(first?.measurementStability?.state).toBe('warming');
    expect(held?.measurementStability).toMatchObject({
      state: 'held',
      heldForMs: 190,
    });
    expect(held?.metrics).toEqual(first?.metrics);
    expect(expired).toBeNull();
  });

  it('resets instead of smoothing when eyebrow metrics jump beyond the temporal stability threshold', () => {
    const stabilizer = createEyebrowMeasurementStabilizer({ resetDeltaMm: 1 });
    const baseline = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[0].landmarks,
      EYEBROW_METRIC_FIXTURES[0].ipdMm,
      EYEBROW_METRIC_FIXTURES[0].dimensions,
    );
    const changed = analyzeFaceLandmarks(
      EYEBROW_METRIC_FIXTURES[1].landmarks,
      EYEBROW_METRIC_FIXTURES[1].ipdMm,
      EYEBROW_METRIC_FIXTURES[1].dimensions,
    );

    expect(baseline).not.toBeNull();
    expect(changed).not.toBeNull();

    stabilizer.filter(baseline, 0);
    const reset = stabilizer.filter(changed, 33);

    expect(reset?.measurementStability?.state).toBe('reset');
    expect(reset?.metrics).toEqual(changed?.metrics);
    expect(reset?.measurementStability?.maxDeltaMm).toBeGreaterThan(1);
  });
});
