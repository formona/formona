import {
  FaceShape,
  type ArEyebrowPath,
  type EyebrowMetrics,
  type EyebrowOverlayAnchors,
  type EyebrowMetricConfidence,
  type EyebrowMetricConfidenceModel,
  type EyebrowMetricKey,
  type FaceAlignment,
  type FaceAnalysisResult,
  type FaceDimensions,
  type FacePoint,
  type FaceProportionMetrics,
  type ExtractedFaceFeatureLandmarks,
  type EyebrowPositionMetrics,
  type EyebrowSidePositionMetrics,
  type EyeGeometryMetrics,
  type IpdMeasurementGuidance,
  type IpdValidationResult,
  type LandmarkFrameGuidance,
  type LandmarkFrameValidationResult,
  type MeasurementDisplayItem,
  type NormalizedFaceGeometry,
  type PupilIpdMeasurement,
  type VideoDimensions,
} from './types';
import {
  averageLandmarkPoint,
  derivePxToMmScaleFromLandmarkDistances,
  EYE_LANDMARK_SETS,
  EYEBROW_ANCHOR_LANDMARKS,
  buildEyebrowOverlayAnchorPoints,
  extractFaceFeatureLandmarks,
  FACE_MESH_LANDMARKS,
  getLandmarkPoint,
  normalizeLandmarksToFaceSpace,
  normalizedDistance,
  normalizedDistanceToMm,
  normalizedHeight,
  normalizedWidth,
  ratio,
  REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES,
  REQUIRED_MEASUREMENT_LANDMARK_INDICES,
  scaledDistance,
  toPixelPoint,
} from './face-landmarks';
import { EYEBROW_METRIC_DISPLAY_COPY, EYEBROW_METRIC_DISPLAY_KEYS } from './measurement-copy';
import { IPD_CONFIG } from '../constants';

const CENTER_X = 0.5;
const CENTER_Y = 0.5;
const CENTER_X_TOLERANCE = 0.1;
const CENTER_Y_TOLERANCE = 0.13;
const MIN_FACE_HEIGHT = 0.4;
const MAX_FACE_HEIGHT = 0.72;
const MIN_FACE_WIDTH = 0.28;
const MIN_PITCH_HEIGHT = 0.36;
const MAX_EYE_TILT = 0.04;
const MIN_MEASUREMENT_CONFIDENCE = 0.75;
const MIN_IPD_LANDMARK_CONFIDENCE = 0.75;
const MIN_NORMALIZED_IPD = 0.1;
const MAX_NORMALIZED_IPD = 0.45;
const MIN_IPD_PIXEL_RATIO = 0.08;
const MAX_IPD_PIXEL_RATIO = 0.5;
const MIN_FRAME_LANDMARK_CONFIDENCE = 0.5;
const MIN_EYEBROW_FRAME_LANDMARK_CONFIDENCE = 0.75;
const ROUND_MAX_HEIGHT_TO_WIDTH = 1.22;
const HEART_MIN_FOREHEAD_TO_CHEEK = 1.03;
const HEART_MAX_JAW_TO_CHEEK = 0.78;
const SQUARE_MIN_JAW_TO_CHEEK = 0.86;
const SQUARE_MIN_FOREHEAD_TO_CHEEK = 0.86;
const SQUARE_MAX_WIDTH_DELTA = 0.18;
const CHEEK_IS_WIDEST_RATIO = 0.96;
const MIN_EYEBROW_POSITION_CONFIDENCE = 1;
const MIN_EYE_GEOMETRY_CONFIDENCE = 1;
export const EYEBROW_METRIC_CONFIDENCE_THRESHOLDS = {
  targetErrorMm: 3,
  eligibilityErrorMm: 5,
  minReportableConfidence: 0.75,
  highConfidence: 0.85,
} as const;

const EYEBROW_METRIC_BASE_ERROR_MM: Record<EyebrowMetricKey, number> = {
  sp: 1.2,
  hp: 1.4,
  ep: 1.4,
  totalLength: 1.5,
  thickness: 1.8,
  archHeight: 1.7,
  gap: 1.3,
};

const EYEBROW_METRIC_SCALE_SENSITIVITY: Record<EyebrowMetricKey, number> = {
  sp: 0.55,
  hp: 0.65,
  ep: 0.6,
  totalLength: 1,
  thickness: 0.35,
  archHeight: 0.7,
  gap: 0.9,
};

const hasValidLandmarkPoint = (point: FacePoint | null) => Boolean(
  point
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= 0
    && point.x <= 1
    && point.y >= 0
    && point.y <= 1,
);

const hasFinitePoint = (point: FacePoint | null) => Boolean(
  point
    && Number.isFinite(point.x)
    && Number.isFinite(point.y),
);

const validLandmarkPoints = (
  landmarks: FacePoint[],
  indices: readonly number[],
) => indices
  .map((index) => getLandmarkPoint(landmarks, index))
  .filter((point): point is FacePoint => hasValidLandmarkPoint(point));

const hasRequiredMeasurementLandmarks = (landmarks: FacePoint[]) => (
  REQUIRED_MEASUREMENT_LANDMARK_INDICES.every((index) => hasValidLandmarkPoint(getLandmarkPoint(landmarks, index)))
);

const REQUIRED_EYEBROW_METRIC_LANDMARK_INDICES = [
  ...REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES,
  ...EYE_LANDMARK_SETS.left,
  ...EYE_LANDMARK_SETS.right,
] as const;

const hasMissingRequiredEyebrowLandmarks = (missingRequiredIndices: readonly number[]) => (
  REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES.some((index) => missingRequiredIndices.includes(index))
);

const validateEyebrowLandmarkReliability = (
  features: ExtractedFaceFeatureLandmarks,
): Pick<LandmarkFrameValidationResult, 'valid' | 'reason' | 'confidence' | 'missingRequiredIndices'> => {
  const missingRequiredIndices = REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES
    .filter((index) => !hasValidLandmarkPoint(getLandmarkPoint(features.rawLandmarks, index)));

  if (missingRequiredIndices.length > 0) {
    return {
      valid: false,
      reason: 'missing_eyebrow_landmarks',
      confidence: Math.min(features.eyebrows.left.confidence, features.eyebrows.right.confidence),
      missingRequiredIndices,
    };
  }

  const confidence = Math.min(
    ...REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES.map((index) => landmarkConfidence(getLandmarkPoint(features.rawLandmarks, index))),
    features.eyebrows.left.confidence,
    features.eyebrows.right.confidence,
  );

  if (!Number.isFinite(confidence) || confidence < MIN_EYEBROW_FRAME_LANDMARK_CONFIDENCE) {
    return {
      valid: false,
      reason: 'low_confidence',
      confidence: Number.isFinite(confidence) ? confidence : 0,
      missingRequiredIndices: [],
    };
  }

  return {
    valid: true,
    reason: null,
    confidence,
    missingRequiredIndices: [],
  };
};

