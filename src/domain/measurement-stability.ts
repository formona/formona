import { buildEyebrowMetricConfidenceModel } from './face-analysis';
import { EYEBROW_METRIC_DISPLAY_COPY, EYEBROW_METRIC_DISPLAY_KEYS } from './measurement-copy';
import type {
  EyebrowMetricConfidenceModel,
  EyebrowMetrics,
  EyebrowMeasurementStabilityState,
  EyebrowPositionMetrics,
  EyebrowSidePositionMetrics,
  FaceAnalysisResult,
  MeasurementDisplayItem,
} from './types';

export interface EyebrowMeasurementStabilizerOptions {
  smoothingAlpha?: number;
  stableSampleCount?: number;
  resetDeltaMm?: number;
  maxHoldMs?: number;
  maxSampleGapMs?: number;
}

interface StabilizerState {
  analysis: FaceAnalysisResult;
  timestampMs: number;
  sampleCount: number;
}

const DEFAULT_OPTIONS = {
  smoothingAlpha: 0.35,
  stableSampleCount: 4,
  resetDeltaMm: 8,
  maxHoldMs: 250,
  maxSampleGapMs: 1000,
} satisfies Required<EyebrowMeasurementStabilizerOptions>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const smoothNumber = (previous: number, next: number, alpha: number) => (
  previous + ((next - previous) * alpha)
);

const maxMetricDelta = (previous: EyebrowMetrics, next: EyebrowMetrics) => Math.max(
  ...EYEBROW_METRIC_DISPLAY_KEYS.map((key) => Math.abs(next[key] - previous[key])),
);

const smoothMetrics = (
  previous: EyebrowMetrics,
  next: EyebrowMetrics,
  alpha: number,
): EyebrowMetrics => EYEBROW_METRIC_DISPLAY_KEYS.reduce((acc, key) => {
  acc[key] = smoothNumber(previous[key], next[key], alpha);
  return acc;
}, {} as EyebrowMetrics);

const smoothSidePosition = (
  previous: EyebrowSidePositionMetrics,
  next: EyebrowSidePositionMetrics,
  alpha: number,
): EyebrowSidePositionMetrics => ({
  browHeight: smoothNumber(previous.browHeight, next.browHeight, alpha),
  length: smoothNumber(previous.length, next.length, alpha),
  archHeight: smoothNumber(previous.archHeight, next.archHeight, alpha),
  archLocation: smoothNumber(previous.archLocation, next.archLocation, alpha),
  startToPupil: smoothNumber(previous.startToPupil, next.startToPupil, alpha),
  archToPupil: smoothNumber(previous.archToPupil, next.archToPupil, alpha),
  endToPupil: smoothNumber(previous.endToPupil, next.endToPupil, alpha),
});

const smoothEyebrowPosition = (
  previous: EyebrowPositionMetrics,
  next: EyebrowPositionMetrics,
  alpha: number,
): EyebrowPositionMetrics => ({
  left: smoothSidePosition(previous.left, next.left, alpha),
  right: smoothSidePosition(previous.right, next.right, alpha),
  browHeight: smoothNumber(previous.browHeight, next.browHeight, alpha),
  browSpacing: smoothNumber(previous.browSpacing, next.browSpacing, alpha),
  archHeight: smoothNumber(previous.archHeight, next.archHeight, alpha),
  archLocation: smoothNumber(previous.archLocation, next.archLocation, alpha),
  leftRightSymmetry: smoothNumber(previous.leftRightSymmetry, next.leftRightSymmetry, alpha),
  heightAsymmetry: smoothNumber(previous.heightAsymmetry, next.heightAsymmetry, alpha),
  lengthAsymmetry: smoothNumber(previous.lengthAsymmetry, next.lengthAsymmetry, alpha),
  archLocationAsymmetry: smoothNumber(previous.archLocationAsymmetry, next.archLocationAsymmetry, alpha),
  confidence: Math.min(previous.confidence, next.confidence),
});

