import { FACE_MESH_LANDMARKS } from './face-landmarks';
import { FaceShape, type FacePoint, type NormalizedFaceGeometry } from './types';

export interface FaceShapeValidationFixture {
  id: string;
  label: string;
  expectedShape: FaceShape | null;
  landmarks: FacePoint[];
  geometry: NormalizedFaceGeometry;
  rationale: string;
}

export interface FaceShapeBoundaryFixture extends FaceShapeValidationFixture {
  boundary: 'heart' | 'square' | 'round';
}

const FACE_MESH_FIXTURE_LANDMARK_COUNT = 468;

const point = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const geometry = (
  faceWidth: number,
  faceHeight: number,
  foreheadWidth: number,
  cheekWidth: number,
  jawWidth: number,
): NormalizedFaceGeometry => ({
  faceWidth,
  faceHeight,
  foreheadWidth,
  cheekWidth,
  jawWidth,
  heightToWidth: faceHeight / faceWidth,
  jawToCheek: jawWidth / cheekWidth,
  foreheadToCheek: foreheadWidth / cheekWidth,
  cheekToFaceWidth: cheekWidth / faceWidth,
});

const symmetricX = (width: number) => ({
  left: 0.5 - width / 2,
  right: 0.5 + width / 2,
});

const buildLandmarks = ({
  faceHeight,
  foreheadWidth,
  cheekWidth,
  jawWidth,
}: {
  faceHeight: number;
  foreheadWidth: number;
  cheekWidth: number;
  jawWidth: number;
}) => {
  const landmarks = Array.from(
    { length: FACE_MESH_FIXTURE_LANDMARK_COUNT },
    () => point(0, 0),
  );
  const forehead = symmetricX(foreheadWidth);
  const cheek = symmetricX(cheekWidth);
  const jaw = symmetricX(jawWidth);
  const topY = 0.5 - faceHeight / 2;
  const bottomY = 0.5 + faceHeight / 2;

  Object.assign(landmarks, {
    [FACE_MESH_LANDMARKS.noseBottomCenter]: point(0.5, 0.62),
    [FACE_MESH_LANDMARKS.forehead]: point(0.5, topY),
    [FACE_MESH_LANDMARKS.upperLipCenter]: point(0.5, 0.66),
    [FACE_MESH_LANDMARKS.chin]: point(0.5, bottomY),
    [FACE_MESH_LANDMARKS.leftNostril]: point(0.44, 0.57),
    [FACE_MESH_LANDMARKS.leftForehead]: point(forehead.left, 0.28),
    [FACE_MESH_LANDMARKS.rightForehead]: point(forehead.right, 0.28),
    [FACE_MESH_LANDMARKS.leftCheek]: point(cheek.left, 0.52),
    [FACE_MESH_LANDMARKS.rightCheek]: point(cheek.right, 0.52),
    [FACE_MESH_LANDMARKS.leftJaw]: point(jaw.left, 0.72),
    [FACE_MESH_LANDMARKS.rightJaw]: point(jaw.right, 0.72),
    [FACE_MESH_LANDMARKS.leftEyeOuter]: point(0.34, 0.43),
    [FACE_MESH_LANDMARKS.leftEyeInner]: point(0.42, 0.43),
    [FACE_MESH_LANDMARKS.leftEyeTop]: point(0.38, 0.41),
    [FACE_MESH_LANDMARKS.leftEyeBottom]: point(0.38, 0.45),
    [FACE_MESH_LANDMARKS.philtrum]: point(0.5, 0.6),
    [FACE_MESH_LANDMARKS.rightEyeOuter]: point(0.66, 0.43),
    [FACE_MESH_LANDMARKS.rightEyeInner]: point(0.58, 0.43),
    [FACE_MESH_LANDMARKS.rightEyeTop]: point(0.62, 0.41),
    [FACE_MESH_LANDMARKS.rightEyeBottom]: point(0.62, 0.45),
    [FACE_MESH_LANDMARKS.leftBrowInner]: point(0.42, 0.34),
    [FACE_MESH_LANDMARKS.leftBrowArch]: point(0.36, 0.31),
    [FACE_MESH_LANDMARKS.leftBrowOuter]: point(0.27, 0.36),
    [FACE_MESH_LANDMARKS.rightBrowInner]: point(0.58, 0.34),
    [FACE_MESH_LANDMARKS.rightBrowArch]: point(0.64, 0.31),
    [FACE_MESH_LANDMARKS.rightNostril]: point(0.56, 0.57),
    [FACE_MESH_LANDMARKS.rightBrowOuter]: point(0.73, 0.36),
  });

  return landmarks;
};

const fixture = ({
  id,
  label,
  expectedShape,
  faceHeight,
  foreheadWidth,
  cheekWidth,
  jawWidth,
  rationale,
}: {
  id: string;
  label: string;
  expectedShape: FaceShape | null;
  faceHeight: number;
  foreheadWidth: number;
  cheekWidth: number;
  jawWidth: number;
  rationale: string;
}): FaceShapeValidationFixture => {
  const faceWidth = Math.max(foreheadWidth, cheekWidth, jawWidth);

  return {
    id,
    label,
    expectedShape,
    landmarks: buildLandmarks({
      faceHeight,
      foreheadWidth,
      cheekWidth,
      jawWidth,
    }),
    geometry: geometry(faceWidth, faceHeight, foreheadWidth, cheekWidth, jawWidth),
    rationale,
  };
};

const boundaryFixture = (
  boundary: FaceShapeBoundaryFixture['boundary'],
  input: Parameters<typeof fixture>[0],
): FaceShapeBoundaryFixture => ({
  boundary,
  ...fixture(input),
});