const hasUsableMeasurementConfidence = (alignment: FaceAlignment) => (
  alignment.detected
    && alignment.distanceOk
    && alignment.pitchOk
    && alignment.yawOk
    && alignment.confidence >= MIN_MEASUREMENT_CONFIDENCE
);

const hasUsableMeasurementValues = (metrics: object) => (
  Object.values(metrics).every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
);

const landmarkConfidence = (point: FacePoint | null) => {
  if (!point) return 0;

  const confidenceValues = [point.presence, point.visibility]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (confidenceValues.length === 0) return 1;

  return Math.max(0, Math.min(1, Math.min(...confidenceValues)));
};

const hasUsableEyebrowMetricPoint = (point: FacePoint | null) => (
  hasValidLandmarkPoint(point)
    && landmarkConfidence(point) >= MIN_EYEBROW_POSITION_CONFIDENCE
);

export const hasUsableEyebrowMetricInputs = (
  landmarks: FacePoint[],
  pupilIpd: PupilIpdMeasurement | null,
  pxToMmScale: number,
  dimensions?: VideoDimensions,
) => {
  if (
    !dimensions
    || !Number.isFinite(dimensions.width)
    || !Number.isFinite(dimensions.height)
    || dimensions.width <= 0
    || dimensions.height <= 0
    || !Number.isFinite(pxToMmScale)
    || pxToMmScale <= 0
    || !pupilIpd
    || pupilIpd.confidence < MIN_IPD_LANDMARK_CONFIDENCE
    || !hasUsableEyebrowMetricPoint(pupilIpd.leftPupil)
    || !hasUsableEyebrowMetricPoint(pupilIpd.rightPupil)
  ) {
    return false;
  }

  return REQUIRED_EYEBROW_METRIC_LANDMARK_INDICES.every((index) => (
    hasUsableEyebrowMetricPoint(getLandmarkPoint(landmarks, index))
  ));
};

const eyeCenterPoint = (
  landmarks: FacePoint[],
  outer: number,
  inner: number,
  top: number,
  bottom: number,
) => averageLandmarkPoint(landmarks, [outer, inner, top, bottom], outer);

const pointConfidence = (points: FacePoint[], requiredCount: number) => (
  requiredCount > 0 ? points.length / requiredCount : 0
);