const buildMeasurements = (
  metrics: EyebrowMetrics,
  metricConfidence?: EyebrowMetricConfidenceModel,
): MeasurementDisplayItem[] => EYEBROW_METRIC_DISPLAY_KEYS.map((key) => ({
  ...EYEBROW_METRIC_DISPLAY_COPY[key],
  value: `${metrics[key].toFixed(1)}mm`,
  confidence: metricConfidence?.metrics[key],
}));

const withMeasurements = (
  analysis: FaceAnalysisResult,
  metrics: EyebrowMetrics,
  eyebrowPosition: EyebrowPositionMetrics,
): FaceAnalysisResult => {
  const metricConfidence = buildEyebrowMetricConfidenceModel({
    metrics,
    pupilIpd: analysis.pupilIpd,
    alignment: analysis.alignment,
    eyebrowPosition,
    eyeGeometry: analysis.eyeGeometry,
    overlayAnchors: analysis.overlayAnchors,
  });

  return {
    ...analysis,
    metrics,
    metricConfidence,
    eyebrowPosition,
    measurements: buildMeasurements(metrics, metricConfidence),
  };
};

const markAnalysis = (
  analysis: FaceAnalysisResult,
  state: EyebrowMeasurementStabilityState,
  sampleCount: number,
  heldForMs: number,
  maxDeltaMm: number,
  smoothingAlpha: number,
): FaceAnalysisResult => ({
  ...analysis,
  measurementStability: {
    state,
    sampleCount,
    heldForMs,
    maxDeltaMm,
    smoothingAlpha,
  },
});

export const createEyebrowMeasurementStabilizer = (
  options: EyebrowMeasurementStabilizerOptions = {},
) => {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    smoothingAlpha: clamp(options.smoothingAlpha ?? DEFAULT_OPTIONS.smoothingAlpha, 0, 1),
  };
  let state: StabilizerState | null = null;

  const reset = () => {
    state = null;
  };

  const filter = (
    analysis: FaceAnalysisResult | null,
    timestampMs: number,
  ): FaceAnalysisResult | null => {
    if (!analysis) {
      if (!state) return null;

      const heldForMs = timestampMs - state.timestampMs;
      if (heldForMs < 0 || heldForMs > config.maxHoldMs) return null;

      return markAnalysis(
        state.analysis,
        'held',
        state.sampleCount,
        heldForMs,
        0,
        config.smoothingAlpha,
      );
    }

    if (
      !state
      || analysis.faceShape !== state.analysis.faceShape
      || timestampMs - state.timestampMs > config.maxSampleGapMs
    ) {
      state = {
        analysis: markAnalysis(analysis, 'warming', 1, 0, 0, config.smoothingAlpha),
        timestampMs,
        sampleCount: 1,
      };

      return state.analysis;
    }

    const deltaMm = maxMetricDelta(state.analysis.metrics, analysis.metrics);

    if (deltaMm > config.resetDeltaMm) {
      state = {
        analysis: markAnalysis(analysis, 'reset', 1, 0, deltaMm, config.smoothingAlpha),
        timestampMs,
        sampleCount: 1,
      };

      return state.analysis;
    }

    const sampleCount = state.sampleCount + 1;
    const smoothed = withMeasurements(
      analysis,
      smoothMetrics(state.analysis.metrics, analysis.metrics, config.smoothingAlpha),
      smoothEyebrowPosition(state.analysis.eyebrowPosition, analysis.eyebrowPosition, config.smoothingAlpha),
    );
    const stabilityState = sampleCount >= config.stableSampleCount ? 'stable' : 'warming';

    state = {
      analysis: markAnalysis(smoothed, stabilityState, sampleCount, 0, deltaMm, config.smoothingAlpha),
      timestampMs,
      sampleCount,
    };

    return state.analysis;
  };

  return {
    filter,
    reset,
  };
};
