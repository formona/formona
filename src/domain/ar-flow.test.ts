import { describe, expect, it, vi } from 'vitest';

import {
  analyzeFaceLandmarks,
  buildFaceAlignment,
  buildLandmarkFrameGuidance,
  classifyFaceShape,
  classifyFaceShapeFromGeometry,
  extractEyeGeometryMetrics,
  extractFaceDimensions,
  extractFaceProportionMetrics,
  extractEyebrowPositionMetrics,
  extractNormalizedFaceGeometry,
  extractPupilIpd,
  validateLandmarkFrame,
  validatePupilIpdMeasurement,
} from './face-analysis';
import { buildEyebrowOverlayAnchorPoints, extractFaceFeatureLandmarks } from './face-landmarks';
import { getEyebrowRecommendations } from './recommendations';
import { FaceShape, type FacePoint, type NormalizedFaceGeometry } from './types';
import { IPD_CONFIG } from '../constants';
import { replaceMediaStream, stopMediaStream } from '../infrastructure/browser/media-stream';

const landmark = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const geometry = (overrides: Partial<NormalizedFaceGeometry> = {}): NormalizedFaceGeometry => {
  const base = {
    faceWidth: 0.5,
    faceHeight: 0.7,
    jawWidth: 0.34,
    cheekWidth: 0.5,
    foreheadWidth: 0.43,
  };
  const values = { ...base, ...overrides };

  return {
    ...values,
    heightToWidth: values.faceHeight / values.faceWidth,
    jawToCheek: values.jawWidth / values.cheekWidth,
    foreheadToCheek: values.foreheadWidth / values.cheekWidth,
    cheekToFaceWidth: values.cheekWidth / values.faceWidth,
  };
};

const makeLandmarks = (overrides: Record<number, FacePoint> = {}) => {
  const landmarks = Array.from({ length: 468 }, () => landmark(0, 0));

  Object.assign(landmarks, {
    0: landmark(0.5, 0.57),
    13: landmark(0.5, 0.63),
    10: landmark(0.5, 0.14),
    33: landmark(0.34, 0.43),
    55: landmark(0.42, 0.34),
    65: landmark(0.36, 0.31),
    98: landmark(0.44, 0.56),
    103: landmark(0.3, 0.28),
    107: landmark(0.27, 0.36),
    133: landmark(0.42, 0.43),
    145: landmark(0.38, 0.45),
    164: landmark(0.5, 0.6),
    152: landmark(0.5, 0.82),
    159: landmark(0.38, 0.41),
    172: landmark(0.36, 0.72),
    234: landmark(0.23, 0.52),
    263: landmark(0.66, 0.43),
    285: landmark(0.58, 0.34),
    295: landmark(0.64, 0.31),
    327: landmark(0.56, 0.56),
    332: landmark(0.7, 0.28),
    336: landmark(0.73, 0.36),
    362: landmark(0.58, 0.43),
    374: landmark(0.62, 0.45),
    386: landmark(0.62, 0.41),
    397: landmark(0.64, 0.72),
    454: landmark(0.77, 0.52),
    ...overrides,
  });

  return landmarks;
};