const averagePoints = (points: FacePoint[]): FacePoint | null => {
  if (points.length === 0) return null;

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length,
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isPlausibleIpdDistance = (
  pupilIpd: PupilIpdMeasurement,
  dimensions?: VideoDimensions,
) => {
  if (
    !Number.isFinite(pupilIpd.normalizedIpd)
    || pupilIpd.normalizedIpd < MIN_NORMALIZED_IPD
    || pupilIpd.normalizedIpd > MAX_NORMALIZED_IPD
  ) {
    return false;
  }

  if (!dimensions || !Number.isFinite(pupilIpd.ipdPx) || !pupilIpd.ipdPx) return false;

  const widthRatio = pupilIpd.ipdPx / dimensions.width;

  return widthRatio >= MIN_IPD_PIXEL_RATIO && widthRatio <= MAX_IPD_PIXEL_RATIO;
};

export const validateLandmarkFrame = (
  features: ExtractedFaceFeatureLandmarks | null,
): LandmarkFrameValidationResult => {
  if (!features) {
    return {
      valid: false,
      reason: 'missing_face',
      confidence: 0,
      missingRequiredIndices: [...REQUIRED_MEASUREMENT_LANDMARK_INDICES],
      canUseFallback: true,
    };
  }

  const eyebrowReliability = validateEyebrowLandmarkReliability(features);
  if (!eyebrowReliability.valid) {
    return {
      ...eyebrowReliability,
      canUseFallback: true,
    };
  }

  if (!features.hasCoreFaceMesh || features.missingRequiredIndices.length > 0) {
    return {
      valid: false,
      reason: hasMissingRequiredEyebrowLandmarks(features.missingRequiredIndices)
        ? 'missing_eyebrow_landmarks'
        : 'partial_landmarks',
      confidence: Math.min(
        features.faceReference.confidence,
        features.eyes.left.confidence,
        features.eyes.right.confidence,
        features.eyebrows.left.confidence,
        features.eyebrows.right.confidence,
      ),
      missingRequiredIndices: features.missingRequiredIndices,
      canUseFallback: true,
    };
  }

  const requiredPointConfidence = Math.min(
    ...REQUIRED_MEASUREMENT_LANDMARK_INDICES.map((index) => landmarkConfidence(getLandmarkPoint(features.rawLandmarks, index))),
  );
  const confidence = Math.min(
    requiredPointConfidence,
    features.faceReference.confidence,
    features.eyes.left.confidence,
    features.eyes.right.confidence,
    features.eyebrows.left.confidence,
    features.eyebrows.right.confidence,
  );

  if (!Number.isFinite(confidence) || confidence < MIN_FRAME_LANDMARK_CONFIDENCE) {
    return {
      valid: false,
      reason: 'low_confidence',
      confidence: Number.isFinite(confidence) ? confidence : 0,
      missingRequiredIndices: [],
      canUseFallback: true,
    };
  }

  return {
    valid: true,
    reason: null,
    confidence,
    missingRequiredIndices: [],
    canUseFallback: false,
  };
};

export const buildLandmarkFrameGuidance = (
  validation: LandmarkFrameValidationResult,
): LandmarkFrameGuidance | null => {
  if (validation.valid || !validation.reason) return null;

  const copy: Record<NonNullable<LandmarkFrameValidationResult['reason']>, Omit<LandmarkFrameGuidance, 'reason'>> = {
    missing_face: {
      title: '얼굴을 찾고 있어요',
      message: '얼굴 전체가 가이드 안에 들어오도록 카메라를 정면으로 맞춰주세요.',
    },
    missing_eyebrow_landmarks: {
      title: '눈썹 기준점을 찾고 있어요',
      message: '앞머리, 손, 안경테가 눈썹을 가리지 않게 하고 양쪽 눈썹이 화면 안에 들어오도록 맞춰주세요.',
    },
    partial_landmarks: {
      title: '얼굴 기준점이 일부 가려졌어요',
      message: '눈썹, 눈, 턱선이 화면 밖이나 머리카락에 가려지지 않게 조정해주세요.',
    },
    low_confidence: {
      title: 'Landmark 추적이 불안정해요',
      message: '밝은 곳에서 휴대폰과 얼굴을 잠시 고정하면 분석이 안정됩니다.',
    },
  };

  return {
    reason: validation.reason,
    ...copy[validation.reason],
  };
};

export const validatePupilIpdMeasurement = (
  pupilIpd: PupilIpdMeasurement | null,
  alignment: FaceAlignment,
  dimensions?: VideoDimensions,
): IpdValidationResult => {
  if (
    !pupilIpd
    || !hasValidLandmarkPoint(pupilIpd.leftPupil)
    || !hasValidLandmarkPoint(pupilIpd.rightPupil)
    || !hasFinitePoint(pupilIpd.leftPupilPx)
    || !hasFinitePoint(pupilIpd.rightPupilPx)
    || !Number.isFinite(pupilIpd.ipdPx)
    || !pupilIpd.ipdPx
  ) {
    return {
      valid: false,
      reason: 'missing_landmarks',
      confidence: 0,
    };
  }

  const confidence = Math.min(pupilIpd.confidence, alignment.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_IPD_LANDMARK_CONFIDENCE) {
    return {
      valid: false,
      reason: 'low_confidence',
      confidence: Number.isFinite(confidence) ? confidence : 0,
    };
  }

  if (!isPlausibleIpdDistance(pupilIpd, dimensions)) {
    return {
      valid: false,
      reason: 'implausible_distance',
      confidence,
    };
  }

  return {
    valid: true,
    reason: null,
    confidence,
  };
};

export const buildIpdMeasurementGuidance = (
  validation: IpdValidationResult,
): IpdMeasurementGuidance | null => {
  if (validation.valid || !validation.reason) return null;

  const copy: Record<NonNullable<IpdValidationResult['reason']>, Omit<IpdMeasurementGuidance, 'reason'>> = {
    missing_landmarks: {
      title: '동공 간격을 찾고 있어요',
      message: '눈과 눈썹이 머리카락, 안경테, 화면 밖으로 가려지지 않게 정면을 바라봐 주세요.',
    },
    low_confidence: {
      title: '동공 기준점이 불안정해요',
      message: '밝은 곳에서 얼굴을 고정하고 눈을 또렷하게 뜬 상태로 잠시 유지해주세요.',
    },
    implausible_distance: {
      title: '거리 기준을 다시 맞춰주세요',
      message: '얼굴을 가이드 안에 맞추고 너무 가깝거나 멀지 않게 이동하면 mm 측정이 안정됩니다.',
    },
  };

  return {
    reason: validation.reason,
    ...copy[validation.reason],
  };
};

export const extractPupilIpd = (
  landmarks: FacePoint[],
  dimensions?: VideoDimensions,
): PupilIpdMeasurement | null => {
  const leftEyeIndices = EYE_LANDMARK_SETS.left;
  const rightEyeIndices = EYE_LANDMARK_SETS.right;
  const leftEyePoints = validLandmarkPoints(landmarks, leftEyeIndices);
  const rightEyePoints = validLandmarkPoints(landmarks, rightEyeIndices);
  const leftEyeCenter = averagePoints(leftEyePoints) ?? eyeCenterPoint(landmarks, ...leftEyeIndices);
  const rightEyeCenter = averagePoints(rightEyePoints) ?? eyeCenterPoint(landmarks, ...rightEyeIndices);

  const leftIrisPoints = validLandmarkPoints(
    landmarks,
    FACE_MESH_LANDMARKS.leftIris,
  );
  const rightIrisPoints = validLandmarkPoints(
    landmarks,
    FACE_MESH_LANDMARKS.rightIris,
  );
  const hasIrisLandmarks = leftIrisPoints.length === FACE_MESH_LANDMARKS.leftIris.length
    && rightIrisPoints.length === FACE_MESH_LANDMARKS.rightIris.length;

  const leftPupil = hasIrisLandmarks ? averagePoints(leftIrisPoints) : leftEyeCenter;
  const rightPupil = hasIrisLandmarks ? averagePoints(rightIrisPoints) : rightEyeCenter;
  const confidence = hasIrisLandmarks
    ? Math.min(
      pointConfidence(leftIrisPoints, FACE_MESH_LANDMARKS.leftIris.length),
      pointConfidence(rightIrisPoints, FACE_MESH_LANDMARKS.rightIris.length),
    )
    : Math.min(
      pointConfidence(leftEyePoints, leftEyeIndices.length),
      pointConfidence(rightEyePoints, rightEyeIndices.length),
      0.85,
    );

  if (!leftPupil || !rightPupil) return null;

  const normalizedIpd = normalizedDistance(leftPupil, rightPupil);
  if (normalizedIpd === 0) return null;

  const leftPupilPx = dimensions ? toPixelPoint(leftPupil, dimensions) : null;
  const rightPupilPx = dimensions ? toPixelPoint(rightPupil, dimensions) : null;

  return {
    leftPupil,
    rightPupil,
    leftPupilPx,
    rightPupilPx,
    ipdPx: leftPupilPx && rightPupilPx ? normalizedDistance(leftPupilPx, rightPupilPx) : null,
    normalizedIpd,
    source: hasIrisLandmarks ? 'iris' : 'eye-center',
    confidence,
  };
};

export const extractFaceDimensions = (landmarks: FacePoint[]): FaceDimensions | null => {
  const forehead = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.forehead);
  const chin = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.chin);
  const leftForehead = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftForehead);
  const rightForehead = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightForehead);
  const leftCheek = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftCheek);
  const rightCheek = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightCheek);
  const leftJaw = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftJaw);
  const rightJaw = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightJaw);

  const faceHeight = normalizedHeight(forehead, chin);
  const foreheadWidth = normalizedWidth(leftForehead, rightForehead);
  const cheekWidth = normalizedWidth(leftCheek, rightCheek);
  const jawWidth = normalizedWidth(leftJaw, rightJaw);
  const faceWidth = Math.max(foreheadWidth, cheekWidth, jawWidth);

  if (!faceHeight || !faceWidth || !foreheadWidth || !cheekWidth || !jawWidth) return null;

  return {
    faceWidth,
    faceHeight,
    jawWidth,
    cheekWidth,
    foreheadWidth,
  };
};

