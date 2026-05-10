import type {
  BrowLandmarkGroup,
  EyebrowOverlayAnchors,
  EyebrowOverlaySideAnchors,
  ExtractedFaceFeatureLandmarks,
  EyeLandmarkGroup,
  FaceRelativeCoordinateSpace,
  FaceRelativePoint,
  FaceMeshLandmarkList,
  FacePoint,
  FaceReferenceLandmarks,
  IrisLandmarkGroup,
  NormalizedLandmark,
  VideoDimensions,
} from './types';

const roundNormalized = (value: number) => (
  Number.isFinite(value) ? Math.round(value * 1_000_000_000_000) / 1_000_000_000_000 : value
);

export const FACE_MESH_CORE_LANDMARK_COUNT = 468;
export const FACE_MESH_WITH_IRIS_LANDMARK_COUNT = 478;

export const FACE_PROPORTION_LANDMARKS = {
  forehead: 10,
  chin: 152,
  leftForehead: 103,
  rightForehead: 332,
  leftCheek: 234,
  rightCheek: 454,
  leftJaw: 172,
  rightJaw: 397,
} as const;

export const EYE_LANDMARKS = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
} as const;

export const IRIS_LANDMARKS = {
  leftIris: [468, 469, 470, 471, 472],
  rightIris: [473, 474, 475, 476, 477],
} as const;

export const BROW_LANDMARKS = {
  leftBrowInner: 55,
  leftBrowArch: 65,
  leftBrowOuter: 107,
  rightBrowInner: 285,
  rightBrowArch: 295,
  rightBrowOuter: 336,
} as const;

export const OVERLAY_REFERENCE_LANDMARKS = {
  leftNostril: 98,
  rightNostril: 327,
  philtrum: 164,
  upperLipCenter: 13,
  noseBottomCenter: 0,
} as const;

export const EYEBROW_ANCHOR_LANDMARKS = {
  left: {
    sp: BROW_LANDMARKS.leftBrowInner,
    hp: BROW_LANDMARKS.leftBrowArch,
    ep: BROW_LANDMARKS.leftBrowOuter,
  },
  right: {
    sp: BROW_LANDMARKS.rightBrowInner,
    hp: BROW_LANDMARKS.rightBrowArch,
    ep: BROW_LANDMARKS.rightBrowOuter,
  },
} as const;

export const FACE_MESH_LANDMARKS = {
  ...FACE_PROPORTION_LANDMARKS,
  ...EYE_LANDMARKS,
  ...IRIS_LANDMARKS,
  ...BROW_LANDMARKS,
  ...OVERLAY_REFERENCE_LANDMARKS,
} as const;

export const EYE_LANDMARK_SETS = {
  left: [
    EYE_LANDMARKS.leftEyeOuter,
    EYE_LANDMARKS.leftEyeInner,
    EYE_LANDMARKS.leftEyeTop,
    EYE_LANDMARKS.leftEyeBottom,
  ],
  right: [
    EYE_LANDMARKS.rightEyeOuter,
    EYE_LANDMARKS.rightEyeInner,
    EYE_LANDMARKS.rightEyeTop,
    EYE_LANDMARKS.rightEyeBottom,
  ],
} as const;

export const BROW_LANDMARK_SETS = {
  left: [
    EYEBROW_ANCHOR_LANDMARKS.left.sp,
    EYEBROW_ANCHOR_LANDMARKS.left.hp,
    EYEBROW_ANCHOR_LANDMARKS.left.ep,
  ],
  right: [
    EYEBROW_ANCHOR_LANDMARKS.right.sp,
    EYEBROW_ANCHOR_LANDMARKS.right.hp,
    EYEBROW_ANCHOR_LANDMARKS.right.ep,
  ],
} as const;

export const EYEBROW_ANCHOR_LANDMARK_SETS = {
  left: [
    EYEBROW_ANCHOR_LANDMARKS.left.sp,
    EYEBROW_ANCHOR_LANDMARKS.left.hp,
    EYEBROW_ANCHOR_LANDMARKS.left.ep,
  ],
  right: [
    EYEBROW_ANCHOR_LANDMARKS.right.sp,
    EYEBROW_ANCHOR_LANDMARKS.right.hp,
    EYEBROW_ANCHOR_LANDMARKS.right.ep,
  ],
} as const;

