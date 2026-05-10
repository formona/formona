import { describe, expect, it } from 'vitest';

import {
  buildEyebrowRecommendationContext,
  buildEyebrowRecommendationState,
  buildEyebrowRecommendationStateFromContext,
  getEyebrowRecommendations,
  validateEyebrowRecommendationContext,
} from './recommendations';
import {
  FaceShape,
  type EyebrowStyle,
  type EyebrowOverlayAnchors,
  type EyebrowRecommendationContext,
  type FaceAlignment,
  type FaceAnalysisResult,
} from './types';

const EXPECTED_RECOMMENDATION_NAMES: Record<FaceShape, [string, string, string]> = {
  [FaceShape.OVAL]: ['자연 아치형', '직선형', '부드러운 곡선형'],
  [FaceShape.SQUARE]: ['부드러운 아치형', '곡선형', '라운드형'],
  [FaceShape.ROUND]: ['각진 아치형', '상승형', '직선 각형'],
  [FaceShape.HEART]: ['직선 수평형', '부드러운 직선형', '낮은 아치형'],
};

const hasRenderablePreview = (style: EyebrowStyle) => (
  style.id.length > 0
  && style.name.length > 0
  && style.description.length > 0
  && style.path.startsWith('M')
);

const readyAlignment: FaceAlignment = {
  detected: true,
  centered: true,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  guidance: '정면 위치가 안정적입니다',
  confidence: 0.9,
  ready: true,
};

const mockOverlayAnchors: EyebrowOverlayAnchors = {
  left: {
    sp: { x: 0.44, y: 0.35 },
    hp: { x: 0.38, y: 0.31, source: 'iris' },
    ep: { x: 0.28, y: 0.35 },
    confidence: 1,
  },
  right: {
    sp: { x: 0.56, y: 0.35 },
    hp: { x: 0.62, y: 0.31, source: 'iris' },
    ep: { x: 0.72, y: 0.35 },
    confidence: 1,
  },
  confidence: 1,
  transform: {
    origin: { x: 0.5, y: 0.45 },
    scale: 0.24,
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
  },
};

const makeRecommendationContext = (
  metrics: Partial<EyebrowRecommendationContext['metrics']> = {},
  faceShape = FaceShape.ROUND,
): EyebrowRecommendationContext => {
  const completeMetrics = {
    sp: 18.2,
    hp: 33.4,
    ep: 49.1,
    totalLength: 52,
    thickness: 6.2,
    archHeight: 7.3,
    gap: 21,
    ...metrics,
  };

  return {
    faceShape,
    normalizedGeometry: {
      faceWidth: 0.54,
      faceHeight: 0.68,
      jawWidth: 0.28,
      cheekWidth: 0.54,
      foreheadWidth: 0.4,
      heightToWidth: 0.68 / 0.54,
      jawToCheek: 0.28 / 0.54,
      foreheadToCheek: 0.4 / 0.54,
      cheekToFaceWidth: 1,
    },
    metrics: completeMetrics,
    eyebrowPosition: {
      left: {
        browHeight: 17.5,
        length: completeMetrics.totalLength,
        archHeight: completeMetrics.archHeight,
        archLocation: 0.48,
        startToPupil: completeMetrics.sp,
        archToPupil: completeMetrics.hp,
        endToPupil: completeMetrics.ep,
      },
      right: {
        browHeight: 17.1,
        length: completeMetrics.totalLength,
        archHeight: completeMetrics.archHeight,
        archLocation: 0.5,
        startToPupil: completeMetrics.sp,
        archToPupil: completeMetrics.hp,
        endToPupil: completeMetrics.ep,
      },
      browHeight: 17.3,
      browSpacing: completeMetrics.gap,
      archHeight: completeMetrics.archHeight,
      archLocation: 0.49,
      leftRightSymmetry: 98.6,
      heightAsymmetry: 0.02,
      lengthAsymmetry: 0.004,
      archLocationAsymmetry: 0.02,
      confidence: 1,
    },
    eyeGeometry: {
      left: {
        width: 21,
        height: 18.7,
        tiltDegrees: 0,
      },
      right: {
        width: 21,
        height: 18.7,
        tiltDegrees: 0,
      },
      eyeWidth: 21,
      eyeHeight: 18.7,
      eyeTiltDegrees: 0,
      interEyeSpacing: 42,
      confidence: 1,
    },
    ipdMm: 63,
    pxToMmScale: 63 / 216,
  };
};