export const FACE_SHAPE_VALIDATION_FIXTURES: FaceShapeValidationFixture[] = [
  fixture({
    id: 'oval-cheek-dominant',
    label: '계란형 validation fixture',
    expectedShape: FaceShape.OVAL,
    faceHeight: 0.7,
    foreheadWidth: 0.43,
    cheekWidth: 0.5,
    jawWidth: 0.34,
    rationale: 'Longer 1:1.4 proportion with cheek-width dominance and slightly narrower jaw.',
  }),
  fixture({
    id: 'square-even-widths',
    label: '각형 validation fixture',
    expectedShape: FaceShape.SQUARE,
    faceHeight: 0.7,
    foreheadWidth: 0.5,
    cheekWidth: 0.52,
    jawWidth: 0.49,
    rationale: 'Forehead, cheek, and jaw widths are nearly even for a square MVP profile.',
  }),
  fixture({
    id: 'round-short-cheek-dominant',
    label: '둥근형 validation fixture',
    expectedShape: FaceShape.ROUND,
    faceHeight: 0.68,
    foreheadWidth: 0.44,
    cheekWidth: 0.58,
    jawWidth: 0.42,
    rationale: 'Shorter height-to-width ratio with the cheek area as the widest span.',
  }),
  fixture({
    id: 'heart-wide-forehead-narrow-jaw',
    label: '하트형 validation fixture',
    expectedShape: FaceShape.HEART,
    faceHeight: 0.72,
    foreheadWidth: 0.58,
    cheekWidth: 0.54,
    jawWidth: 0.38,
    rationale: 'Forehead is widest while the jaw is clearly narrower than the cheek span.',
  }),
];

export const getFaceShapeValidationFixture = (shape: FaceShape) => (
  FACE_SHAPE_VALIDATION_FIXTURES.find((fixtureItem) => fixtureItem.expectedShape === shape) ?? null
);

export const FACE_SHAPE_BOUNDARY_FIXTURES: FaceShapeBoundaryFixture[] = [
  boundaryFixture('heart', {
    id: 'heart-at-inclusive-thresholds',
    label: '하트형 forehead/jaw inclusive boundary',
    expectedShape: FaceShape.HEART,
    faceHeight: 0.7,
    foreheadWidth: 0.515,
    cheekWidth: 0.5,
    jawWidth: 0.39,
    rationale: 'Heart applies at forehead-to-cheek 1.03 and jaw-to-cheek 0.78 exactly.',
  }),
  boundaryFixture('heart', {
    id: 'heart-below-forehead-threshold',
    label: '미분류 just below heart forehead boundary',
    expectedShape: null,
    faceHeight: 0.7,
    foreheadWidth: 0.5145,
    cheekWidth: 0.5,
    jawWidth: 0.39,
    rationale: 'A forehead ratio just under 1.03 should no longer fall through to oval without satisfying oval criteria.',
  }),
  boundaryFixture('heart', {
    id: 'heart-above-jaw-threshold',
    label: '미분류 just above heart jaw boundary',
    expectedShape: null,
    faceHeight: 0.7,
    foreheadWidth: 0.515,
    cheekWidth: 0.5,
    jawWidth: 0.3905,
    rationale: 'A jaw ratio just above 0.78 should no longer classify as heart or default to oval.',
  }),
  boundaryFixture('square', {
    id: 'square-at-lower-width-thresholds',
    label: '각형 inclusive lower width boundary',
    expectedShape: FaceShape.SQUARE,
    faceHeight: 0.7,
    foreheadWidth: 0.43,
    cheekWidth: 0.5,
    jawWidth: 0.43,
    rationale: 'Square applies when forehead and jaw ratios are exactly at the 0.86 lower bound.',
  }),
  boundaryFixture('square', {
    id: 'square-below-jaw-threshold',
    label: '미분류 just below square jaw boundary',
    expectedShape: null,
    faceHeight: 0.7,
    foreheadWidth: 0.43,
    cheekWidth: 0.5,
    jawWidth: 0.4295,
    rationale: 'A jaw ratio just below 0.86 should not fall through to oval when it exceeds the oval taper range.',
  }),
  boundaryFixture('square', {
    id: 'square-above-width-delta-threshold',
    label: '미분류 just above square width-delta boundary',
    expectedShape: null,
    faceHeight: 0.7,
    foreheadWidth: 0.591,
    cheekWidth: 0.5,
    jawWidth: 0.5,
    rationale: 'A width delta above 0.18 should not be accepted as square or default to oval.',
  }),
  boundaryFixture('round', {
    id: 'round-at-inclusive-thresholds',
    label: '둥근형 inclusive short-face boundary',
    expectedShape: FaceShape.ROUND,
    faceHeight: 0.61,
    foreheadWidth: 0.3,
    cheekWidth: 0.48,
    jawWidth: 0.5,
    rationale: 'Round applies at height-to-width 1.22 and cheek-to-face-width 0.96 exactly.',
  }),
  boundaryFixture('round', {
    id: 'round-above-height-threshold',
    label: '미분류 just above round height boundary',
    expectedShape: null,
    faceHeight: 0.611,
    foreheadWidth: 0.3,
    cheekWidth: 0.48,
    jawWidth: 0.5,
    rationale: 'A height ratio just above 1.22 should not fall through to oval when the jaw remains the widest area.',
  }),
  boundaryFixture('round', {
    id: 'round-below-cheek-width-threshold',
    label: '미분류 just below round cheek-width boundary',
    expectedShape: null,
    faceHeight: 0.6,
    foreheadWidth: 0.3,
    cheekWidth: 0.479,
    jawWidth: 0.5,
    rationale: 'A cheek-to-face-width ratio below 0.96 should no longer classify as round or default to oval.',
  }),
];
