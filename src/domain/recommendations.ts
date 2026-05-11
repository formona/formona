import {
  FaceShape,
  type EyebrowRecommendationContext,
  type EyebrowRecommendationGenerationState,
  type EyebrowStyle,
  type FaceAnalysisResult,
  type EyebrowMetrics,
  type EyebrowRecommendationValidationReason,
  type EyebrowRecommendationValidationResult,
} from './types';

export const FACE_SHAPE_RECOMMENDATIONS: Record<FaceShape, EyebrowStyle[]> = {
  [FaceShape.OVAL]: [
    { id: 'natural_arch', name: '자연 아치형', description: '부드러운 인상을 주는 자연스러운 곡선', path: 'M10,20 Q50,10 90,20' },
    { id: 'straight', name: '직선형', description: '세련되고 깔끔한 이미지의 직선형 스타일', path: 'M10,15 L90,15' },
    { id: 'soft_curve', name: '부드러운 곡선형', description: '여성스럽고 유연한 라인의 곡선형', path: 'M10,25 Q50,15 90,25' },
  ],
  [FaceShape.SQUARE]: [
    { id: 'soft_arch', name: '부드러운 아치형', description: '각진 얼굴형을 보완하는 부드러운 아치', path: 'M10,20 Q50,5 90,20' },
    { id: 'curved', name: '곡선형', description: '턱선을 부드럽게 보이게 하는 선명한 곡선', path: 'M10,22 Q50,10 90,22' },
    { id: 'round', name: '라운드형', description: '전체적으로 둥근 형태의 부드러운 스타일', path: 'M15,25 A40,20 0 0,1 85,25' },
  ],
  [FaceShape.ROUND]: [
    { id: 'angular_arch', name: '각진 아치형', description: '둥근 얼굴에 입체감을 더하는 선명한 각', path: 'M10,25 L50,10 L90,25' },
    { id: 'upward', name: '상승형', description: '얼굴을 더 갸름하게 보이게 하는 상향 직선', path: 'M10,28 L90,12' },
    { id: 'straight_angular', name: '직선 각형', description: '모던하고 또렷한 인상을 주는 각진 직선', path: 'M10,22 L50,15 L85,20' },
  ],
  [FaceShape.HEART]: [
    { id: 'straight_horizontal', name: '직선 수평형', description: '넓은 이마를 보완하는 안정적인 수평선', path: 'M10,18 L90,18' },
    { id: 'soft_straight', name: '부드러운 직선형', description: '턱선을 강조하지 않는 완만한 직선', path: 'M10,20 Q50,18 90,20' },
    { id: 'low_arch', name: '낮은 아치형', description: '자연스럽게 균형을 잡아주는 낮은 아치', path: 'M10,22 Q50,15 90,22' },
  ],
};

export const buildEyebrowRecommendationContext = (
  analysis: FaceAnalysisResult,
): EyebrowRecommendationContext => ({
  faceShape: analysis.faceShape,
  normalizedGeometry: analysis.normalizedGeometry,
  metrics: analysis.metrics,
  metricConfidence: analysis.metricConfidence,
  eyebrowPosition: analysis.eyebrowPosition,
  eyeGeometry: analysis.eyeGeometry,
  overlayAnchors: analysis.overlayAnchors,
  ipdMm: analysis.ipdMm,
  pxToMmScale: analysis.pxToMmScale,
});

const REQUIRED_METRIC_KEYS: (keyof EyebrowMetrics)[] = [
  'sp',
  'hp',
  'ep',
  'totalLength',
  'thickness',
  'archHeight',
  'gap',
];

const RECOMMENDATION_VALIDATION_COPY: Record<EyebrowRecommendationValidationReason, Omit<EyebrowRecommendationValidationResult, 'valid' | 'reason'>> = {
  missing_analysis: {
    title: '추천을 준비하고 있어요',
    message: '얼굴 기준점과 눈썹 측정값이 계산되면 추천 스타일을 보여드릴게요.',
  },
  missing_metrics: {
    title: '눈썹 측정값이 부족해요',
    message: 'SP, HP, EP와 눈썹 길이, 두께, 아치 높이, 간격을 모두 계산해야 추천을 만들 수 있어요.',
  },
  invalid_metrics: {
    title: '눈썹 측정값을 다시 확인해야 해요',
    message: '일부 계산값이 유효하지 않아 임의 추천을 표시하지 않았습니다. 얼굴을 정면으로 맞추고 다시 스캔해주세요.',
  },
  missing_geometry: {
    title: '얼굴 비율 분석이 부족해요',
    message: '얼굴형과 눈썹 위치 기준점이 충분하지 않아 추천을 만들 수 없습니다.',
  },
  missing_scale: {
    title: 'mm 변환 기준이 불안정해요',
    message: 'IPD와 동공 기준점으로 만든 변환 비율이 유효하지 않습니다. 밝은 곳에서 다시 촬영해주세요.',
  },
  low_confidence: {
    title: '기준점 신뢰도가 낮아요',
    message: '눈썹과 눈 주변 기준점이 흔들려 추천을 확정하지 않았습니다. 휴대폰을 고정하고 다시 스캔해주세요.',
  },
};

