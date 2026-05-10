import { describe, expect, it } from 'vitest';

import {
  angleAtPointDegrees,
  angleAtPointRadians,
  angleDegrees,
  angleRadians,
  averageLandmarkPoint,
  BROW_LANDMARK_SETS,
  calculatePxToMmScale,
  derivePxToMmScaleFromLandmarkDistances,
  EYE_LANDMARK_SETS,
  EYEBROW_ANCHOR_LANDMARKS,
  EYEBROW_ANCHOR_LANDMARK_SETS,
  extractEyebrowOverlayAnchors,
  extractFaceFeatureLandmarks,
  FACE_MESH_LANDMARKS,
  FACE_MESH_CORE_LANDMARK_COUNT,
  FACE_MESH_WITH_IRIS_LANDMARK_COUNT,
  getLandmarkPoint,
  getNamedLandmarkPoint,
  IRIS_LANDMARKS,
  midpoint,
  normalizeLandmarksToFaceSpace,
  normalizedDistance,
  normalizedDistanceToMm,
  normalizedHeight,
  normalizedWidth,
  OVERLAY_REFERENCE_LANDMARKS,
  radiansToDegrees,
  ratio,
  REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES,
  REQUIRED_MEASUREMENT_LANDMARK_INDICES,
  scaledDistance,
  type EyebrowAnchorLandmarkIndex,
  type EyebrowAnchorLandmarkSet,
  type EyebrowAnchorName,
  type FaceSide,
  type FaceMeshCoreLandmarkIndex,
  type IrisLandmarkIndex,
  type NormalizedFaceLandmark,
  type NormalizedFaceLandmarkList,
} from './face-landmarks';
import type { FacePoint } from './types';

const point = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const makeFrameLandmarks = (count = FACE_MESH_WITH_IRIS_LANDMARK_COUNT) => {
  const landmarks = Array.from({ length: count }, () => point(0.5, 0.5));

  Object.assign(landmarks, {
    10: point(0.5, 0.14),
    33: point(0.34, 0.43),
    0: point(0.5, 0.62),
    13: point(0.5, 0.66),
    55: point(0.42, 0.34),
    65: point(0.36, 0.31),
    98: point(0.44, 0.57),
    103: point(0.3, 0.28),
    107: point(0.27, 0.36),
    133: point(0.42, 0.43),
    145: point(0.38, 0.45),
    152: point(0.5, 0.82),
    159: point(0.38, 0.41),
    164: point(0.5, 0.6),
    172: point(0.36, 0.72),
    234: point(0.23, 0.52),
    263: point(0.66, 0.43),
    285: point(0.58, 0.34),
    295: point(0.64, 0.31),
    327: point(0.56, 0.57),
    332: point(0.7, 0.28),
    336: point(0.73, 0.36),
    362: point(0.58, 0.43),
    374: point(0.62, 0.45),
    386: point(0.62, 0.41),
    397: point(0.64, 0.72),
    454: point(0.77, 0.52),
  });

  if (count >= FACE_MESH_WITH_IRIS_LANDMARK_COUNT) {
    Object.assign(landmarks, {
      468: point(0.41, 0.43),
      469: point(0.4, 0.42),
      470: point(0.39, 0.43),
      471: point(0.4, 0.44),
      472: point(0.4, 0.43),
      473: point(0.61, 0.43),
      474: point(0.6, 0.42),
      475: point(0.59, 0.43),
      476: point(0.6, 0.44),
      477: point(0.6, 0.43),
    });
  }

  return landmarks;
};