export const normalizeFaceGeometry = (faceDimensions: FaceDimensions): NormalizedFaceGeometry | null => {
  const {
    faceWidth,
    faceHeight,
    jawWidth,
    cheekWidth,
    foreheadWidth,
  } = faceDimensions;

  if (!hasUsableMeasurementValues(faceDimensions)) return null;

  return {
    faceWidth,
    faceHeight,
    jawWidth,
    cheekWidth,
    foreheadWidth,
    heightToWidth: ratio(faceHeight, faceWidth),
    jawToCheek: ratio(jawWidth, cheekWidth),
    foreheadToCheek: ratio(foreheadWidth, cheekWidth),
    cheekToFaceWidth: ratio(cheekWidth, faceWidth),
  };
};

export const extractNormalizedFaceGeometry = (landmarks: FacePoint[]): NormalizedFaceGeometry | null => {
  const dimensions = extractFaceDimensions(landmarks);

  return dimensions ? normalizeFaceGeometry(dimensions) : null;
};

const perpendicularDistanceToLine = (
  point: FacePoint | null,
  lineStart: FacePoint | null,
  lineEnd: FacePoint | null,
) => {
  if (!point || !lineStart || !lineEnd) return 0;

  const lineLength = normalizedDistance(lineStart, lineEnd);
  if (!lineLength) return 0;

  return Math.abs(
    ((lineEnd.x - lineStart.x) * (lineStart.y - point.y))
      - ((lineStart.x - point.x) * (lineEnd.y - lineStart.y)),
  ) / lineLength;
};

const averageFinite = (values: number[]) => {
  const usableValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (usableValues.length === 0) return 0;

  return usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length;
};

export const extractFaceProportionMetrics = (
  landmarks: FacePoint[],
  faceDimensions: FaceDimensions | null = extractFaceDimensions(landmarks),
): FaceProportionMetrics | null => {
  if (!faceDimensions || !hasUsableMeasurementValues(faceDimensions)) return null;

  const normalizedGeometry = normalizeFaceGeometry(faceDimensions);
  if (!normalizedGeometry) return null;

  const leftBrowInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftBrowInner);
  const leftBrowArch = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftBrowArch);
  const leftBrowOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftBrowOuter);
  const rightBrowInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightBrowInner);
  const rightBrowArch = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightBrowArch);
  const rightBrowOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightBrowOuter);
  const leftEyeOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeOuter);
  const leftEyeInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeInner);
  const leftEyeTop = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeTop);
  const leftEyeBottom = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeBottom);
  const rightEyeOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeOuter);
  const rightEyeInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeInner);
  const rightEyeTop = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeTop);
  const rightEyeBottom = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeBottom);

  const leftEyeCenter = eyeCenterPoint(
    landmarks,
    FACE_MESH_LANDMARKS.leftEyeOuter,
    FACE_MESH_LANDMARKS.leftEyeInner,
    FACE_MESH_LANDMARKS.leftEyeTop,
    FACE_MESH_LANDMARKS.leftEyeBottom,
  );
  const rightEyeCenter = eyeCenterPoint(
    landmarks,
    FACE_MESH_LANDMARKS.rightEyeOuter,
    FACE_MESH_LANDMARKS.rightEyeInner,
    FACE_MESH_LANDMARKS.rightEyeTop,
    FACE_MESH_LANDMARKS.rightEyeBottom,
  );
  const validPoints = (points: (FacePoint | null)[]) => (
    points.filter((point): point is FacePoint => hasValidLandmarkPoint(point))
  );
  const leftBrowCenter = averagePoints(validPoints([leftBrowInner, leftBrowArch, leftBrowOuter]));
  const rightBrowCenter = averagePoints(validPoints([rightBrowInner, rightBrowArch, rightBrowOuter]));

  const leftBrowToEye = leftBrowArch && leftEyeCenter ? Math.abs(leftEyeCenter.y - leftBrowArch.y) : 0;
  const rightBrowToEye = rightBrowArch && rightEyeCenter ? Math.abs(rightEyeCenter.y - rightBrowArch.y) : 0;
  const averageBrowToEye = averageFinite([leftBrowToEye, rightBrowToEye]);
  const averageEyeHeight = averageFinite([
    normalizedHeight(leftEyeTop, leftEyeBottom),
    normalizedHeight(rightEyeTop, rightEyeBottom),
  ]);
  const averageEyeWidth = averageFinite([
    normalizedWidth(leftEyeOuter, leftEyeInner),
    normalizedWidth(rightEyeOuter, rightEyeInner),
  ]);
  const averageBrowLength = averageFinite([
    normalizedDistance(leftBrowInner, leftBrowOuter),
    normalizedDistance(rightBrowInner, rightBrowOuter),
  ]);
  const averageArchHeight = averageFinite([
    perpendicularDistanceToLine(leftBrowArch, leftBrowInner, leftBrowOuter),
    perpendicularDistanceToLine(rightBrowArch, rightBrowInner, rightBrowOuter),
  ]);
  const browGap = normalizedWidth(leftBrowInner, rightBrowInner);
  const interEyeDistance = normalizedWidth(leftEyeInner, rightEyeInner);
  const requiredPoints = [
    leftBrowInner,
    leftBrowArch,
    leftBrowOuter,
    rightBrowInner,
    rightBrowArch,
    rightBrowOuter,
    leftEyeOuter,
    leftEyeInner,
    leftEyeTop,
    leftEyeBottom,
    rightEyeOuter,
    rightEyeInner,
    rightEyeTop,
    rightEyeBottom,
  ];
  const confidence = requiredPoints.filter((point) => hasValidLandmarkPoint(point)).length / requiredPoints.length;

  return {
    faceHeightToWidth: normalizedGeometry.heightToWidth,
    faceWidthToHeight: ratio(faceDimensions.faceWidth, faceDimensions.faceHeight),
    foreheadToFaceWidth: ratio(faceDimensions.foreheadWidth, faceDimensions.faceWidth),
    cheekToFaceWidth: normalizedGeometry.cheekToFaceWidth,
    jawToFaceWidth: ratio(faceDimensions.jawWidth, faceDimensions.faceWidth),
    foreheadToCheek: normalizedGeometry.foreheadToCheek,
    jawToCheek: normalizedGeometry.jawToCheek,
    averageBrowToEye,
    browToEyeHeight: ratio(averageBrowToEye, averageEyeHeight),
    browToFaceHeight: ratio(averageBrowToEye, faceDimensions.faceHeight),
    browGapToFaceWidth: ratio(browGap, faceDimensions.faceWidth),
    browLengthToFaceWidth: ratio(averageBrowLength, faceDimensions.faceWidth),
    archHeightToFaceHeight: ratio(averageArchHeight, faceDimensions.faceHeight),
    eyeHeightToFaceHeight: ratio(averageEyeHeight, faceDimensions.faceHeight),
    eyeWidthToFaceWidth: ratio(averageEyeWidth, faceDimensions.faceWidth),
    interEyeToFaceWidth: ratio(interEyeDistance, faceDimensions.faceWidth),
    confidence,
  };
};