const validationResult = (
  reason: EyebrowRecommendationValidationReason | null,
): EyebrowRecommendationValidationResult => {
  if (!reason) {
    return {
      valid: true,
      reason: null,
      title: '추천 준비 완료',
      message: '실제 FaceMesh 측정값으로 추천 스타일을 생성했습니다.',
    };
  }

  return {
    valid: false,
    reason,
    ...RECOMMENDATION_VALIDATION_COPY[reason],
  };
};

const isPositiveFiniteNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const isFiniteNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value)
);

const scoreStyleForContext = (
  style: EyebrowStyle,
  context: EyebrowRecommendationContext,
) => {
  const { metrics, ipdMm } = context;
  const archToLength = metrics.archHeight / metrics.totalLength;
  const gapToIpd = metrics.gap / ipdMm;
  const thicknessToLength = metrics.thickness / metrics.totalLength;
  let score = 0;

  if (archToLength < 0.12) {
    if (style.id.includes('arch') || style.id === 'upward') score += 3;
    if (style.id.includes('straight')) score -= 1;
  } else if (archToLength > 0.18) {
    if (style.id.includes('straight')) score += 3;
    if (style.id === 'soft_curve' || style.id === 'round') score += 1;
    if (style.id === 'angular_arch' || style.id === 'upward') score -= 2;
  }

  if (gapToIpd > 0.35) {
    if (style.id.includes('straight')) score += 2;
    if (style.id === 'low_arch') score += 1;
    if (style.id === 'round') score -= 1;
  } else if (gapToIpd < 0.27) {
    if (style.id === 'natural_arch' || style.id === 'soft_arch' || style.id === 'curved' || style.id === 'soft_curve') {
      score += 2;
    }
    if (style.id.includes('straight')) score -= 1;
  }

  if (thicknessToLength > 0.14) {
    if (style.id.startsWith('soft') || style.id === 'natural_arch' || style.id === 'round') score += 1;
    if (style.id === 'angular_arch' || style.id === 'straight_angular') score -= 1;
  }

  return score;
};

const rankEyebrowRecommendationsForContext = (
  context: EyebrowRecommendationContext,
) => FACE_SHAPE_RECOMMENDATIONS[context.faceShape]
  .map((style, index) => ({
    style,
    index,
    score: scoreStyleForContext(style, context),
  }))
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .map(({ style }) => style);

const hasCompleteMetricShape = (metrics: Partial<EyebrowMetrics> | null | undefined) => {
  if (!metrics) return false;

  return REQUIRED_METRIC_KEYS.every((key) => key in metrics);
};

const hasValidMetricValues = (metrics: Partial<EyebrowMetrics> | null | undefined) => {
  if (!metrics) return false;

  return REQUIRED_METRIC_KEYS.every((key) => isPositiveFiniteNumber(metrics[key]));
};

export const validateEyebrowRecommendationContext = (
  context: EyebrowRecommendationContext | null | undefined,
): EyebrowRecommendationValidationResult => {
  if (!context) return validationResult('missing_analysis');
  if (!hasCompleteMetricShape(context.metrics)) return validationResult('missing_metrics');
  if (!hasValidMetricValues(context.metrics)) return validationResult('invalid_metrics');

  if (
    !context.normalizedGeometry
    || !isPositiveFiniteNumber(context.normalizedGeometry.faceWidth)
    || !isPositiveFiniteNumber(context.normalizedGeometry.faceHeight)
    || !isPositiveFiniteNumber(context.normalizedGeometry.heightToWidth)
  ) {
    return validationResult('missing_geometry');
  }

  if (!isPositiveFiniteNumber(context.ipdMm) || !isPositiveFiniteNumber(context.pxToMmScale)) {
    return validationResult('missing_scale');
  }

  if (!context.eyebrowPosition || !context.eyeGeometry) return validationResult('missing_geometry');

  if (
    !isFiniteNumber(context.eyebrowPosition.confidence)
    || !isFiniteNumber(context.eyeGeometry.confidence)
  ) {
    return validationResult('missing_geometry');
  }

  return validationResult(null);
};

export const buildEyebrowRecommendationState = (
  analysis: FaceAnalysisResult | null | undefined,
): EyebrowRecommendationGenerationState => {
  if (!analysis) {
    return {
      status: 'loading',
      validation: validationResult('missing_analysis'),
      context: null,
      recommendations: [],
    };
  }

  const context = buildEyebrowRecommendationContext(analysis);

  return buildEyebrowRecommendationStateFromContext(context);
};

export const buildEyebrowRecommendationStateFromContext = (
  context: EyebrowRecommendationContext | null | undefined,
): EyebrowRecommendationGenerationState => {
  const validation = validateEyebrowRecommendationContext(context);

  if (!context) {
    return {
      status: 'loading',
      validation,
      context: null,
      recommendations: [],
    };
  }

  if (!validation.valid) {
    return {
      status: 'error',
      validation,
      context: null,
      recommendations: [],
    };
  }

  return {
    status: 'ready',
    validation,
    context,
    recommendations: rankEyebrowRecommendationsForContext(context),
  };
};

export const getEyebrowRecommendations = (
  input: FaceShape | EyebrowRecommendationContext,
) => {
  if (typeof input !== 'string') {
    return rankEyebrowRecommendationsForContext(input);
  }

  return FACE_SHAPE_RECOMMENDATIONS[input];
};