export const REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES = [
  ...EYEBROW_ANCHOR_LANDMARK_SETS.left,
  ...EYEBROW_ANCHOR_LANDMARK_SETS.right,
] as const;

export const REQUIRED_MEASUREMENT_LANDMARK_INDICES = [
  FACE_PROPORTION_LANDMARKS.forehead,
  FACE_PROPORTION_LANDMARKS.chin,
  FACE_PROPORTION_LANDMARKS.leftForehead,
  FACE_PROPORTION_LANDMARKS.rightForehead,
  FACE_PROPORTION_LANDMARKS.leftCheek,
  FACE_PROPORTION_LANDMARKS.rightCheek,
  FACE_PROPORTION_LANDMARKS.leftJaw,
  FACE_PROPORTION_LANDMARKS.rightJaw,
  EYE_LANDMARKS.leftEyeOuter,
  EYE_LANDMARKS.leftEyeInner,
  EYE_LANDMARKS.leftEyeTop,
  EYE_LANDMARKS.leftEyeBottom,
  EYE_LANDMARKS.rightEyeOuter,
  EYE_LANDMARKS.rightEyeInner,
  EYE_LANDMARKS.rightEyeTop,
  EYE_LANDMARKS.rightEyeBottom,
  BROW_LANDMARKS.leftBrowInner,
  BROW_LANDMARKS.leftBrowArch,
  BROW_LANDMARKS.leftBrowOuter,
  BROW_LANDMARKS.rightBrowInner,
  BROW_LANDMARKS.rightBrowArch,
  BROW_LANDMARKS.rightBrowOuter,
] as const;

type FaceMeshLandmarkValue = typeof FACE_MESH_LANDMARKS[keyof typeof FACE_MESH_LANDMARKS];
type IrisLandmarkValue = typeof IRIS_LANDMARKS[keyof typeof IRIS_LANDMARKS][number];

export type FaceMeshLandmarkName = keyof typeof FACE_MESH_LANDMARKS;
export type FaceMeshLandmarkIndex = Extract<FaceMeshLandmarkValue, number> | IrisLandmarkValue;
export type FaceMeshLandmarkIndexList = Extract<FaceMeshLandmarkValue, readonly number[]>;
export type FaceMeshCoreLandmarkIndex = Exclude<FaceMeshLandmarkIndex, IrisLandmarkValue>;
export type IrisLandmarkIndex = IrisLandmarkValue;
export type MeasurementLandmarkIndex = typeof REQUIRED_MEASUREMENT_LANDMARK_INDICES[number];
export type FaceSide = keyof typeof EYEBROW_ANCHOR_LANDMARKS;
export type EyebrowAnchorName = keyof typeof EYEBROW_ANCHOR_LANDMARKS.left;
export type EyebrowAnchorLandmarkIndex = typeof EYEBROW_ANCHOR_LANDMARKS[FaceSide][EyebrowAnchorName];
export type EyebrowAnchorLandmarkSet = typeof EYEBROW_ANCHOR_LANDMARK_SETS[FaceSide];
export type NormalizedFaceLandmark = NormalizedLandmark;
export type NormalizedFaceLandmarkList = FaceMeshLandmarkList;

export type CalibrationLandmarkRef = FaceMeshLandmarkIndex | number | FacePoint;

export interface LandmarkCalibrationDistance {
  id: string;
  start: CalibrationLandmarkRef;
  end: CalibrationLandmarkRef;
  realDistanceMm: number;
  confidence?: number;
}

export interface LandmarkCalibrationSample {
  id: string;
  pixelDistance: number;
  realDistanceMm: number;
  pxToMmScale: number;
  confidence: number;
}

export interface LandmarkCalibrationResult {
  pxToMmScale: number;
  confidence: number;
  samples: LandmarkCalibrationSample[];
}

const hasFiniteNormalizedPoint = (point: FacePoint | null): point is FacePoint => Boolean(
  point
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= 0
    && point.x <= 1
    && point.y >= 0
    && point.y <= 1,
);

export const getLandmarkPoint = (
  landmarks: readonly FacePoint[],
  index: FaceMeshLandmarkIndex | number,
): FacePoint | null => landmarks[index] ?? null;