describe('eyebrow recommendations', () => {
  it('returns exactly three documented eyebrow styles for each MVP face shape', () => {
    for (const faceShape of Object.values(FaceShape)) {
      const recommendations = getEyebrowRecommendations(faceShape);

      expect(recommendations).toHaveLength(3);
      expect(recommendations.map((style) => style.name)).toEqual(EXPECTED_RECOMMENDATION_NAMES[faceShape]);
      expect(new Set(recommendations.map((style) => style.id))).toHaveProperty('size', 3);
      expect(recommendations.every(hasRenderablePreview)).toBe(true);
    }
  });

  it('preserves calculated analysis metrics in a typed recommendation context', () => {
    const analysis: FaceAnalysisResult = {
      faceShape: FaceShape.ROUND,
      faceDimensions: {
        faceWidth: 0.54,
        faceHeight: 0.68,
        jawWidth: 0.28,
        cheekWidth: 0.54,
        foreheadWidth: 0.4,
      },
      normalizedGeometry: {
        faceWidth: 0.54,
        faceHeight: 0.68,
        jawWidth: 0.28,
        cheekWidth: 0.54,
        foreheadWidth: 0.4,
        heightToWidth: 0.68 / 0.54,
        jawToCheek: 0.28 / 0.54,
        foreheadToCheek: 0.4 / 0.54,
        cheekToFaceWidth: 1,
      },
      proportionMetrics: {
        faceHeightToWidth: 0.68 / 0.54,
        faceWidthToHeight: 0.54 / 0.68,
        foreheadToFaceWidth: 0.4 / 0.54,
        cheekToFaceWidth: 1,
        jawToFaceWidth: 0.28 / 0.54,
        foreheadToCheek: 0.4 / 0.54,
        jawToCheek: 0.28 / 0.54,
        averageBrowToEye: 0.12,
        browToEyeHeight: 3,
        browToFaceHeight: 0.12 / 0.68,
        browGapToFaceWidth: 0.16 / 0.54,
        browLengthToFaceWidth: 0.24,
        archHeightToFaceHeight: 0,
        eyeHeightToFaceHeight: 0.04 / 0.68,
        eyeWidthToFaceWidth: 0.08 / 0.54,
        interEyeToFaceWidth: 0.16 / 0.54,
        confidence: 1,
      },
      faceCoordinateSpace: {
        origin: { x: 0.5, y: 0.43 },
        scale: 0.2,
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        rotationRadians: 0,
        rotationDegrees: 0,
        confidence: 1,
        landmarks: Array.from({ length: 478 }, () => ({ x: 0, y: 0 })),
      },
      measurements: [
        { label: 'SP', value: '18.2mm' },
        { label: 'HP', value: '33.4mm' },
        { label: 'EP', value: '49.1mm' },
        { label: '전체 길이', value: '50.2mm' },
        { label: '두께', value: '6.1mm' },
        { label: '아치 높이', value: '7.3mm' },
        { label: '미간 간격', value: '21.0mm' },
      ],
      metrics: {
        sp: 18.2,
        hp: 33.4,
        ep: 49.1,
        totalLength: 50.2,
        thickness: 6.1,
        archHeight: 7.3,
        gap: 21,
      },
      eyebrowPosition: {
        left: {
          browHeight: 17.5,
          length: 50.1,
          archHeight: 7.1,
          archLocation: 0.48,
          startToPupil: 18.3,
          archToPupil: 33.2,
          endToPupil: 49.4,
        },
        right: {
          browHeight: 17.1,
          length: 50.3,
          archHeight: 7.5,
          archLocation: 0.5,
          startToPupil: 18.1,
          archToPupil: 33.6,
          endToPupil: 48.8,
        },
        browHeight: 17.3,
        browSpacing: 21,
        archHeight: 7.3,
        archLocation: 0.49,
        leftRightSymmetry: 98.6,
        heightAsymmetry: 0.02,
        lengthAsymmetry: 0.004,
        archLocationAsymmetry: 0.02,
        confidence: 1,
      },
      eyeGeometry: {
        left: {
          width: 21,
          height: 18.7,
          tiltDegrees: 0,
        },
        right: {
          width: 21,
          height: 18.7,
          tiltDegrees: 0,
        },
        eyeWidth: 21,
        eyeHeight: 18.7,
        eyeTiltDegrees: 0,
        interEyeSpacing: 42,
        confidence: 1,
      },
      ipdMm: 63,
      pupilIpd: {
        leftPupil: { x: 0.4, y: 0.43 },
        rightPupil: { x: 0.6, y: 0.43 },
        leftPupilPx: { x: 432, y: 825.6 },
        rightPupilPx: { x: 648, y: 825.6 },
        ipdPx: 216,
        normalizedIpd: 0.2,
        source: 'iris',
        confidence: 1,
      },
      pxToMmScale: 63 / 216,
      alignment: readyAlignment,
      overlayAnchors: mockOverlayAnchors,
      overlay: {
        left: 'M10,20 Q50,10 90,20',
        right: 'M10,20 Q50,10 90,20',
        viewBox: '0 0 100 100',
      },
    };

    const context = buildEyebrowRecommendationContext(analysis);

    expect(context.metrics).toEqual(analysis.metrics);
    expect(context.pxToMmScale).toBe(63 / 216);
    expect(getEyebrowRecommendations(context).map((style) => style.name)).toEqual(
      EXPECTED_RECOMMENDATION_NAMES[FaceShape.ROUND],
    );
  });

  it('changes same-face-shape recommendation priority from calculated eyebrow metrics', () => {
    const lowArchNarrowGapContext = makeRecommendationContext({
      totalLength: 56,
      archHeight: 4.2,
      gap: 16,
      thickness: 6.2,
    });
    const highArchWideGapContext = makeRecommendationContext({
      totalLength: 52,
      archHeight: 12,
      gap: 25,
      thickness: 6.4,
    });

    const lowArchState = buildEyebrowRecommendationStateFromContext(lowArchNarrowGapContext);
    const highArchState = buildEyebrowRecommendationStateFromContext(highArchWideGapContext);

    expect(lowArchState.status).toBe('ready');
    expect(highArchState.status).toBe('ready');
    expect(lowArchState.context?.metrics).toEqual(lowArchNarrowGapContext.metrics);
    expect(highArchState.context?.metrics).toEqual(highArchWideGapContext.metrics);
    expect(lowArchState.recommendations.map((style) => style.id)).toEqual([
      'angular_arch',
      'upward',
      'straight_angular',
    ]);
    expect(highArchState.recommendations.map((style) => style.id)).toEqual([
      'straight_angular',
      'angular_arch',
      'upward',
    ]);
    expect(getEyebrowRecommendations(lowArchNarrowGapContext)[0]?.id).not.toBe(
      getEyebrowRecommendations(highArchWideGapContext)[0]?.id,
    );
  });

  it('ranks styles from metric context across low/high arch, gap, and thickness signals', () => {
    const ovalThickLowArchContext = makeRecommendationContext({
      totalLength: 42,
      thickness: 7.2,
      archHeight: 4,
      gap: 16,
    }, FaceShape.OVAL);
    const squareHighArchWideGapContext = makeRecommendationContext({
      totalLength: 52,
      thickness: 6.2,
      archHeight: 12,
      gap: 25,
    }, FaceShape.SQUARE);
    const heartWideGapContext = makeRecommendationContext({
      totalLength: 52,
      thickness: 6.2,
      archHeight: 7,
      gap: 25,
    }, FaceShape.HEART);

    expect(getEyebrowRecommendations(ovalThickLowArchContext).map((style) => style.id)).toEqual([
      'natural_arch',
      'soft_curve',
      'straight',
    ]);
    expect(getEyebrowRecommendations(squareHighArchWideGapContext).map((style) => style.id)).toEqual([
      'soft_arch',
      'curved',
      'round',
    ]);
    expect(getEyebrowRecommendations(heartWideGapContext)[0]?.id).toBe('straight_horizontal');
  });

  it('returns explicit validation states for every missing recommendation prerequisite', () => {
    const readyContext = makeRecommendationContext();
    const incompleteMetricsContext = {
      ...readyContext,
      metrics: {
        ...readyContext.metrics,
      },
    };
    delete incompleteMetricsContext.metrics.gap;

    expect(buildEyebrowRecommendationState(null).status).toBe('loading');
    expect(buildEyebrowRecommendationStateFromContext(null).validation.reason).toBe('missing_analysis');
    expect(validateEyebrowRecommendationContext(incompleteMetricsContext).reason).toBe('missing_metrics');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      metrics: {
        ...readyContext.metrics,
        sp: 0,
      },
    }).reason).toBe('invalid_metrics');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      normalizedGeometry: {
        ...readyContext.normalizedGeometry,
        faceWidth: 0,
      },
    }).reason).toBe('missing_geometry');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      pxToMmScale: Number.NaN,
    }).reason).toBe('missing_scale');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      metricConfidence: {
        targetErrorMm: 3,
        eligibilityErrorMm: 5,
        minReportableConfidence: 0.75,
        highConfidence: 0.85,
        overallConfidence: 0.72,
        maxEstimatedErrorMm: 5.6,
        reportable: false,
        metrics: {},
      },
    }).reason).toBe('low_confidence');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      eyebrowPosition: null,
    }).reason).toBe('low_confidence');
    expect(validateEyebrowRecommendationContext({
      ...readyContext,
      eyeGeometry: {
        ...readyContext.eyeGeometry,
        confidence: 0,
      },
    }).reason).toBe('low_confidence');
  });

  it('returns an explicit error state instead of recommendations when calculated metrics are invalid', () => {
    const readyAnalysis = {
      faceShape: FaceShape.ROUND,
      faceDimensions: {
        faceWidth: 0.54,
        faceHeight: 0.68,
        jawWidth: 0.28,
        cheekWidth: 0.54,
        foreheadWidth: 0.4,
      },
      normalizedGeometry: {
        faceWidth: 0.54,
        faceHeight: 0.68,
        jawWidth: 0.28,
        cheekWidth: 0.54,
        foreheadWidth: 0.4,
        heightToWidth: 0.68 / 0.54,
        jawToCheek: 0.28 / 0.54,
        foreheadToCheek: 0.4 / 0.54,
        cheekToFaceWidth: 1,
      },
      proportionMetrics: {
        faceHeightToWidth: 0.68 / 0.54,
        faceWidthToHeight: 0.54 / 0.68,
        foreheadToFaceWidth: 0.4 / 0.54,
        cheekToFaceWidth: 1,
        jawToFaceWidth: 0.28 / 0.54,
        foreheadToCheek: 0.4 / 0.54,
        jawToCheek: 0.28 / 0.54,
        averageBrowToEye: 0.12,
        browToEyeHeight: 3,
        browToFaceHeight: 0.12 / 0.68,
        browGapToFaceWidth: 0.16 / 0.54,
        browLengthToFaceWidth: 0.24,
        archHeightToFaceHeight: 0,
        eyeHeightToFaceHeight: 0.04 / 0.68,
        eyeWidthToFaceWidth: 0.08 / 0.54,
        interEyeToFaceWidth: 0.16 / 0.54,
        confidence: 1,
      },
      faceCoordinateSpace: {
        origin: { x: 0.5, y: 0.43 },
        scale: 0.2,
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        rotationRadians: 0,
        rotationDegrees: 0,
        confidence: 1,
        landmarks: Array.from({ length: 478 }, () => ({ x: 0, y: 0 })),
      },
      measurements: [],
      metrics: {
        sp: 18.2,
        hp: 33.4,
        ep: 49.1,
        totalLength: Number.NaN,
        thickness: 6.1,
        archHeight: 7.3,
        gap: 21,
      },
      eyebrowPosition: {
        left: {
          browHeight: 17.5,
          length: 50.1,
          archHeight: 7.1,
          archLocation: 0.48,
          startToPupil: 18.3,
          archToPupil: 33.2,
          endToPupil: 49.4,
        },
        right: {
          browHeight: 17.1,
          length: 50.3,
          archHeight: 7.5,
          archLocation: 0.5,
          startToPupil: 18.1,
          archToPupil: 33.6,
          endToPupil: 48.8,
        },
        browHeight: 17.3,
        browSpacing: 21,
        archHeight: 7.3,
        archLocation: 0.49,
        leftRightSymmetry: 98.6,
        heightAsymmetry: 0.02,
        lengthAsymmetry: 0.004,
        archLocationAsymmetry: 0.02,
        confidence: 1,
      },
      eyeGeometry: {
        left: {
          width: 21,
          height: 18.7,
          tiltDegrees: 0,
        },
        right: {
          width: 21,
          height: 18.7,
          tiltDegrees: 0,
        },
        eyeWidth: 21,
        eyeHeight: 18.7,
        eyeTiltDegrees: 0,
        interEyeSpacing: 42,
        confidence: 1,
      },
      ipdMm: 63,
      pupilIpd: {
        leftPupil: { x: 0.4, y: 0.43 },
        rightPupil: { x: 0.6, y: 0.43 },
        leftPupilPx: { x: 432, y: 825.6 },
        rightPupilPx: { x: 648, y: 825.6 },
        ipdPx: 216,
        normalizedIpd: 0.2,
        source: 'iris',
        confidence: 1,
      },
      pxToMmScale: 63 / 216,
      alignment: readyAlignment,
      overlayAnchors: mockOverlayAnchors,
      overlay: {
        left: 'M10,20 Q50,10 90,20',
        right: 'M10,20 Q50,10 90,20',
        viewBox: '0 0 100 100',
      },
    } satisfies FaceAnalysisResult;

    const state = buildEyebrowRecommendationState(readyAnalysis);
    const contextState = buildEyebrowRecommendationStateFromContext(buildEyebrowRecommendationContext(readyAnalysis));

    expect(state.status).toBe('error');
    expect(state.validation.reason).toBe('invalid_metrics');
    expect(state.recommendations).toEqual([]);
    expect(contextState.status).toBe('error');
  });
});