export const buildFaceAlignment = (landmarks: FacePoint[]): FaceAlignment => {
  const forehead = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.forehead);
  const chin = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.chin);
  const leftCheek = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftCheek);
  const rightCheek = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightCheek);
  const leftEye = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeOuter);
  const rightEye = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeOuter);

  if (!forehead || !chin || !leftCheek || !rightCheek || !leftEye || !rightEye) {
    return {
      detected: false,
      centered: false,
      distanceOk: false,
      pitchOk: false,
      yawOk: false,
      guidance: '가이드 라인에 얼굴을 맞춰주세요',
      confidence: 0,
      offsetX: 0,
      offsetY: 0,
      faceHeightRatio: 0,
      faceWidthRatio: 0,
      rollDegrees: 0,
      distanceState: 'unknown',
      horizontalDirection: 'center',
      verticalDirection: 'center',
      ready: false,
    };
  }

  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
  const faceCenterY = (forehead.y + chin.y) / 2;
  const offsetX = faceCenterX - CENTER_X;
  const offsetY = faceCenterY - CENTER_Y;
  const faceHeight = normalizedDistance(forehead, chin);
  const faceWidth = normalizedDistance(leftCheek, rightCheek);
  const eyeTilt = leftEye.y - rightEye.y;
  const eyeDistance = normalizedDistance(leftEye, rightEye);
  const rollDegrees = eyeDistance ? Math.atan2(eyeTilt, eyeDistance) * (180 / Math.PI) : 0;
  const horizontalDirection = offsetX < -CENTER_X_TOLERANCE
    ? 'left'
    : offsetX > CENTER_X_TOLERANCE
      ? 'right'
      : 'center';
  const verticalDirection = offsetY < -CENTER_Y_TOLERANCE
    ? 'up'
    : offsetY > CENTER_Y_TOLERANCE
      ? 'down'
      : 'center';
  const distanceState = faceHeight < MIN_FACE_HEIGHT
    ? 'too_far'
    : faceHeight > MAX_FACE_HEIGHT
      ? 'too_close'
      : 'ok';

  const centered = horizontalDirection === 'center' && verticalDirection === 'center';
  const distanceOk = distanceState === 'ok' && faceWidth >= MIN_FACE_WIDTH;
  const pitchOk = faceHeight >= MIN_PITCH_HEIGHT;
  const yawOk = Math.abs(eyeTilt) <= MAX_EYE_TILT;
  const ready = centered && distanceOk && pitchOk && yawOk;

  let guidance = '정면 위치가 안정적입니다';
  if (horizontalDirection === 'left') guidance = '얼굴을 오른쪽으로 조금 이동해주세요';
  else if (horizontalDirection === 'right') guidance = '얼굴을 왼쪽으로 조금 이동해주세요';
  else if (verticalDirection === 'up') guidance = '얼굴을 아래로 조금 내려주세요';
  else if (verticalDirection === 'down') guidance = '얼굴을 위로 조금 올려주세요';
  else if (distanceState === 'too_far' || faceWidth < MIN_FACE_WIDTH) guidance = '가이드 라인에 맞게 조금 가까이 와주세요';
  else if (distanceState === 'too_close') guidance = '가이드 라인에 맞게 조금 멀어져 주세요';
  else if (!yawOk) guidance = '고개를 기울이지 말고 정면을 바라봐 주세요';

  const checks = [centered, distanceOk, pitchOk, yawOk].filter(Boolean).length;

  return {
    detected: true,
    centered,
    distanceOk,
    pitchOk,
    yawOk,
    guidance,
    confidence: checks / 4,
    offsetX,
    offsetY,
    faceHeightRatio: faceHeight,
    faceWidthRatio: faceWidth,
    rollDegrees,
    distanceState,
    horizontalDirection,
    verticalDirection,
    ready,
  };
};

const isHeartFaceGeometry = (geometry: NormalizedFaceGeometry) => (
  geometry.foreheadToCheek >= HEART_MIN_FOREHEAD_TO_CHEEK
    && geometry.jawToCheek <= HEART_MAX_JAW_TO_CHEEK
);

const isSquareFaceGeometry = (geometry: NormalizedFaceGeometry) => {
  const widthDelta = Math.max(
    Math.abs(1 - geometry.foreheadToCheek),
    Math.abs(1 - geometry.jawToCheek),
  );

  return geometry.jawToCheek >= SQUARE_MIN_JAW_TO_CHEEK
    && geometry.foreheadToCheek >= SQUARE_MIN_FOREHEAD_TO_CHEEK
    && widthDelta <= SQUARE_MAX_WIDTH_DELTA;
};

const isRoundFaceGeometry = (geometry: NormalizedFaceGeometry) => (
  geometry.heightToWidth <= ROUND_MAX_HEIGHT_TO_WIDTH
    && geometry.cheekToFaceWidth >= CHEEK_IS_WIDEST_RATIO
);

export const classifyFaceShapeFromGeometry = (geometry: NormalizedFaceGeometry | null): FaceShape => {
  if (!geometry) return FaceShape.OVAL;

  if (isHeartFaceGeometry(geometry)) return FaceShape.HEART;
  if (isSquareFaceGeometry(geometry)) return FaceShape.SQUARE;
  if (isRoundFaceGeometry(geometry)) return FaceShape.ROUND;

  return FaceShape.OVAL;
};