export const getNamedLandmarkPoint = (
  landmarks: readonly FacePoint[],
  name: FaceMeshLandmarkName,
): FacePoint | null => {
  const index = FACE_MESH_LANDMARKS[name];
  return typeof index === 'number' ? getLandmarkPoint(landmarks, index) : null;
};

export const averageLandmarkPoint = (
  landmarks: readonly FacePoint[],
  indices: readonly (FaceMeshLandmarkIndex | number)[],
  fallbackIndex?: FaceMeshLandmarkIndex | number,
): FacePoint | null => {
  const points = indices
    .map((index) => getLandmarkPoint(landmarks, index))
    .filter((point): point is FacePoint => Boolean(point));

  if (points.length === 0) {
    return fallbackIndex === undefined ? null : getLandmarkPoint(landmarks, fallbackIndex);
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length,
  };
};

const collectValidPoints = (
  landmarks: readonly FacePoint[],
  indices: readonly (FaceMeshLandmarkIndex | number)[],
) => indices
  .map((index) => getLandmarkPoint(landmarks, index))
  .filter(hasFiniteNormalizedPoint);

const pointConfidence = (points: readonly FacePoint[], requiredCount: number) => (
  requiredCount > 0 ? points.length / requiredCount : 0
);

const averagePoints = (points: readonly FacePoint[]): FacePoint | null => {
  if (points.length === 0) return null;

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length,
  };
};

const clampNormalizedValue = (value: number) => Math.max(0, Math.min(1, value));

const normalizedOverlayPoint = (
  x: number,
  y: number,
  source?: 'iris' | 'eye-center',
): EyebrowOverlaySideAnchors['sp'] => ({
  x: clampNormalizedValue(x),
  y: clampNormalizedValue(y),
  ...(source ? { source } : {}),
});

const pointAtYOnLine = (
  start: FacePoint,
  end: FacePoint,
  targetY: number,
): FacePoint => {
  const dy = end.y - start.y;
  if (Math.abs(dy) < 0.0001) {
    return { x: end.x, y: targetY };
  }

  const t = (targetY - start.y) / dy;
  return {
    x: start.x + ((end.x - start.x) * t),
    y: targetY,
  };
};

const projectPointToLine = (
  point: FacePoint,
  start: FacePoint,
  end: FacePoint,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared <= 0) return { ratioOnLine: 0 };

  return {
    ratioOnLine: (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared,
  };
};

const blendPoints = (a: FacePoint, b: FacePoint, aWeight: number): FacePoint => {
  const safeWeight = Math.max(0, Math.min(1, aWeight));
  const bWeight = 1 - safeWeight;

  return {
    x: (a.x * safeWeight) + (b.x * bWeight),
    y: (a.y * safeWeight) + (b.y * bWeight),
  };
};

const irisOrEyeCenter = (
  landmarks: readonly FacePoint[],
  irisIndices: readonly number[],
  eyeIndices: readonly number[],
) => {
  const irisPoints = collectValidPoints(landmarks, irisIndices);
  const irisCenter = irisPoints.length === irisIndices.length ? averagePoints(irisPoints) : null;
  if (irisCenter) {
    return { point: irisCenter, source: 'iris' as const, confidence: 1 };
  }

  const eyePoints = collectValidPoints(landmarks, eyeIndices);
  return {
    point: averagePoints(eyePoints),
    source: 'eye-center' as const,
    confidence: pointConfidence(eyePoints, eyeIndices.length) * 0.78,
  };
};

const toOverlayAnchorPoint = (
  point: FaceRelativePoint,
  coordinateSpace: FaceRelativeCoordinateSpace,
  source?: 'iris' | 'eye-center',
): EyebrowOverlaySideAnchors['sp'] => {
  const normalizedPoint = mapFaceRelativePointToNormalizedPoint(point, coordinateSpace);

  return normalizedOverlayPoint(normalizedPoint.x, normalizedPoint.y, source);
};