describe('AR flow utilities', () => {
  it('extracts face width, face height, jaw width, cheek width, and forehead width from FaceMesh landmarks', () => {
    const dimensions = extractFaceDimensions(makeLandmarks());

    expect(dimensions?.faceWidth).toBeCloseTo(0.54);
    expect(dimensions?.faceHeight).toBeCloseTo(0.68);
    expect(dimensions?.jawWidth).toBeCloseTo(0.28);
    expect(dimensions?.cheekWidth).toBeCloseTo(0.54);
    expect(dimensions?.foreheadWidth).toBeCloseTo(0.4);
  });

  it('derives measurements, alignment, scale, overlay anchors, and overlay paths from 468 FaceMesh landmarks', () => {
    const result = analyzeFaceLandmarks(makeLandmarks(), 63, { width: 1080, height: 1920 });

    expect(result).not.toBeNull();
    expect(result?.faceShape).toBe(FaceShape.OVAL);
    expect(result?.faceDimensions).toMatchObject({
      faceWidth: expect.any(Number),
      faceHeight: expect.any(Number),
      jawWidth: expect.any(Number),
      cheekWidth: expect.any(Number),
      foreheadWidth: expect.any(Number),
    });
    expect(result?.normalizedGeometry).toMatchObject({
      faceWidth: expect.any(Number),
      faceHeight: expect.any(Number),
      jawWidth: expect.any(Number),
      cheekWidth: expect.any(Number),
      foreheadWidth: expect.any(Number),
      heightToWidth: expect.any(Number),
      jawToCheek: expect.any(Number),
      foreheadToCheek: expect.any(Number),
      cheekToFaceWidth: expect.any(Number),
    });
    expect(result?.proportionMetrics).toMatchObject({
      faceHeightToWidth: expect.any(Number),
      faceWidthToHeight: expect.any(Number),
      foreheadToFaceWidth: expect.any(Number),
      cheekToFaceWidth: expect.any(Number),
      jawToFaceWidth: expect.any(Number),
      foreheadToCheek: expect.any(Number),
      jawToCheek: expect.any(Number),
      averageBrowToEye: expect.any(Number),
      browToEyeHeight: expect.any(Number),
      browToFaceHeight: expect.any(Number),
      browGapToFaceWidth: expect.any(Number),
      browLengthToFaceWidth: expect.any(Number),
      archHeightToFaceHeight: expect.any(Number),
      eyeHeightToFaceHeight: expect.any(Number),
      eyeWidthToFaceWidth: expect.any(Number),
      interEyeToFaceWidth: expect.any(Number),
      confidence: 1,
    });
    expect(result?.proportionMetrics.faceHeightToWidth).toBeCloseTo(result?.normalizedGeometry.heightToWidth ?? 0, 4);
    expect(result?.proportionMetrics.browToEyeHeight).toBeCloseTo(3, 4);
    expect(result?.proportionMetrics.browToFaceHeight).toBeCloseTo(0.12 / 0.68, 4);
    expect(result?.faceShape).toBe(classifyFaceShapeFromGeometry(result?.normalizedGeometry ?? null));
    expect(result?.faceCoordinateSpace).toMatchObject({
      origin: { x: expect.any(Number), y: expect.any(Number) },
      scale: expect.any(Number),
      rotationDegrees: expect.any(Number),
      confidence: expect.any(Number),
      landmarks: expect.any(Array),
    });
    expect(result?.faceCoordinateSpace.landmarks[55]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(result?.measurements).toHaveLength(7);
    expect(Object.keys(result?.metrics ?? {})).toEqual([
      'sp',
      'hp',
      'ep',
      'totalLength',
      'thickness',
      'archHeight',
      'gap',
    ]);
    expect(result?.eyebrowPosition).toMatchObject({
      left: {
        browHeight: expect.any(Number),
        length: expect.any(Number),
        archHeight: expect.any(Number),
        archLocation: expect.any(Number),
      },
      right: {
        browHeight: expect.any(Number),
        length: expect.any(Number),
        archHeight: expect.any(Number),
        archLocation: expect.any(Number),
      },
      browHeight: expect.any(Number),
      browSpacing: expect.any(Number),
      archHeight: expect.any(Number),
      archLocation: expect.any(Number),
      leftRightSymmetry: expect.any(Number),
      heightAsymmetry: expect.any(Number),
      lengthAsymmetry: expect.any(Number),
      archLocationAsymmetry: expect.any(Number),
      confidence: 1,
    });
    expect(result?.eyebrowPosition.browSpacing).toBeCloseTo(result?.metrics.gap ?? 0, 4);
    expect(result?.eyebrowPosition.archHeight).toBeCloseTo(result?.metrics.archHeight ?? 0, 4);
    expect(result?.eyebrowPosition.leftRightSymmetry).toBeGreaterThan(99);
    expect(result?.eyeGeometry).toMatchObject({
      left: {
        width: expect.any(Number),
        height: expect.any(Number),
        tiltDegrees: expect.any(Number),
      },
      right: {
        width: expect.any(Number),
        height: expect.any(Number),
        tiltDegrees: expect.any(Number),
      },
      eyeWidth: expect.any(Number),
      eyeHeight: expect.any(Number),
      eyeTiltDegrees: expect.any(Number),
      interEyeSpacing: expect.any(Number),
      confidence: 1,
    });
    expect(result?.eyeGeometry.eyeWidth).toBeCloseTo(21, 1);
    expect(result?.eyeGeometry.eyeHeight).toBeCloseTo(18.7, 1);
    expect(result?.eyeGeometry.eyeTiltDegrees).toBeCloseTo(0, 3);
    expect(result?.eyeGeometry.interEyeSpacing).toBeCloseTo(42, 1);
    expect(result?.ipdMm).toBe(63);
    expect(result?.pxToMmScale).toBeCloseTo(63 / 259.2, 3);
    expect(result?.pupilIpd).toMatchObject({
      ipdPx: 259.2,
      source: 'eye-center',
    });
    expect(result?.alignment).toMatchObject({
      detected: true,
      centered: true,
      distanceOk: true,
      pitchOk: true,
      yawOk: true,
      ready: true,
      guidance: '정면 위치가 안정적입니다',
    });
    expect(result?.overlayAnchors).toMatchObject({
      left: {
        sp: { x: 0.44, y: 0.35 },
        hp: { source: 'eye-center' },
        ep: { y: 0.35 },
      },
      right: {
        sp: { x: 0.56, y: 0.35 },
        hp: { source: 'eye-center' },
        ep: { y: 0.35 },
      },
      confidence: expect.any(Number),
      transform: {
        origin: { x: expect.any(Number), y: expect.any(Number) },
        scale: expect.any(Number),
        rotationRadians: expect.any(Number),
        rotationDegrees: expect.any(Number),
        confidence: expect.any(Number),
      },
    });
    expect(result?.overlay.viewBox).toBe('0 0 100 100');
    expect(result?.overlay.left).toContain('Q');
    expect(result?.overlay.right).toContain('Q');
  });

  it('builds eyebrow overlay anchors from representative landmark positions', () => {
    const anchors = buildEyebrowOverlayAnchorPoints(makeLandmarks());

    expect(anchors).not.toBeNull();
    expect(anchors?.left.sp).toMatchObject({ x: 0.44, y: 0.35 });
    expect(anchors?.right.sp).toMatchObject({ x: 0.56, y: 0.35 });
    expect(anchors?.left.hp).toMatchObject({ source: 'eye-center', y: 0.31 });
    expect(anchors?.right.hp).toMatchObject({ source: 'eye-center', y: 0.31 });
    expect(anchors?.left.ep.y).toBeCloseTo(anchors?.left.sp.y ?? 0, 4);
    expect(anchors?.right.ep.y).toBeCloseTo(anchors?.right.sp.y ?? 0, 4);
    expect(anchors?.left.ep.x).toBeLessThan(anchors?.left.sp.x ?? 0);
    expect(anchors?.right.ep.x).toBeGreaterThan(anchors?.right.sp.x ?? 0);
    expect(anchors?.confidence).toBeCloseTo(0.78, 4);
    expect(anchors?.transform.scale).toBeGreaterThan(0);
    expect(anchors?.transform.rotationDegrees).toBeCloseTo(0);
  });

  it('preserves overlay orientation when the detected face has mild roll', () => {
    const result = analyzeFaceLandmarks(makeLandmarks({
      33: landmark(0.34, 0.44),
      133: landmark(0.42, 0.44),
      145: landmark(0.38, 0.46),
      159: landmark(0.38, 0.42),
      263: landmark(0.66, 0.42),
      362: landmark(0.58, 0.42),
      374: landmark(0.62, 0.44),
      386: landmark(0.62, 0.4),
    }), 63, { width: 1080, height: 1920 });

    expect(result).not.toBeNull();
    expect(result?.alignment.ready).toBe(true);
    expect(result?.alignment.rollDegrees).toBeGreaterThan(0);
    expect(Math.abs(result?.overlayAnchors.transform.rotationDegrees ?? 0)).toBeGreaterThan(0);
    expect(result?.overlayAnchors.transform.scale).toBeGreaterThan(0);
    expect(result?.overlayAnchors.left.sp.x).toBeGreaterThan(result?.overlayAnchors.left.ep.x ?? 0);
    expect(result?.overlayAnchors.right.sp.x).toBeLessThan(result?.overlayAnchors.right.ep.x ?? 0);
    expect(result?.overlay.left).toMatch(/^M \d+\.\d{2} \d+\.\d{2} Q \d+\.\d{2} \d+\.\d{2} \d+\.\d{2} \d+\.\d{2}$/);
    expect(result?.overlay.right).toMatch(/^M \d+\.\d{2} \d+\.\d{2} Q \d+\.\d{2} \d+\.\d{2} \d+\.\d{2} \d+\.\d{2}$/);
  });

  it('does not build overlay geometry when no face or required overlay anchors are available', () => {
    const missingNostril = makeLandmarks();
    missingNostril[98] = landmark(Number.NaN, 0.56);

    expect(buildEyebrowOverlayAnchorPoints([])).toBeNull();
    expect(buildEyebrowOverlayAnchorPoints(missingNostril)).toBeNull();
    expect(analyzeFaceLandmarks(missingNostril, 63, { width: 1080, height: 1920 })).toBeNull();
  });

  it('extracts face proportion ratios and brow-to-eye/face normalization from landmarks', () => {
    const proportions = extractFaceProportionMetrics(makeLandmarks());

    expect(proportions).not.toBeNull();
    expect(proportions?.faceHeightToWidth).toBeCloseTo(0.68 / 0.54, 4);
    expect(proportions?.faceWidthToHeight).toBeCloseTo(0.54 / 0.68, 4);
    expect(proportions?.foreheadToFaceWidth).toBeCloseTo(0.4 / 0.54, 4);
    expect(proportions?.jawToFaceWidth).toBeCloseTo(0.28 / 0.54, 4);
    expect(proportions?.averageBrowToEye).toBeCloseTo(0.12, 4);
    expect(proportions?.browToEyeHeight).toBeCloseTo(3, 4);
    expect(proportions?.browToFaceHeight).toBeCloseTo(0.12 / 0.68, 4);
    expect(proportions?.browGapToFaceWidth).toBeCloseTo(0.16 / 0.54, 4);
    expect(proportions?.eyeHeightToFaceHeight).toBeCloseTo(0.04 / 0.68, 4);
    expect(proportions?.eyeWidthToFaceWidth).toBeCloseTo(0.08 / 0.54, 4);
    expect(proportions?.interEyeToFaceWidth).toBeCloseTo(0.16 / 0.54, 4);
    expect(proportions?.confidence).toBe(1);
  });

  it('extracts iris pupil positions and computes IPD in video pixels when iris landmarks are available', () => {
    const landmarks = makeLandmarks({
      468: landmark(0.41, 0.43),
      469: landmark(0.4, 0.42),
      470: landmark(0.39, 0.43),
      471: landmark(0.4, 0.44),
      472: landmark(0.4, 0.43),
      473: landmark(0.61, 0.43),
      474: landmark(0.6, 0.42),
      475: landmark(0.59, 0.43),
      476: landmark(0.6, 0.44),
      477: landmark(0.6, 0.43),
    });

    const pupilIpd = extractPupilIpd(landmarks, { width: 1080, height: 1920 });
    const result = analyzeFaceLandmarks(landmarks, 63, { width: 1080, height: 1920 });

    expect(pupilIpd).toMatchObject({
      source: 'iris',
      leftPupil: { x: 0.4, y: 0.43 },
      rightPupil: { x: 0.6, y: 0.43 },
    });
    expect(pupilIpd?.ipdPx).toBeCloseTo(216, 3);
    expect(pupilIpd?.leftPupilPx?.x).toBeCloseTo(432, 3);
    expect(pupilIpd?.leftPupilPx?.y).toBeCloseTo(825.6, 3);
    expect(pupilIpd?.rightPupilPx?.x).toBeCloseTo(648, 3);
    expect(pupilIpd?.rightPupilPx?.y).toBeCloseTo(825.6, 3);
    expect(result?.pupilIpd.ipdPx).toBeCloseTo(216, 3);
    expect(result?.pxToMmScale).toBeCloseTo(63 / 216, 3);
  });

  it('uses the documented assumed IPD when no configurable user value is supplied', () => {
    const result = analyzeFaceLandmarks(makeLandmarks(), Number.NaN, { width: 1080, height: 1920 });

    expect(result?.ipdMm).toBe(IPD_CONFIG.defaultMm);
    expect(result?.pxToMmScale).toBeCloseTo(IPD_CONFIG.defaultMm / 259.2, 3);
  });

  it('applies the IPD-derived px-to-mm scale to every eyebrow metric in the recommendation flow', () => {
    const baseline = analyzeFaceLandmarks(makeLandmarks(), 63, { width: 1080, height: 1920 });
    const widerIpd = analyzeFaceLandmarks(makeLandmarks(), 70, { width: 1080, height: 1920 });
    const expectedRatio = 70 / 63;

    expect(baseline).not.toBeNull();
    expect(widerIpd).not.toBeNull();
    expect(widerIpd?.pxToMmScale).toBeCloseTo((baseline?.pxToMmScale ?? 0) * expectedRatio, 4);

    for (const metricName of Object.keys(baseline?.metrics ?? {}) as (keyof NonNullable<typeof baseline>['metrics'])[]) {
      expect(widerIpd?.metrics[metricName]).toBeCloseTo((baseline?.metrics[metricName] ?? 0) * expectedRatio, 4);
    }

    expect(widerIpd?.measurements.map((item) => item.value)).toEqual(
      Object.values(widerIpd?.metrics ?? {}).map((value) => `${value.toFixed(1)}mm`),
    );
  });

  it('extracts landmark-based brow height, spacing, arch location, and left-right symmetry', () => {
    const result = analyzeFaceLandmarks(makeLandmarks({
      295: landmark(0.65, 0.30),
      336: landmark(0.74, 0.37),
    }), 63, { width: 1080, height: 1920 });

    expect(result).not.toBeNull();
    expect(result?.eyebrowPosition.left.browHeight).toBeGreaterThan(0);
    expect(result?.eyebrowPosition.right.browHeight).toBeGreaterThan(0);
    expect(result?.eyebrowPosition.browSpacing).toBeCloseTo(result?.metrics.gap ?? 0, 4);
    expect(result?.eyebrowPosition.archLocation).toBeGreaterThan(0);
    expect(result?.eyebrowPosition.archLocation).toBeLessThan(1);
    expect(result?.eyebrowPosition.leftRightSymmetry).toBeGreaterThan(0);
    expect(result?.eyebrowPosition.leftRightSymmetry).toBeLessThan(100);
  });

  it('extracts landmark-based eye width, height, tilt, and inter-eye spacing', () => {
    const dimensions = { width: 1080, height: 1920 };
    const landmarks = makeLandmarks({
      133: landmark(0.42, 0.435),
      362: landmark(0.58, 0.425),
    });
    const pupilIpd = extractPupilIpd(landmarks, dimensions);
    const pxToMmScale = pupilIpd?.ipdPx ? 63 / pupilIpd.ipdPx : 0;
    const eyeGeometry = extractEyeGeometryMetrics(landmarks, pxToMmScale, dimensions);

    expect(eyeGeometry).not.toBeNull();
    expect(eyeGeometry?.left.width).toBeGreaterThan(21);
    expect(eyeGeometry?.right.width).toBeGreaterThan(21);
    expect(eyeGeometry?.eyeHeight).toBeCloseTo(18.7, 1);
    expect(eyeGeometry?.left.tiltDegrees).toBeGreaterThan(0);
    expect(eyeGeometry?.right.tiltDegrees).toBeLessThan(0);
    expect(eyeGeometry?.interEyeSpacing).toBeCloseTo(42.3, 1);
    expect(eyeGeometry?.confidence).toBe(1);
  });

  it('returns null eyebrow position metrics when required brow or eye landmarks are missing', () => {
    const landmarks = makeLandmarks();
    const pupilIpd = extractPupilIpd(landmarks, { width: 1080, height: 1920 });

    delete landmarks[55];

    expect(pupilIpd).not.toBeNull();
    expect(extractEyebrowPositionMetrics(
      landmarks,
      pupilIpd!,
      63 / 259.2,
      { width: 1080, height: 1920 },
    )).toBeNull();
    expect(extractEyeGeometryMetrics(
      landmarks,
      63 / 259.2,
      { width: 1080, height: 1920 },
    )).not.toBeNull();
  });

  it('falls back safely when required landmarks or eye-center scale are unavailable', () => {
    const landmarksMissingBrow = makeLandmarks();
    delete landmarksMissingBrow[55];

    expect(analyzeFaceLandmarks([], 63)).toBeNull();
    expect(analyzeFaceLandmarks(makeLandmarks(), 63)).toBeNull();
    expect(analyzeFaceLandmarks(landmarksMissingBrow, 63, { width: 1080, height: 1920 })).toBeNull();
    expect(extractFaceDimensions([])).toBeNull();
    expect(buildFaceAlignment([])).toMatchObject({
      detected: false,
      confidence: 0,
    });
    expect(classifyFaceShape([])).toBe(FaceShape.OVAL);
  });

  it('exposes normalized face geometry as the classifier input for downstream recommendation flow', () => {
    const roundGeometry = extractNormalizedFaceGeometry(makeLandmarks({
      10: landmark(0.5, 0.22),
      152: landmark(0.5, 0.82),
      234: landmark(0.22, 0.52),
      454: landmark(0.78, 0.52),
    }));
    const heartGeometry = extractNormalizedFaceGeometry(makeLandmarks({
      103: landmark(0.2, 0.28),
      332: landmark(0.8, 0.28),
      172: landmark(0.43, 0.72),
      397: landmark(0.57, 0.72),
    }));

    expect(roundGeometry).toMatchObject({
      heightToWidth: expect.any(Number),
      jawToCheek: expect.any(Number),
      foreheadToCheek: expect.any(Number),
    });
    expect(classifyFaceShapeFromGeometry(roundGeometry)).toBe(FaceShape.ROUND);
    expect(classifyFaceShapeFromGeometry(heartGeometry)).toBe(FaceShape.HEART);
  });

  it('deterministically maps extracted face proportions to exactly one MVP face shape', () => {
    const cases: [string, NormalizedFaceGeometry, FaceShape][] = [
      [
        'oval fallback for longer faces with cheek-width dominance',
        geometry({
          faceWidth: 0.5,
          faceHeight: 0.7,
          cheekWidth: 0.5,
          foreheadWidth: 0.43,
          jawWidth: 0.34,
        }),
        FaceShape.OVAL,
      ],
      [
        'square when forehead, cheek, and jaw widths are nearly even',
        geometry({
          faceWidth: 0.52,
          faceHeight: 0.7,
          cheekWidth: 0.52,
          foreheadWidth: 0.5,
          jawWidth: 0.49,
        }),
        FaceShape.SQUARE,
      ],
      [
        'round when height-to-width is short and cheek area is widest',
        geometry({
          faceWidth: 0.58,
          faceHeight: 0.68,
          cheekWidth: 0.58,
          foreheadWidth: 0.44,
          jawWidth: 0.42,
        }),
        FaceShape.ROUND,
      ],
      [
        'heart when forehead is widest and jaw is narrow',
        geometry({
          faceWidth: 0.58,
          faceHeight: 0.72,
          cheekWidth: 0.54,
          foreheadWidth: 0.58,
          jawWidth: 0.38,
        }),
        FaceShape.HEART,
      ],
    ];
    const supportedShapes = new Set(Object.values(FaceShape));

    for (const [label, input, expectedShape] of cases) {
      const classifiedShape = classifyFaceShapeFromGeometry(input);

      expect(classifiedShape, label).toBe(expectedShape);
      expect(supportedShapes.has(classifiedShape), label).toBe(true);
    }
  });

  it('validates IPD measurement failures for missing landmarks, low confidence, and implausible distances', () => {
    const dimensions = { width: 1080, height: 1920 };
    const alignedFace = buildFaceAlignment(makeLandmarks());

    expect(validatePupilIpdMeasurement(null, alignedFace, dimensions)).toMatchObject({
      valid: false,
      reason: 'missing_landmarks',
    });

    const missingPixelScale = extractPupilIpd(makeLandmarks());
    expect(validatePupilIpdMeasurement(missingPixelScale, alignedFace)).toMatchObject({
      valid: false,
      reason: 'missing_landmarks',
    });

    const partialEyeLandmarks = makeLandmarks();
    delete partialEyeLandmarks[159];
    delete partialEyeLandmarks[145];
    const lowConfidenceIpd = extractPupilIpd(partialEyeLandmarks, dimensions);
    expect(lowConfidenceIpd?.confidence).toBe(0.5);
    expect(validatePupilIpdMeasurement(lowConfidenceIpd, buildFaceAlignment(partialEyeLandmarks), dimensions)).toMatchObject({
      valid: false,
      reason: 'low_confidence',
    });
    expect(analyzeFaceLandmarks(partialEyeLandmarks, 63, dimensions)).toBeNull();

    const implausiblyNarrowIpd = makeLandmarks({
      33: landmark(0.49, 0.43),
      133: landmark(0.5, 0.43),
      159: landmark(0.495, 0.41),
      145: landmark(0.495, 0.45),
      263: landmark(0.51, 0.43),
      362: landmark(0.52, 0.43),
      386: landmark(0.515, 0.41),
      374: landmark(0.515, 0.45),
    });
    const implausibleIpd = extractPupilIpd(implausiblyNarrowIpd, dimensions);

    expect(implausibleIpd?.confidence).toBe(0.85);
    expect(validatePupilIpdMeasurement(implausibleIpd, buildFaceAlignment(implausiblyNarrowIpd), dimensions)).toMatchObject({
      valid: false,
      reason: 'implausible_distance',
    });
    expect(analyzeFaceLandmarks(implausiblyNarrowIpd, 63, dimensions)).toBeNull();
  });

  it('validates missing, partial, and low-confidence landmark frames before analysis', () => {
    const dimensions = { width: 1080, height: 1920 };

    expect(validateLandmarkFrame(null)).toMatchObject({
      valid: false,
      reason: 'missing_face',
      confidence: 0,
      canUseFallback: true,
    });
    expect(buildLandmarkFrameGuidance(validateLandmarkFrame(null))).toMatchObject({
      title: '얼굴을 찾고 있어요',
    });
    expect(validateLandmarkFrame(extractFaceFeatureLandmarks([]))).toMatchObject({
      valid: false,
      reason: 'missing_face',
      confidence: 0,
      canUseFallback: true,
    });

    const missingEyebrowLandmarks = makeLandmarks();
    missingEyebrowLandmarks[55] = landmark(Number.NaN, 0.34);
    const missingEyebrowValidation = validateLandmarkFrame(extractFaceFeatureLandmarks(missingEyebrowLandmarks));

    expect(missingEyebrowValidation).toMatchObject({
      valid: false,
      reason: 'missing_eyebrow_landmarks',
      canUseFallback: true,
    });
    expect(missingEyebrowValidation.missingRequiredIndices).toContain(55);
    expect(buildLandmarkFrameGuidance(missingEyebrowValidation)).toMatchObject({
      title: '눈썹 기준점을 찾고 있어요',
    });
    expect(analyzeFaceLandmarks(missingEyebrowLandmarks, 63, dimensions)).toBeNull();

    const partialLandmarks = makeLandmarks();
    partialLandmarks[152] = landmark(0.5, Number.NaN);
    const partialValidation = validateLandmarkFrame(extractFaceFeatureLandmarks(partialLandmarks));

    expect(partialValidation).toMatchObject({
      valid: false,
      reason: 'partial_landmarks',
      canUseFallback: true,
    });

    const lowConfidenceLandmarks = makeLandmarks({
      33: { ...landmark(0.34, 0.43), presence: 0.2 },
    });
    const lowConfidenceValidation = validateLandmarkFrame(extractFaceFeatureLandmarks(lowConfidenceLandmarks));

    expect(lowConfidenceValidation).toMatchObject({
      valid: false,
      reason: 'low_confidence',
      confidence: 0.2,
      canUseFallback: true,
    });
    expect(buildLandmarkFrameGuidance(lowConfidenceValidation)).toMatchObject({
      title: 'Landmark 추적이 불안정해요',
    });
    expect(analyzeFaceLandmarks(lowConfidenceLandmarks, 63, dimensions)).toBeNull();

    const lowConfidenceEyebrowLandmarks = makeLandmarks({
      55: { ...landmark(0.42, 0.34), presence: 0.7, visibility: 0.7 },
      65: { ...landmark(0.36, 0.31), presence: 0.7, visibility: 0.7 },
      107: { ...landmark(0.27, 0.36), presence: 0.7, visibility: 0.7 },
      285: { ...landmark(0.58, 0.34), presence: 0.7, visibility: 0.7 },
      295: { ...landmark(0.64, 0.31), presence: 0.7, visibility: 0.7 },
      336: { ...landmark(0.73, 0.36), presence: 0.7, visibility: 0.7 },
    });
    const lowConfidenceEyebrowValidation = validateLandmarkFrame(extractFaceFeatureLandmarks(lowConfidenceEyebrowLandmarks));

    expect(lowConfidenceEyebrowValidation).toMatchObject({
      valid: false,
      reason: 'low_confidence',
      confidence: 0.7,
      missingRequiredIndices: [],
      canUseFallback: true,
    });
    expect(analyzeFaceLandmarks(lowConfidenceEyebrowLandmarks, 63, dimensions)).toBeNull();

    expect(validateLandmarkFrame(extractFaceFeatureLandmarks(makeLandmarks()))).toMatchObject({
      valid: true,
      reason: null,
      confidence: 1,
      canUseFallback: false,
    });
  });

  it('does not return measurements when landmark alignment confidence is too low', () => {
    const tiltedFace = makeLandmarks({
      33: landmark(0.34, 0.49),
      263: landmark(0.66, 0.39),
    });

    expect(buildFaceAlignment(tiltedFace)).toMatchObject({
      confidence: 0.75,
      ready: false,
    });
    expect(analyzeFaceLandmarks(tiltedFace, 63, { width: 1080, height: 1920 })).toBeNull();
  });

  it('returns directional real-time alignment guidance from FaceMesh landmarks', () => {
    expect(buildFaceAlignment(makeLandmarks({
      234: landmark(0.05, 0.52),
      454: landmark(0.45, 0.52),
    }))).toMatchObject({
      centered: false,
      horizontalDirection: 'left',
      guidance: '얼굴을 오른쪽으로 조금 이동해주세요',
      ready: false,
    });

    expect(buildFaceAlignment(makeLandmarks({
      10: landmark(0.5, 0.32),
      152: landmark(0.5, 0.62),
    }))).toMatchObject({
      distanceState: 'too_far',
      distanceOk: false,
      guidance: '가이드 라인에 맞게 조금 가까이 와주세요',
      ready: false,
    });

    expect(buildFaceAlignment(makeLandmarks({
      33: landmark(0.34, 0.49),
      263: landmark(0.66, 0.39),
    }))).toMatchObject({
      yawOk: false,
      guidance: '고개를 기울이지 말고 정면을 바라봐 주세요',
      ready: false,
    });
  });

  it('maps every supported face shape to three recommendation styles', () => {
    const shapes = [FaceShape.OVAL, FaceShape.SQUARE, FaceShape.ROUND, FaceShape.HEART];

    for (const shape of shapes) {
      const recommendations = getEyebrowRecommendations(shape);

      expect(recommendations).toHaveLength(3);
      expect(recommendations.every((style) => style.id && style.name && style.path)).toBe(true);
    }

    expect(getEyebrowRecommendations(FaceShape.ROUND).map((style) => style.id)).toContain('angular_arch');
  });

  it('stops stale camera tracks when replacing or stopping streams', () => {
    const oldTrack = { readyState: 'live' as MediaStreamTrackState, stop: vi.fn() };
    const endedTrack = { readyState: 'ended' as MediaStreamTrackState, stop: vi.fn() };
    const nextTrack = { readyState: 'live' as MediaStreamTrackState, stop: vi.fn() };
    const oldStream = { getTracks: () => [oldTrack, endedTrack] };
    const nextStream = { getTracks: () => [nextTrack] };

    expect(replaceMediaStream(oldStream, nextStream)).toBe(nextStream);
    expect(oldTrack.stop).toHaveBeenCalledOnce();
    expect(endedTrack.stop).not.toHaveBeenCalled();

    stopMediaStream(nextStream);
    expect(nextTrack.stop).toHaveBeenCalledOnce();
  });
});