export const classifyFaceShape = (landmarks: FacePoint[]) => (
  classifyFaceShapeFromGeometry(extractNormalizedFaceGeometry(landmarks))
);

const verticalDistanceToMm = (
  a: FacePoint | null,
  b: FacePoint | null,
  dimensions: VideoDimensions,
  pxToMmScale: number,
) => {
  if (!a || !b) return 0;

  return normalizedDistanceToMm(Math.abs(toPixelPoint(a, dimensions).y - toPixelPoint(b, dimensions).y), pxToMmScale);
};

const perpendicularDistanceToLineMm = (
  point: FacePoint | null,
  lineStart: FacePoint | null,
  lineEnd: FacePoint | null,
  dimensions: VideoDimensions,
  pxToMmScale: number,
) => {
  if (!point || !lineStart || !lineEnd) return 0;

  const p = toPixelPoint(point, dimensions);
  const a = toPixelPoint(lineStart, dimensions);
  const b = toPixelPoint(lineEnd, dimensions);
  const lineLength = normalizedDistance(a, b);
  if (!lineLength) return 0;

  const distancePx = Math.abs(
    ((b.x - a.x) * (a.y - p.y)) - ((a.x - p.x) * (b.y - a.y)),
  ) / lineLength;

  return normalizedDistanceToMm(distancePx, pxToMmScale);
};

const relativeDifference = (left: number, right: number) => {
  const averageValue = (Math.abs(left) + Math.abs(right)) / 2;
  if (!Number.isFinite(averageValue) || averageValue === 0) return 0;

  return Math.abs(left - right) / averageValue;
};

const buildSideEyebrowPositionMetrics = ({
  inner,
  arch,
  outer,
  eyeCenter,
  pupil,
  dimensions,
  pxToMmScale,
}: {
  inner: FacePoint | null;
  arch: FacePoint | null;
  outer: FacePoint | null;
  eyeCenter: FacePoint | null;
  pupil: FacePoint;
  dimensions: VideoDimensions;
  pxToMmScale: number;
}): EyebrowSidePositionMetrics | null => {
  if (!inner || !arch || !outer || !eyeCenter) return null;

  const lengthPx = scaledDistance(inner, outer, dimensions);
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) return null;

  const innerToArchPx = scaledDistance(inner, arch, dimensions);
  const browCenter = averagePoints([inner, arch, outer]);
  if (!browCenter) return null;

  return {
    browHeight: verticalDistanceToMm(browCenter, eyeCenter, dimensions, pxToMmScale),
    length: normalizedDistanceToMm(lengthPx, pxToMmScale),
    archHeight: perpendicularDistanceToLineMm(arch, inner, outer, dimensions, pxToMmScale),
    archLocation: clamp(innerToArchPx / lengthPx, 0, 1),
    startToPupil: normalizedDistanceToMm(scaledDistance(pupil, inner, dimensions), pxToMmScale),
    archToPupil: normalizedDistanceToMm(scaledDistance(pupil, arch, dimensions), pxToMmScale),
    endToPupil: normalizedDistanceToMm(scaledDistance(pupil, outer, dimensions), pxToMmScale),
  };
};

export const extractEyebrowPositionMetrics = (
  landmarks: FacePoint[],
  pupilIpd: PupilIpdMeasurement,
  pxToMmScale: number,
  dimensions?: VideoDimensions,
): EyebrowPositionMetrics | null => {
  if (!dimensions || !hasUsableEyebrowMetricInputs(landmarks, pupilIpd, pxToMmScale, dimensions)) return null;

  const leftInner = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.left.sp);
  const leftArch = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.left.hp);
  const leftOuter = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.left.ep);
  const rightInner = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.right.sp);
  const rightArch = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.right.hp);
  const rightOuter = getLandmarkPoint(landmarks, EYEBROW_ANCHOR_LANDMARKS.right.ep);
  const leftEyeCenter = eyeCenterPoint(
    landmarks,
    FACE_MESH_LANDMARKS.leftEyeOuter,
    FACE_MESH_LANDMARKS.leftEyeInner,
    FACE_MESH_LANDMARKS.leftEyeTop,
    FACE_MESH_LANDMARKS.leftEyeBottom,
  );
  const rightEyeCenter = eyeCenterPoint(
    landmarks,
    FACE_MESH_LANDMARKS.rightEyeOuter,
    FACE_MESH_LANDMARKS.rightEyeInner,
    FACE_MESH_LANDMARKS.rightEyeTop,
    FACE_MESH_LANDMARKS.rightEyeBottom,
  );

  const left = buildSideEyebrowPositionMetrics({
    inner: leftInner,
    arch: leftArch,
    outer: leftOuter,
    eyeCenter: leftEyeCenter,
    pupil: pupilIpd.leftPupil,
    dimensions,
    pxToMmScale,
  });
  const right = buildSideEyebrowPositionMetrics({
    inner: rightInner,
    arch: rightArch,
    outer: rightOuter,
    eyeCenter: rightEyeCenter,
    pupil: pupilIpd.rightPupil,
    dimensions,
    pxToMmScale,
  });

  if (!left || !right) return null;

  const browSpacing = normalizedDistanceToMm(scaledDistance(leftInner, rightInner, dimensions), pxToMmScale);
  const heightAsymmetry = Math.max(
    relativeDifference(left.browHeight, right.browHeight),
    relativeDifference(left.archHeight, right.archHeight),
  );
  const lengthAsymmetry = relativeDifference(left.length, right.length);
  const archLocationAsymmetry = Math.abs(left.archLocation - right.archLocation);
  const asymmetryPenalty = (heightAsymmetry + lengthAsymmetry + archLocationAsymmetry) / 3;
  const confidence = Math.min(
    landmarkConfidence(leftInner),
    landmarkConfidence(leftArch),
    landmarkConfidence(leftOuter),
    landmarkConfidence(rightInner),
    landmarkConfidence(rightArch),
    landmarkConfidence(rightOuter),
  );

  return {
    left,
    right,
    browHeight: (left.browHeight + right.browHeight) / 2,
    browSpacing,
    archHeight: (left.archHeight + right.archHeight) / 2,
    archLocation: (left.archLocation + right.archLocation) / 2,
    leftRightSymmetry: clamp((1 - asymmetryPenalty) * 100, 0, 100),
    heightAsymmetry,
    lengthAsymmetry,
    archLocationAsymmetry,
    confidence,
  };
};