const buildOverlaySideAnchors = ({
  browInner,
  browArch,
  browOuter,
  browConfidence,
  nostril,
  eyeCorner,
  faceCenter,
  irisCenter,
  coordinateSpace,
}: {
  browInner: FaceRelativePoint | null;
  browArch: FaceRelativePoint | null;
  browOuter: FaceRelativePoint | null;
  browConfidence: number;
  nostril: FaceRelativePoint | null;
  eyeCorner: FaceRelativePoint | null;
  faceCenter: FaceRelativePoint | null;
  irisCenter: ReturnType<typeof irisOrEyeCenter>;
  coordinateSpace: FaceRelativeCoordinateSpace;
}): EyebrowOverlaySideAnchors | null => {
  if (!browInner || !browArch || !browOuter || !nostril || !eyeCorner || !faceCenter || !irisCenter.point) {
    return null;
  }

  const relativeIris = normalizePointToFaceSpace(
    irisCenter.point,
    coordinateSpace.origin,
    coordinateSpace.xAxis,
    coordinateSpace.yAxis,
    coordinateSpace.scale,
  );
  const browBaselineY = (browInner.y + browOuter.y) / 2;
  const spBase = { x: nostril.x, y: browBaselineY };
  const epBase = pointAtYOnLine(faceCenter, eyeCorner, browBaselineY);
  const irisAnchorBase = { x: relativeIris.x, y: browArch.y };
  const { ratioOnLine } = projectPointToLine(irisAnchorBase, spBase, epBase);
  const goldenRatioPoint = blendPoints(spBase, epBase, 1 - (1.618 / (1 + 1.618)));
  const hpBase = ratioOnLine >= 0.58 && ratioOnLine <= 0.66
    ? irisAnchorBase
    : blendPoints(irisAnchorBase, goldenRatioPoint, 0.7);
  const archLift = Math.max(0.012 / coordinateSpace.scale, Math.abs(browBaselineY - browArch.y));
  const sp = toOverlayAnchorPoint(spBase, coordinateSpace);
  const ep = toOverlayAnchorPoint(epBase, coordinateSpace);
  const hp = toOverlayAnchorPoint(
    { x: hpBase.x, y: Math.min(hpBase.y, browBaselineY - archLift) },
    coordinateSpace,
    irisCenter.source,
  );

  return {
    sp,
    hp,
    ep,
    confidence: Math.min(browConfidence, irisCenter.confidence, coordinateSpace.confidence),
  };
};

export const extractEyebrowOverlayAnchors = (
  landmarks: readonly FacePoint[],
): EyebrowOverlayAnchors | null => {
  const features = extractFaceFeatureLandmarks(landmarks);
  if (!features) return null;

  const coordinateSpace = normalizeLandmarksToFaceSpace(landmarks);
  if (!coordinateSpace) return null;

  const relativePoint = (index: number): FaceRelativePoint | null => {
    const point = coordinateSpace.landmarks[index];
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  };

  const philtrum = getLandmarkPoint(landmarks, OVERLAY_REFERENCE_LANDMARKS.philtrum);
  const upperLipCenter = getLandmarkPoint(landmarks, OVERLAY_REFERENCE_LANDMARKS.upperLipCenter);
  const noseBottomCenter = getLandmarkPoint(landmarks, OVERLAY_REFERENCE_LANDMARKS.noseBottomCenter);
  const faceCenter = averagePoints([philtrum, upperLipCenter, noseBottomCenter].filter(hasFiniteNormalizedPoint));
  const relativeFaceCenter = faceCenter
    ? normalizePointToFaceSpace(
      faceCenter,
      coordinateSpace.origin,
      coordinateSpace.xAxis,
      coordinateSpace.yAxis,
      coordinateSpace.scale,
    )
    : null;
  const leftNostril = getLandmarkPoint(landmarks, OVERLAY_REFERENCE_LANDMARKS.leftNostril);
  const rightNostril = getLandmarkPoint(landmarks, OVERLAY_REFERENCE_LANDMARKS.rightNostril);

  const left = buildOverlaySideAnchors({
    browInner: relativePoint(EYEBROW_ANCHOR_LANDMARKS.left.sp),
    browArch: relativePoint(EYEBROW_ANCHOR_LANDMARKS.left.hp),
    browOuter: relativePoint(EYEBROW_ANCHOR_LANDMARKS.left.ep),
    browConfidence: features.eyebrows.left.confidence,
    nostril: hasFiniteNormalizedPoint(leftNostril)
      ? normalizePointToFaceSpace(leftNostril, coordinateSpace.origin, coordinateSpace.xAxis, coordinateSpace.yAxis, coordinateSpace.scale)
      : null,
    eyeCorner: relativePoint(EYE_LANDMARKS.leftEyeOuter),
    faceCenter: relativeFaceCenter,
    irisCenter: irisOrEyeCenter(landmarks, IRIS_LANDMARKS.leftIris, EYE_LANDMARK_SETS.left),
    coordinateSpace,
  });
  const right = buildOverlaySideAnchors({
    browInner: relativePoint(EYEBROW_ANCHOR_LANDMARKS.right.sp),
    browArch: relativePoint(EYEBROW_ANCHOR_LANDMARKS.right.hp),
    browOuter: relativePoint(EYEBROW_ANCHOR_LANDMARKS.right.ep),
    browConfidence: features.eyebrows.right.confidence,
    nostril: hasFiniteNormalizedPoint(rightNostril)
      ? normalizePointToFaceSpace(rightNostril, coordinateSpace.origin, coordinateSpace.xAxis, coordinateSpace.yAxis, coordinateSpace.scale)
      : null,
    eyeCorner: relativePoint(EYE_LANDMARKS.rightEyeOuter),
    faceCenter: relativeFaceCenter,
    irisCenter: irisOrEyeCenter(landmarks, IRIS_LANDMARKS.rightIris, EYE_LANDMARK_SETS.right),
    coordinateSpace,
  });

  if (!left || !right) return null;

  return {
    left,
    right,
    confidence: Math.min(left.confidence, right.confidence),
    transform: {
      origin: coordinateSpace.origin,
      scale: coordinateSpace.scale,
      rotationRadians: coordinateSpace.rotationRadians,
      rotationDegrees: coordinateSpace.rotationDegrees,
      confidence: coordinateSpace.confidence,
    },
  };
};