describe('FaceMesh landmark utilities', () => {
  it('defines stable MVP landmark indices for face proportions, eyes, irises, and eyebrows', () => {
    expect(FACE_MESH_LANDMARKS).toMatchObject({
      forehead: 10,
      chin: 152,
      leftForehead: 103,
      rightForehead: 332,
      leftCheek: 234,
      rightCheek: 454,
      leftEyeOuter: 33,
      rightEyeOuter: 263,
      leftIris: [468, 469, 470, 471, 472],
      rightIris: [473, 474, 475, 476, 477],
      leftBrowInner: 55,
      rightBrowInner: 285,
      leftNostril: 98,
      rightNostril: 327,
      philtrum: 164,
    });
    expect(FACE_MESH_CORE_LANDMARK_COUNT).toBe(468);
    expect(FACE_MESH_WITH_IRIS_LANDMARK_COUNT).toBe(478);
    expect(IRIS_LANDMARKS.leftIris).toEqual([468, 469, 470, 471, 472]);
    expect(IRIS_LANDMARKS.rightIris).toEqual([473, 474, 475, 476, 477]);
    expect(OVERLAY_REFERENCE_LANDMARKS).toMatchObject({
      leftNostril: 98,
      rightNostril: 327,
      philtrum: 164,
    });
    expect(EYE_LANDMARK_SETS.left).toEqual([33, 133, 159, 145]);
    expect(BROW_LANDMARK_SETS.right).toEqual([285, 295, 336]);
    expect(REQUIRED_MEASUREMENT_LANDMARK_INDICES).toContain(55);
    expect(REQUIRED_MEASUREMENT_LANDMARK_INDICES).not.toContain(468);
  });

  it('defines typed left and right eyebrow anchors for SP, HP, and EP calculations', () => {
    const side: FaceSide = 'left';
    const anchorName: EyebrowAnchorName = 'hp';
    const anchorIndex: EyebrowAnchorLandmarkIndex = EYEBROW_ANCHOR_LANDMARKS[side][anchorName];
    const leftAnchorSet: EyebrowAnchorLandmarkSet = EYEBROW_ANCHOR_LANDMARK_SETS.left;

    expect(anchorIndex).toBe(65);
    expect(leftAnchorSet).toEqual([55, 65, 107]);
    expect(EYEBROW_ANCHOR_LANDMARKS).toEqual({
      left: {
        sp: 55,
        hp: 65,
        ep: 107,
      },
      right: {
        sp: 285,
        hp: 295,
        ep: 336,
      },
    });
    expect(EYEBROW_ANCHOR_LANDMARK_SETS.right).toEqual([285, 295, 336]);
    expect(REQUIRED_EYEBROW_ANCHOR_LANDMARK_INDICES).toEqual([55, 65, 107, 285, 295, 336]);
  });

  it('converts FaceMesh landmarks into normalized left and right eyebrow overlay anchors', () => {
    const anchors = extractEyebrowOverlayAnchors(makeFrameLandmarks());

    expect(anchors).toMatchObject({
      left: {
        sp: { x: 0.44, y: 0.35 },
        hp: { source: 'iris' },
        ep: { y: 0.35 },
        confidence: 1,
      },
      right: {
        sp: { x: 0.56, y: 0.35 },
        hp: { source: 'iris' },
        ep: { y: 0.35 },
        confidence: 1,
      },
      confidence: 1,
    });
    expect(anchors?.left.hp.x).toBeGreaterThan(anchors?.left.ep.x ?? 0);
    expect(anchors?.left.hp.x).toBeLessThan(anchors?.left.sp.x ?? 1);
    expect(anchors?.right.hp.x).toBeGreaterThan(anchors?.right.sp.x ?? 0);
    expect(anchors?.right.hp.x).toBeLessThan(anchors?.right.ep.x ?? 1);
    expect(anchors?.left.hp.y).toBeLessThan(anchors?.left.sp.y ?? 0);
    expect(anchors?.right.hp.y).toBeLessThan(anchors?.right.sp.y ?? 0);
  });

  it('falls back to eye-center overlay HP anchors when iris landmarks are unavailable', () => {
    const anchors = extractEyebrowOverlayAnchors(makeFrameLandmarks(FACE_MESH_CORE_LANDMARK_COUNT));

    expect(anchors?.left.hp.source).toBe('eye-center');
    expect(anchors?.right.hp.source).toBe('eye-center');
    expect(anchors?.confidence).toBeCloseTo(0.78);
  });

  it('exposes typed normalized landmark structures for MediaPipe output', () => {
    const coreIndex: FaceMeshCoreLandmarkIndex = 10;
    const irisIndex: IrisLandmarkIndex = 468;
    const landmarks: NormalizedFaceLandmarkList = [
      { x: 0.1, y: 0.2, z: -0.01, visibility: 0.9, presence: 1 },
    ];
    const landmark: NormalizedFaceLandmark = landmarks[0];

    expect(coreIndex).toBe(FACE_MESH_LANDMARKS.forehead);
    expect(irisIndex).toBe(IRIS_LANDMARKS.leftIris[0]);
    expect(landmark).toMatchObject({ x: 0.1, y: 0.2, z: -0.01 });
  });

  it('reads named or indexed normalized landmarks with null-safe fallback behavior', () => {
    const landmarks = [point(0.1, 0.2), point(0.4, 0.6)];

    expect(getLandmarkPoint(landmarks, 1)).toEqual(point(0.4, 0.6));
    expect(getLandmarkPoint(landmarks, 468)).toBeNull();
    expect(getNamedLandmarkPoint([], 'forehead')).toBeNull();
    expect(getNamedLandmarkPoint(landmarks, 'leftIris')).toBeNull();
  });

  it('averages available landmark points and falls back when every source point is missing', () => {
    const landmarks = [point(0.1, 0.2, 0.3), point(0.5, 0.6, 0.7), point(0.9, 1)];

    expect(averageLandmarkPoint(landmarks, [0, 1])).toEqual(point(0.3, 0.4, 0.5));
    expect(averageLandmarkPoint(landmarks, [20, 21], 2)).toEqual(point(0.9, 1));
    expect(averageLandmarkPoint(landmarks, [20, 21])).toBeNull();
  });

  it('calculates normalized distance, width, height, scaled distance, and millimeter conversion values', () => {
    const a = point(0.1, 0.2);
    const b = point(0.4, 0.6);

    expect(normalizedDistance(a, b)).toBeCloseTo(0.5);
    expect(normalizedWidth(a, b)).toBeCloseTo(0.3);
    expect(normalizedHeight(a, b)).toBeCloseTo(0.4);
    expect(scaledDistance(a, b, { width: 100, height: 200 })).toBeCloseTo(85.44, 2);
    expect(normalizedDistanceToMm(0.25, 252)).toBeCloseTo(63);
    expect(normalizedDistance(null, b)).toBe(0);
    expect(normalizedWidth(a, null)).toBe(0);
    expect(normalizedHeight(null, b)).toBe(0);
  });

  it('calculates reusable midpoint, ratio, and angle geometry helpers', () => {
    const left = point(0.2, 0.4, -0.02);
    const right = point(0.6, 0.4, -0.04);
    const top = point(0.4, 0.2);
    const bottom = point(0.4, 0.6);

    expect(midpoint(left, right)).toEqual(point(0.4, 0.4, -0.03));
    expect(midpoint(left, null)).toBeNull();
    expect(ratio(18, 6)).toBe(3);
    expect(ratio(18, 0)).toBe(0);
    expect(ratio(Number.NaN, 6)).toBe(0);
    expect(angleRadians(left, right)).toBeCloseTo(0);
    expect(angleDegrees(top, bottom)).toBeCloseTo(90);
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
    expect(angleAtPointRadians(left, top, right)).toBeCloseTo(Math.PI / 2);
    expect(angleAtPointDegrees(left, top, right)).toBeCloseTo(90);
    expect(angleAtPointDegrees(left, null, right)).toBe(0);
  });

  it('converts detected pixel IPD to a millimeter-per-pixel scale from a reference IPD', () => {
    expect(calculatePxToMmScale(216, 63)).toBeCloseTo(63 / 216, 5);
    expect(calculatePxToMmScale(null, 63)).toBeNull();
    expect(calculatePxToMmScale(undefined, 63)).toBeNull();
    expect(calculatePxToMmScale(0, 63)).toBeNull();
    expect(calculatePxToMmScale(Number.NaN, 63)).toBeNull();
    expect(calculatePxToMmScale(216, Number.NaN)).toBeNull();
    expect(calculatePxToMmScale(216, 0)).toBeNull();
    expect(calculatePxToMmScale(216, -63)).toBeNull();
  });

  it('derives a reusable mm-per-pixel calibration scale from selected FaceMesh landmark distances', () => {
    const calibration = derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      [{
        id: 'eye-outer-width',
        start: FACE_MESH_LANDMARKS.leftEyeOuter,
        end: FACE_MESH_LANDMARKS.rightEyeOuter,
        realDistanceMm: 64,
      }],
      { width: 1080, height: 1920 },
    );

    expect(calibration).not.toBeNull();
    expect(calibration?.samples).toEqual([{
      id: 'eye-outer-width',
      pixelDistance: expect.any(Number),
      realDistanceMm: 64,
      pxToMmScale: expect.any(Number),
      confidence: 1,
    }]);
    expect(calibration?.samples[0]?.pixelDistance).toBeCloseTo(345.6, 1);
    expect(calibration?.pxToMmScale).toBeCloseTo(64 / 345.6, 5);
    expect(calibration?.confidence).toBe(1);
  });

  it('supports direct FaceMesh points and confidence-weighted calibration from multiple distances', () => {
    const landmarks = makeFrameLandmarks();
    const leftPupil = point(0.4, 0.43);
    const rightPupil = point(0.6, 0.43);
    const calibration = derivePxToMmScaleFromLandmarkDistances(
      landmarks,
      [
        {
          id: 'iris-ipd',
          start: leftPupil,
          end: rightPupil,
          realDistanceMm: 63,
          confidence: 1,
        },
        {
          id: 'brow-gap',
          start: FACE_MESH_LANDMARKS.leftBrowInner,
          end: FACE_MESH_LANDMARKS.rightBrowInner,
          realDistanceMm: 52,
          confidence: 0.5,
        },
      ],
      { width: 1080, height: 1920 },
    );

    const ipdScale = 63 / 216;
    const browScale = 52 / 172.8;
    const weightedScale = ((ipdScale * 1) + (browScale * 0.5)) / 1.5;

    expect(calibration?.samples.map((sample) => sample.id)).toEqual(['iris-ipd', 'brow-gap']);
    expect(calibration?.pxToMmScale).toBeCloseTo(weightedScale, 5);
    expect(calibration?.confidence).toBeCloseTo(0.75);
  });

  it('returns null when calibration landmarks, dimensions, or real-world distances are unusable', () => {
    expect(derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      [{ id: 'missing', start: 999, end: FACE_MESH_LANDMARKS.rightEyeOuter, realDistanceMm: 64 }],
      { width: 1080, height: 1920 },
    )).toBeNull();
    expect(derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      [{ id: 'zero-mm', start: FACE_MESH_LANDMARKS.leftEyeOuter, end: FACE_MESH_LANDMARKS.rightEyeOuter, realDistanceMm: 0 }],
      { width: 1080, height: 1920 },
    )).toBeNull();
    expect(derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      [{ id: 'missing-dimensions', start: FACE_MESH_LANDMARKS.leftEyeOuter, end: FACE_MESH_LANDMARKS.rightEyeOuter, realDistanceMm: 64 }],
      undefined,
    )).toBeNull();
  });

  it('ignores unusable calibration samples and preserves valid conversion samples', () => {
    const landmarks = makeFrameLandmarks();

    const calibration = derivePxToMmScaleFromLandmarkDistances(
      landmarks,
      [
        {
          id: 'missing-left-anchor',
          start: 999,
          end: FACE_MESH_LANDMARKS.rightEyeOuter,
          realDistanceMm: 64,
        },
        {
          id: 'zero-confidence',
          start: FACE_MESH_LANDMARKS.leftEyeOuter,
          end: FACE_MESH_LANDMARKS.rightEyeOuter,
          realDistanceMm: 64,
          confidence: 0,
        },
        {
          id: 'valid-ipd',
          start: FACE_MESH_LANDMARKS.leftEyeOuter,
          end: FACE_MESH_LANDMARKS.rightEyeOuter,
          realDistanceMm: 64,
          confidence: 0.8,
        },
      ],
      { width: 1080, height: 1920 },
    );

    expect(calibration?.samples).toHaveLength(1);
    expect(calibration?.samples[0]).toMatchObject({
      id: 'valid-ipd',
      realDistanceMm: 64,
      confidence: 0.8,
    });
    expect(calibration?.pxToMmScale).toBeCloseTo(64 / 345.6, 5);
    expect(calibration?.confidence).toBeCloseTo(0.8);
  });

  it('returns null when required calibration points are missing or non-finite', () => {
    const missingAnchorLandmarks = makeFrameLandmarks();
    delete missingAnchorLandmarks[FACE_MESH_LANDMARKS.leftEyeOuter];

    const invalidAnchorLandmarks = makeFrameLandmarks();
    invalidAnchorLandmarks[FACE_MESH_LANDMARKS.leftEyeOuter] = point(Number.NaN, 0.43);

    const calibrationDistance = [{
      id: 'eye-outer-width',
      start: FACE_MESH_LANDMARKS.leftEyeOuter,
      end: FACE_MESH_LANDMARKS.rightEyeOuter,
      realDistanceMm: 64,
    }];

    expect(derivePxToMmScaleFromLandmarkDistances(
      missingAnchorLandmarks,
      calibrationDistance,
      { width: 1080, height: 1920 },
    )).toBeNull();
    expect(derivePxToMmScaleFromLandmarkDistances(
      invalidAnchorLandmarks,
      calibrationDistance,
      { width: 1080, height: 1920 },
    )).toBeNull();
  });

  it('returns null for invalid calibration frame dimensions', () => {
    const calibrationDistance = [{
      id: 'eye-outer-width',
      start: FACE_MESH_LANDMARKS.leftEyeOuter,
      end: FACE_MESH_LANDMARKS.rightEyeOuter,
      realDistanceMm: 64,
    }];

    expect(derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      calibrationDistance,
      { width: 0, height: 1920 },
    )).toBeNull();
    expect(derivePxToMmScaleFromLandmarkDistances(
      makeFrameLandmarks(),
      calibrationDistance,
      { width: 1080, height: Number.NaN },
    )).toBeNull();
  });

  it('extracts per-frame eyebrow, eye, iris, and face-reference groups from a 478-landmark FaceMesh result', () => {
    const extraction = extractFaceFeatureLandmarks(makeFrameLandmarks());

    expect(extraction).not.toBeNull();
    expect(extraction?.rawLandmarks).toHaveLength(FACE_MESH_WITH_IRIS_LANDMARK_COUNT);
    expect(extraction?.coreLandmarks).toHaveLength(FACE_MESH_CORE_LANDMARK_COUNT);
    expect(extraction?.hasCoreFaceMesh).toBe(true);
    expect(extraction?.hasIrisLandmarks).toBe(true);
    expect(extraction?.missingRequiredIndices).toEqual([]);
    expect(extraction?.eyebrows.left).toMatchObject({
      inner: point(0.42, 0.34),
      arch: point(0.36, 0.31),
      outer: point(0.27, 0.36),
      confidence: 1,
    });
    expect(extraction?.eyebrows.right.points).toHaveLength(3);
    expect(extraction?.eyes.left.center).toEqual(point(0.38, 0.43));
    expect(extraction?.eyes.right.confidence).toBe(1);
    expect(extraction?.irises.left.center).toEqual(point(0.4, 0.43));
    expect(extraction?.irises.right.complete).toBe(true);
    expect(extraction?.faceReference).toMatchObject({
      forehead: point(0.5, 0.14),
      chin: point(0.5, 0.82),
      confidence: 1,
    });
  });

  it('normalizes extracted landmarks into a face-relative coordinate space anchored to iris IPD', () => {
    const space = normalizeLandmarksToFaceSpace(makeFrameLandmarks());

    expect(space).not.toBeNull();
    expect(space?.origin).toMatchObject({ x: 0.5, y: 0.43 });
    expect(space?.scale).toBeCloseTo(0.2);
    expect(space?.rotationDegrees).toBeCloseTo(0);
    expect(space?.xAxis.x).toBeCloseTo(1);
    expect(space?.xAxis.y).toBeCloseTo(0);
    expect(space?.yAxis.x).toBeCloseTo(0);
    expect(space?.yAxis.y).toBeCloseTo(1);
    expect(space?.confidence).toBe(1);
    expect(space?.landmarks).toHaveLength(FACE_MESH_WITH_IRIS_LANDMARK_COUNT);
    expect(space?.landmarks[468]).toMatchObject({ x: -0.45, y: 0 });
    expect(space?.landmarks[473]).toMatchObject({ x: 0.55, y: 0 });
    expect(space?.landmarks[55]).toMatchObject({ x: -0.4, y: -0.45 });
    expect(space?.landmarks[285]).toMatchObject({ x: 0.4, y: -0.45 });
  });

  it('keeps face-relative coordinates stable when the camera frame is translated or uniformly scaled', () => {
    const base = makeFrameLandmarks();
    const transformed = base.map((landmark) => point(
      0.5 + ((landmark.x - 0.5) * 0.72) + 0.06,
      0.5 + ((landmark.y - 0.5) * 0.72) - 0.04,
      landmark.z,
    ));

    const baseSpace = normalizeLandmarksToFaceSpace(base);
    const transformedSpace = normalizeLandmarksToFaceSpace(transformed);

    expect(baseSpace).not.toBeNull();
    expect(transformedSpace).not.toBeNull();
    expect(transformedSpace?.origin).not.toEqual(baseSpace?.origin);
    expect(transformedSpace?.scale).not.toBeCloseTo(baseSpace?.scale ?? 0);
    expect(transformedSpace?.landmarks[55].x).toBeCloseTo(baseSpace?.landmarks[55].x ?? 0, 5);
    expect(transformedSpace?.landmarks[55].y).toBeCloseTo(baseSpace?.landmarks[55].y ?? 0, 5);
    expect(transformedSpace?.landmarks[336].x).toBeCloseTo(baseSpace?.landmarks[336].x ?? 0, 5);
    expect(transformedSpace?.landmarks[336].y).toBeCloseTo(baseSpace?.landmarks[336].y ?? 0, 5);
  });

  it('keeps core frame extraction usable when MediaPipe does not include iris landmarks', () => {
    const extraction = extractFaceFeatureLandmarks(makeFrameLandmarks(FACE_MESH_CORE_LANDMARK_COUNT));
    const space = normalizeLandmarksToFaceSpace(makeFrameLandmarks(FACE_MESH_CORE_LANDMARK_COUNT));

    expect(extraction?.rawLandmarks).toHaveLength(FACE_MESH_CORE_LANDMARK_COUNT);
    expect(extraction?.hasCoreFaceMesh).toBe(true);
    expect(extraction?.hasIrisLandmarks).toBe(false);
    expect(extraction?.irises.left).toMatchObject({
      center: null,
      points: [],
      confidence: 0,
      complete: false,
    });
    expect(extraction?.eyes.left.center).toEqual(point(0.38, 0.43));
    expect(extraction?.eyebrows.left.confidence).toBe(1);
    expect(space?.origin).toMatchObject({ x: 0.5, y: 0.43 });
    expect(space?.scale).toBeCloseTo(0.24);
    expect(space?.confidence).toBe(1);
  });

  it('returns null before a full 468-landmark FaceMesh frame is available and reports invalid required points', () => {
    expect(extractFaceFeatureLandmarks(makeFrameLandmarks(467))).toBeNull();

    const landmarks = makeFrameLandmarks();
    landmarks[55] = point(Number.NaN, 0.34);

    expect(extractFaceFeatureLandmarks(landmarks)?.missingRequiredIndices).toContain(55);
    expect(extractFaceFeatureLandmarks(landmarks)?.eyebrows.left.inner).toBeNull();
    expect(extractFaceFeatureLandmarks(landmarks)?.eyebrows.left.confidence).toBeCloseTo(2 / 3);
  });
});