const buildSideEyeGeometryMetrics = ({
  outer,
  inner,
  top,
  bottom,
  dimensions,
  pxToMmScale,
}: {
  outer: FacePoint | null;
  inner: FacePoint | null;
  top: FacePoint | null;
  bottom: FacePoint | null;
  dimensions: VideoDimensions;
  pxToMmScale: number;
}) => {
  if (!outer || !inner || !top || !bottom) return null;

  const widthPx = scaledDistance(outer, inner, dimensions);
  const heightPx = scaledDistance(top, bottom, dimensions);
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) return null;

  const tiltRadians = Math.atan2(
    (inner.y - outer.y) * dimensions.height,
    Math.abs(inner.x - outer.x) * dimensions.width,
  );

  return {
    width: normalizedDistanceToMm(widthPx, pxToMmScale),
    height: normalizedDistanceToMm(heightPx, pxToMmScale),
    tiltDegrees: tiltRadians * (180 / Math.PI),
  };
};

export const extractEyeGeometryMetrics = (
  landmarks: FacePoint[],
  pxToMmScale: number,
  dimensions?: VideoDimensions,
): EyeGeometryMetrics | null => {
  if (!dimensions || !Number.isFinite(pxToMmScale) || pxToMmScale <= 0) return null;

  const leftOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeOuter);
  const leftInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeInner);
  const leftTop = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeTop);
  const leftBottom = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.leftEyeBottom);
  const rightOuter = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeOuter);
  const rightInner = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeInner);
  const rightTop = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeTop);
  const rightBottom = getLandmarkPoint(landmarks, FACE_MESH_LANDMARKS.rightEyeBottom);

  const left = buildSideEyeGeometryMetrics({
    outer: leftOuter,
    inner: leftInner,
    top: leftTop,
    bottom: leftBottom,
    dimensions,
    pxToMmScale,
  });
  const right = buildSideEyeGeometryMetrics({
    outer: rightOuter,
    inner: rightInner,
    top: rightTop,
    bottom: rightBottom,
    dimensions,
    pxToMmScale,
  });

  if (!left || !right || !leftInner || !rightInner) return null;

  const interEyeSpacingPx = scaledDistance(leftInner, rightInner, dimensions);
  if (!Number.isFinite(interEyeSpacingPx) || interEyeSpacingPx <= 0) return null;

  const confidence = Math.min(
    landmarkConfidence(leftOuter),
    landmarkConfidence(leftInner),
    landmarkConfidence(leftTop),
    landmarkConfidence(leftBottom),
    landmarkConfidence(rightOuter),
    landmarkConfidence(rightInner),
    landmarkConfidence(rightTop),
    landmarkConfidence(rightBottom),
  );

  return {
    left,
    right,
    eyeWidth: (left.width + right.width) / 2,
    eyeHeight: (left.height + right.height) / 2,
    eyeTiltDegrees: (left.tiltDegrees + right.tiltDegrees) / 2,
    interEyeSpacing: normalizedDistanceToMm(interEyeSpacingPx, pxToMmScale),
    confidence,
  };
};

const buildOverlay = (anchors: EyebrowOverlayAnchors): ArEyebrowPath => {
  const path = ({ sp, hp, ep }: EyebrowOverlayAnchors['left']) => {
    return `M ${(sp.x * 100).toFixed(2)} ${(sp.y * 100).toFixed(2)} Q ${(hp.x * 100).toFixed(2)} ${(hp.y * 100).toFixed(2)} ${(ep.x * 100).toFixed(2)} ${(ep.y * 100).toFixed(2)}`;
  };

  return {
    left: path(anchors.left),
    right: path(anchors.right),
    viewBox: '0 0 100 100',
  };
};

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

const getMetricAsymmetry = (
  key: EyebrowMetricKey,
  eyebrowPosition: EyebrowPositionMetrics,
) => {
  if (key === 'totalLength') return eyebrowPosition.lengthAsymmetry;
  if (key === 'archHeight' || key === 'hp') return eyebrowPosition.archLocationAsymmetry + eyebrowPosition.heightAsymmetry;
  if (key === 'sp' || key === 'ep' || key === 'gap') return eyebrowPosition.heightAsymmetry;

  return 0;
};

export const buildEyebrowMetricConfidenceModel = ({
  metrics,
  pupilIpd,
  alignment,
  eyebrowPosition,
  eyeGeometry,
  overlayAnchors,
}: {
  metrics: EyebrowMetrics;
  pupilIpd: PupilIpdMeasurement;
  alignment: FaceAlignment;
  eyebrowPosition: EyebrowPositionMetrics;
  eyeGeometry: EyeGeometryMetrics;
  overlayAnchors: EyebrowOverlayAnchors;
}): EyebrowMetricConfidenceModel => {
  const thresholds = EYEBROW_METRIC_CONFIDENCE_THRESHOLDS;
  const scaleConfidence = pupilIpd.confidence * (pupilIpd.source === 'iris' ? 1 : 0.92);
  const overlayConfidence = overlayAnchors.confidence;
  const overallConfidence = clamp(Math.min(
    scaleConfidence,
    alignment.confidence,
    eyebrowPosition.confidence,
    eyeGeometry.confidence,
    overlayConfidence,
  ), 0, 1);
  const scaleErrorRate = pupilIpd.source === 'iris' ? 0.025 : 0.045;
  const confidencePenaltyMm = (1 - overallConfidence) * 4.2;
  const alignmentPenaltyMm = alignment.ready ? 0 : 1.2;
  const scaleReason = pupilIpd.source === 'iris' ? 'stable_iris_scale' : 'eye_center_scale';
  const alignmentReason = alignment.ready && alignment.confidence >= thresholds.highConfidence
    ? 'alignment_stable'
    : 'alignment_unstable';
  const landmarkReason = overallConfidence >= thresholds.highConfidence
    ? 'landmarks_stable'
    : 'landmarks_unstable';

  const confidenceMetrics = (Object.keys(metrics) as EyebrowMetricKey[]).reduce((acc, key) => {
    const metricValue = metrics[key];
    const asymmetry = getMetricAsymmetry(key, eyebrowPosition);
    const asymmetryPenaltyMm = Math.min(1.2, asymmetry * 2.4);
    const estimatedErrorMm = roundToTenth(
      EYEBROW_METRIC_BASE_ERROR_MM[key]
        + (Math.abs(metricValue) * scaleErrorRate * EYEBROW_METRIC_SCALE_SENSITIVITY[key])
        + confidencePenaltyMm
        + alignmentPenaltyMm
        + asymmetryPenaltyMm,
    );
    const reportable = overallConfidence >= thresholds.minReportableConfidence
      && estimatedErrorMm <= thresholds.eligibilityErrorMm;
    const band = reportable && estimatedErrorMm <= thresholds.targetErrorMm && overallConfidence >= thresholds.highConfidence
      ? 'target'
      : reportable
        ? 'eligible'
        : 'ineligible';
    const reasons: EyebrowMetricConfidence['reasons'] = [scaleReason, alignmentReason, landmarkReason];

    if (asymmetry >= 0.08) reasons.push('asymmetry_detected');

    acc[key] = {
      key,
      confidence: roundToTenth(overallConfidence * 100) / 100,
      estimatedErrorMm,
      targetErrorMm: thresholds.targetErrorMm,
      eligibilityErrorMm: thresholds.eligibilityErrorMm,
      reportable,
      band,
      reasons,
    };

    return acc;
  }, {} as Record<EyebrowMetricKey, EyebrowMetricConfidence>);

  const maxEstimatedErrorMm = Math.max(
    ...Object.values(confidenceMetrics).map((metric) => metric.estimatedErrorMm),
  );

  return {
    targetErrorMm: thresholds.targetErrorMm,
    eligibilityErrorMm: thresholds.eligibilityErrorMm,
    minReportableConfidence: thresholds.minReportableConfidence,
    highConfidence: thresholds.highConfidence,
    overallConfidence: roundToTenth(overallConfidence * 100) / 100,
    maxEstimatedErrorMm,
    reportable: Object.values(confidenceMetrics).every((metric) => metric.reportable),
    metrics: confidenceMetrics,
  };
};