export const buildEyebrowOverlayAnchorPoints = extractEyebrowOverlayAnchors;

const buildBrowLandmarkGroup = (
  landmarks: readonly FacePoint[],
  innerIndex: number,
  archIndex: number,
  outerIndex: number,
): BrowLandmarkGroup => {
  const inner = getLandmarkPoint(landmarks, innerIndex);
  const arch = getLandmarkPoint(landmarks, archIndex);
  const outer = getLandmarkPoint(landmarks, outerIndex);
  const points = [inner, arch, outer].filter(hasFiniteNormalizedPoint);

  return {
    inner: hasFiniteNormalizedPoint(inner) ? inner : null,
    arch: hasFiniteNormalizedPoint(arch) ? arch : null,
    outer: hasFiniteNormalizedPoint(outer) ? outer : null,
    points,
    confidence: pointConfidence(points, 3),
  };
};

const buildEyeLandmarkGroup = (
  landmarks: readonly FacePoint[],
  outerIndex: number,
  innerIndex: number,
  topIndex: number,
  bottomIndex: number,
): EyeLandmarkGroup => {
  const outer = getLandmarkPoint(landmarks, outerIndex);
  const inner = getLandmarkPoint(landmarks, innerIndex);
  const top = getLandmarkPoint(landmarks, topIndex);
  const bottom = getLandmarkPoint(landmarks, bottomIndex);
  const points = [outer, inner, top, bottom].filter(hasFiniteNormalizedPoint);

  return {
    outer: hasFiniteNormalizedPoint(outer) ? outer : null,
    inner: hasFiniteNormalizedPoint(inner) ? inner : null,
    top: hasFiniteNormalizedPoint(top) ? top : null,
    bottom: hasFiniteNormalizedPoint(bottom) ? bottom : null,
    center: averagePoints(points),
    points,
    confidence: pointConfidence(points, 4),
  };
};

const buildIrisLandmarkGroup = (
  landmarks: readonly FacePoint[],
  indices: readonly number[],
): IrisLandmarkGroup => {
  const points = collectValidPoints(landmarks, indices);

  return {
    center: averagePoints(points),
    points,
    confidence: pointConfidence(points, indices.length),
    complete: points.length === indices.length,
  };
};