export const analyzeFaceLandmarks = (
  landmarks: FacePoint[],
  ipdMm: number = IPD_CONFIG.defaultMm,
  dimensions?: VideoDimensions,
): FaceAnalysisResult | null => {
  const frameValidation = validateLandmarkFrame(extractFaceFeatureLandmarks(landmarks));
  if (!frameValidation.valid) return null;

  if (!hasRequiredMeasurementLandmarks(landmarks)) return null;

  const pupilIpd = extractPupilIpd(landmarks, dimensions);
  const faceDimensions = extractFaceDimensions(landmarks);
  const normalizedGeometry = faceDimensions ? normalizeFaceGeometry(faceDimensions) : null;
  const proportionMetrics = extractFaceProportionMetrics(landmarks, faceDimensions);
  const faceCoordinateSpace = normalizeLandmarksToFaceSpace(landmarks);

  if (!pupilIpd || !faceDimensions || !normalizedGeometry || !proportionMetrics || !faceCoordinateSpace) return null;

  const alignment = buildFaceAlignment(landmarks);
  const ipdValidation = validatePupilIpdMeasurement(pupilIpd, alignment, dimensions);
  if (!ipdValidation.valid) return null;

  if (!hasUsableMeasurementConfidence(alignment)) return null;

  const referenceIpdMm = Number.isFinite(ipdMm) && ipdMm > 0 ? ipdMm : IPD_CONFIG.defaultMm;
  const calibration = derivePxToMmScaleFromLandmarkDistances(
    landmarks,
    [{
      id: `${pupilIpd.source}-ipd`,
      start: pupilIpd.leftPupil,
      end: pupilIpd.rightPupil,
      realDistanceMm: referenceIpdMm,
      confidence: pupilIpd.confidence,
    }],
    dimensions,
  );
  const pxToMmScale = calibration?.pxToMmScale;
  if (!pxToMmScale || !dimensions) return null;

  const eyebrowPosition = extractEyebrowPositionMetrics(landmarks, pupilIpd, pxToMmScale, dimensions);
  if (!eyebrowPosition || eyebrowPosition.confidence < MIN_EYEBROW_POSITION_CONFIDENCE) return null;

  const eyeGeometry = extractEyeGeometryMetrics(landmarks, pxToMmScale, dimensions);
  if (!eyeGeometry || eyeGeometry.confidence < MIN_EYE_GEOMETRY_CONFIDENCE) return null;

  const overlayAnchors = buildEyebrowOverlayAnchorPoints(landmarks);
  if (!overlayAnchors) return null;

  const sp = (eyebrowPosition.left.startToPupil + eyebrowPosition.right.startToPupil) / 2;
  const hp = (eyebrowPosition.left.archToPupil + eyebrowPosition.right.archToPupil) / 2;
  const ep = (eyebrowPosition.left.endToPupil + eyebrowPosition.right.endToPupil) / 2;
  const totalLength = (eyebrowPosition.left.length + eyebrowPosition.right.length) / 2;
  const archHeight = eyebrowPosition.archHeight;
  const gap = eyebrowPosition.browSpacing;
  const thickness = Math.max(3.5, Math.min(10, (totalLength * 0.12) + (archHeight * 0.18)));
  const metrics = { sp, hp, ep, totalLength, thickness, archHeight, gap };

  if (!hasUsableMeasurementValues(metrics)) return null;

  const metricConfidence = buildEyebrowMetricConfidenceModel({
    metrics,
    pupilIpd,
    alignment,
    eyebrowPosition,
    eyeGeometry,
    overlayAnchors,
  });
  if (!metricConfidence.reportable) return null;

  const measurements: MeasurementDisplayItem[] = EYEBROW_METRIC_DISPLAY_KEYS.map((key) => ({
    ...EYEBROW_METRIC_DISPLAY_COPY[key],
    value: `${metrics[key].toFixed(1)}mm`,
    confidence: metricConfidence.metrics[key],
  }));

  return {
    faceShape: classifyFaceShapeFromGeometry(normalizedGeometry),
    faceDimensions,
    normalizedGeometry,
    proportionMetrics,
    faceCoordinateSpace,
    measurements,
    metrics,
    metricConfidence,
    eyebrowPosition,
    eyeGeometry,
    ipdMm: referenceIpdMm,
    pupilIpd,
    pxToMmScale,
    alignment,
    overlayAnchors,
    overlay: buildOverlay(overlayAnchors),
  };
};