const buildFaceReferenceLandmarks = (
  landmarks: readonly FacePoint[],
): FaceReferenceLandmarks => {
  const forehead = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.forehead);
  const chin = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.chin);
  const leftForehead = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.leftForehead);
  const rightForehead = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.rightForehead);
  const leftCheek = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.leftCheek);
  const rightCheek = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.rightCheek);
  const leftJaw = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.leftJaw);
  const rightJaw = getLandmarkPoint(landmarks, FACE_PROPORTION_LANDMARKS.rightJaw);
  const points = [
    forehead,
    chin,
    leftForehead,
    rightForehead,
    leftCheek,
    rightCheek,
    leftJaw,
    rightJaw,
  ].filter(hasFiniteNormalizedPoint);

  return {
    forehead: hasFiniteNormalizedPoint(forehead) ? forehead : null,
    chin: hasFiniteNormalizedPoint(chin) ? chin : null,
    leftForehead: hasFiniteNormalizedPoint(leftForehead) ? leftForehead : null,
    rightForehead: hasFiniteNormalizedPoint(rightForehead) ? rightForehead : null,
    leftCheek: hasFiniteNormalizedPoint(leftCheek) ? leftCheek : null,
    rightCheek: hasFiniteNormalizedPoint(rightCheek) ? rightCheek : null,
    leftJaw: hasFiniteNormalizedPoint(leftJaw) ? leftJaw : null,
    rightJaw: hasFiniteNormalizedPoint(rightJaw) ? rightJaw : null,
    points,
    confidence: pointConfidence(points, 8),
  };
};

export const extractFaceFeatureLandmarks = (
  landmarks: readonly FacePoint[],
): ExtractedFaceFeatureLandmarks | null => {
  if (landmarks.length < FACE_MESH_CORE_LANDMARK_COUNT) return null;

  const rawLandmarks = Array.from(landmarks);
  const coreLandmarks = rawLandmarks.slice(0, FACE_MESH_CORE_LANDMARK_COUNT);
  const missingRequiredIndices = REQUIRED_MEASUREMENT_LANDMARK_INDICES
    .filter((index) => !hasFiniteNormalizedPoint(getLandmarkPoint(rawLandmarks, index)));
  const leftIris = buildIrisLandmarkGroup(rawLandmarks, IRIS_LANDMARKS.leftIris);
  const rightIris = buildIrisLandmarkGroup(rawLandmarks, IRIS_LANDMARKS.rightIris);

  return {
    rawLandmarks,
    coreLandmarks,
    hasCoreFaceMesh: coreLandmarks.length === FACE_MESH_CORE_LANDMARK_COUNT,
    hasIrisLandmarks: leftIris.complete && rightIris.complete,
    eyebrows: {
      left: buildBrowLandmarkGroup(
        rawLandmarks,
        BROW_LANDMARKS.leftBrowInner,
        BROW_LANDMARKS.leftBrowArch,
        BROW_LANDMARKS.leftBrowOuter,
      ),
      right: buildBrowLandmarkGroup(
        rawLandmarks,
        BROW_LANDMARKS.rightBrowInner,
        BROW_LANDMARKS.rightBrowArch,
        BROW_LANDMARKS.rightBrowOuter,
      ),
    },
    eyes: {
      left: buildEyeLandmarkGroup(
        rawLandmarks,
        EYE_LANDMARKS.leftEyeOuter,
        EYE_LANDMARKS.leftEyeInner,
        EYE_LANDMARKS.leftEyeTop,
        EYE_LANDMARKS.leftEyeBottom,
      ),
      right: buildEyeLandmarkGroup(
        rawLandmarks,
        EYE_LANDMARKS.rightEyeOuter,
        EYE_LANDMARKS.rightEyeInner,
        EYE_LANDMARKS.rightEyeTop,
        EYE_LANDMARKS.rightEyeBottom,
      ),
    },
    irises: {
      left: leftIris,
      right: rightIris,
    },
    faceReference: buildFaceReferenceLandmarks(rawLandmarks),
    missingRequiredIndices,
  };
};

const normalizePointToFaceSpace = (
  point: FacePoint,
  origin: FacePoint,
  xAxis: FaceRelativeCoordinateSpace['xAxis'],
  yAxis: FaceRelativeCoordinateSpace['yAxis'],
  scale: number,
): FaceRelativePoint => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const z = point.z === undefined ? undefined : point.z / scale;

  return {
    x: roundNormalized(((dx * xAxis.x) + (dy * xAxis.y)) / scale),
    y: roundNormalized(((dx * yAxis.x) + (dy * yAxis.y)) / scale),
    ...(z === undefined ? {} : { z: roundNormalized(z) }),
    ...(point.visibility === undefined ? {} : { visibility: point.visibility }),
    ...(point.presence === undefined ? {} : { presence: point.presence }),
  };
};

export const mapFaceRelativePointToNormalizedPoint = (
  point: FaceRelativePoint,
  coordinateSpace: FaceRelativeCoordinateSpace,
): FacePoint => ({
  x: roundNormalized(coordinateSpace.origin.x + (
    ((point.x * coordinateSpace.xAxis.x) + (point.y * coordinateSpace.yAxis.x)) * coordinateSpace.scale
  )),
  y: roundNormalized(coordinateSpace.origin.y + (
    ((point.x * coordinateSpace.xAxis.y) + (point.y * coordinateSpace.yAxis.y)) * coordinateSpace.scale
  )),
  z: point.z === undefined
    ? undefined
    : coordinateSpace.origin.z === undefined
      ? roundNormalized(point.z * coordinateSpace.scale)
      : roundNormalized(coordinateSpace.origin.z + (point.z * coordinateSpace.scale)),
  ...(point.visibility === undefined ? {} : { visibility: point.visibility }),
  ...(point.presence === undefined ? {} : { presence: point.presence }),
});

export const normalizeLandmarksToFaceSpace = (
  landmarks: readonly FacePoint[],
): FaceRelativeCoordinateSpace | null => {
  const features = extractFaceFeatureLandmarks(landmarks);
  if (!features) return null;

  const leftReference = features.irises.left.center ?? features.eyes.left.center;
  const rightReference = features.irises.right.center ?? features.eyes.right.center;
  if (!leftReference || !rightReference) return null;

  const scale = normalizedDistance(leftReference, rightReference);
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const dx = rightReference.x - leftReference.x;
  const dy = rightReference.y - leftReference.y;
  const xAxis = {
    x: dx / scale,
    y: dy / scale,
  };
  const yAxis = {
    x: -xAxis.y,
    y: xAxis.x,
  };
  const origin = {
    x: (leftReference.x + rightReference.x) / 2,
    y: (leftReference.y + rightReference.y) / 2,
    z: ((leftReference.z ?? 0) + (rightReference.z ?? 0)) / 2,
  };

  return {
    origin,
    scale,
    xAxis,
    yAxis,
    rotationRadians: Math.atan2(xAxis.y, xAxis.x),
    rotationDegrees: Math.atan2(xAxis.y, xAxis.x) * (180 / Math.PI),
    confidence: Math.min(
      features.irises.left.complete && features.irises.right.complete
        ? features.irises.left.confidence
        : features.eyes.left.confidence,
      features.irises.left.complete && features.irises.right.complete
        ? features.irises.right.confidence
        : features.eyes.right.confidence,
    ),
    landmarks: features.rawLandmarks.map((point) => normalizePointToFaceSpace(point, origin, xAxis, yAxis, scale)),
  };
};

export const normalizedDistance = (a: FacePoint | null, b: FacePoint | null) => {
  if (!a || !b) return 0;
  return roundNormalized(Math.hypot(a.x - b.x, a.y - b.y));
};

export const midpoint = (a: FacePoint | null, b: FacePoint | null): FacePoint | null => {
  if (!a || !b) return null;

  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z === undefined && b.z === undefined ? undefined : ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
};

export const ratio = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
};

export const normalizedWidth = (left: FacePoint | null, right: FacePoint | null) => {
  if (!left || !right) return 0;
  return roundNormalized(Math.abs(right.x - left.x));
};

export const normalizedHeight = (top: FacePoint | null, bottom: FacePoint | null) => {
  if (!top || !bottom) return 0;
  return roundNormalized(Math.abs(bottom.y - top.y));
};

export const toPixelPoint = (point: FacePoint, dimensions: VideoDimensions): FacePoint => ({
  x: point.x * dimensions.width,
  y: point.y * dimensions.height,
  z: point.z,
});

export const scaledDistance = (a: FacePoint | null, b: FacePoint | null, dimensions?: VideoDimensions) => {
  if (!a || !b) return 0;
  if (!dimensions) return normalizedDistance(a, b);
  return normalizedDistance(toPixelPoint(a, dimensions), toPixelPoint(b, dimensions));
};

export const angleRadians = (start: FacePoint | null, end: FacePoint | null) => {
  if (!start || !end) return 0;
  return Math.atan2(end.y - start.y, end.x - start.x);
};

export const radiansToDegrees = (radians: number) => {
  if (!Number.isFinite(radians)) return 0;
  return radians * (180 / Math.PI);
};

export const angleDegrees = (start: FacePoint | null, end: FacePoint | null) => (
  radiansToDegrees(angleRadians(start, end))
);

export const angleAtPointRadians = (
  start: FacePoint | null,
  vertex: FacePoint | null,
  end: FacePoint | null,
) => {
  if (!start || !vertex || !end) return 0;

  const startVector = { x: start.x - vertex.x, y: start.y - vertex.y };
  const endVector = { x: end.x - vertex.x, y: end.y - vertex.y };
  const startLength = Math.hypot(startVector.x, startVector.y);
  const endLength = Math.hypot(endVector.x, endVector.y);

  if (!startLength || !endLength) return 0;

  const cosine = ((startVector.x * endVector.x) + (startVector.y * endVector.y)) / (startLength * endLength);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
};

export const angleAtPointDegrees = (
  start: FacePoint | null,
  vertex: FacePoint | null,
  end: FacePoint | null,
) => radiansToDegrees(angleAtPointRadians(start, vertex, end));

export const calculatePxToMmScale = (ipdPx: number | null | undefined, referenceIpdMm: number) => {
  if (!Number.isFinite(ipdPx) || !ipdPx || ipdPx <= 0) return null;
  if (!Number.isFinite(referenceIpdMm) || referenceIpdMm <= 0) return null;

  return referenceIpdMm / ipdPx;
};

const isFacePointRef = (value: CalibrationLandmarkRef): value is FacePoint => (
  typeof value === 'object'
    && value !== null
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
);

const resolveCalibrationLandmarkRef = (
  landmarks: readonly FacePoint[],
  ref: CalibrationLandmarkRef,
) => (isFacePointRef(ref) ? ref : getLandmarkPoint(landmarks, ref));

export const derivePxToMmScaleFromLandmarkDistances = (
  landmarks: readonly FacePoint[],
  distances: readonly LandmarkCalibrationDistance[],
  dimensions: VideoDimensions | undefined,
): LandmarkCalibrationResult | null => {
  if (
    !dimensions
    || !Number.isFinite(dimensions.width)
    || !Number.isFinite(dimensions.height)
    || dimensions.width <= 0
    || dimensions.height <= 0
  ) {
    return null;
  }

  const samples = distances.reduce<LandmarkCalibrationSample[]>((usableSamples, distance) => {
    const start = resolveCalibrationLandmarkRef(landmarks, distance.start);
    const end = resolveCalibrationLandmarkRef(landmarks, distance.end);
    const pixelDistance = scaledDistance(start, end, dimensions);
    const pxToMmScale = calculatePxToMmScale(pixelDistance, distance.realDistanceMm);
    const confidence = Number.isFinite(distance.confidence)
      ? Math.max(0, Math.min(1, distance.confidence ?? 0))
      : 1;

    if (!pxToMmScale || confidence <= 0) return usableSamples;

    usableSamples.push({
      id: distance.id,
      pixelDistance,
      realDistanceMm: distance.realDistanceMm,
      pxToMmScale,
      confidence,
    });

    return usableSamples;
  }, []);

  if (samples.length === 0) return null;

  const confidenceTotal = samples.reduce((sum, sample) => sum + sample.confidence, 0);
  const scaleTotal = samples.reduce((sum, sample) => sum + (sample.pxToMmScale * sample.confidence), 0);
  const pxToMmScale = scaleTotal / confidenceTotal;

  if (!Number.isFinite(pxToMmScale) || pxToMmScale <= 0) return null;

  return {
    pxToMmScale,
    confidence: confidenceTotal / samples.length,
    samples,
  };
};

export const normalizedDistanceToMm = (distanceValue: number, pxToMmScale: number) => (
  distanceValue * pxToMmScale
);
