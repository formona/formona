import { describe, expect, it } from 'vitest';

import {
  analyzeFaceLandmarks,
  classifyFaceShape,
  classifyFaceShapeFromGeometry,
  extractNormalizedFaceGeometry,
} from './face-analysis';
import {
  FACE_SHAPE_BOUNDARY_FIXTURES,
  FACE_SHAPE_VALIDATION_FIXTURES,
  getFaceShapeValidationFixture,
} from './face-shape-fixtures';
import { getEyebrowRecommendations } from './recommendations';
import { FaceShape } from './types';

const EXPECTED_RECOMMENDATION_IDS: Record<FaceShape, string[]> = {
  [FaceShape.OVAL]: ['natural_arch', 'straight', 'soft_curve'],
  [FaceShape.SQUARE]: ['soft_arch', 'curved', 'round'],
  [FaceShape.ROUND]: ['angular_arch', 'upward', 'straight_angular'],
  [FaceShape.HEART]: ['straight_horizontal', 'soft_straight', 'low_arch'],
};

describe('face shape validation fixtures', () => {
  it('provides one reusable 468-landmark fixture for each supported MVP face shape', () => {
    const expectedShapes = Object.values(FaceShape);

    expect(FACE_SHAPE_VALIDATION_FIXTURES).toHaveLength(expectedShapes.length);
    expect(FACE_SHAPE_VALIDATION_FIXTURES.map((fixture) => fixture.expectedShape).sort()).toEqual(
      expectedShapes.sort(),
    );

    for (const fixture of FACE_SHAPE_VALIDATION_FIXTURES) {
      expect(fixture.landmarks).toHaveLength(468);
      expect(fixture.id).toEqual(expect.any(String));
      expect(fixture.label).toContain(fixture.expectedShape);
      expect(fixture.rationale).toEqual(expect.any(String));
    }
  });

  it('round-trips fixture geometry through FaceMesh extraction and the rule classifier', () => {
    for (const fixture of FACE_SHAPE_VALIDATION_FIXTURES) {
      const extractedGeometry = extractNormalizedFaceGeometry(fixture.landmarks);

      expect(extractedGeometry, fixture.id).toMatchObject(fixture.geometry);
      expect(classifyFaceShapeFromGeometry(fixture.geometry), fixture.id).toBe(fixture.expectedShape);
      expect(classifyFaceShape(fixture.landmarks), fixture.id).toBe(fixture.expectedShape);
    }
  });

  it('supports full demo analysis without mocked or random values', () => {
    for (const fixture of FACE_SHAPE_VALIDATION_FIXTURES) {
      const result = analyzeFaceLandmarks(fixture.landmarks, 63, { width: 1080, height: 1920 });

      expect(result?.faceShape, fixture.id).toBe(fixture.expectedShape);
      expect(result?.measurements, fixture.id).toHaveLength(7);
      expect(result?.pxToMmScale, fixture.id).toBeGreaterThan(0);
      expect(result?.overlay.left, fixture.id).toContain('M ');
      expect(result?.overlay.right, fixture.id).toContain('M ');
    }
  });

  it('maps each classified fixture to the expected three eyebrow recommendations', () => {
    for (const fixture of FACE_SHAPE_VALIDATION_FIXTURES) {
      const detectedShape = classifyFaceShape(fixture.landmarks);
      const recommendations = getEyebrowRecommendations(detectedShape);

      expect(detectedShape, fixture.id).toBe(fixture.expectedShape);
      expect(recommendations, fixture.id).toHaveLength(3);
      expect(recommendations.map((recommendation) => recommendation.id), fixture.id).toEqual(
        EXPECTED_RECOMMENDATION_IDS[fixture.expectedShape],
      );
      expect(recommendations.every((recommendation) => recommendation.name && recommendation.path), fixture.id).toBe(true);
    }
  });

  it('returns fixtures by supported face shape', () => {
    for (const shape of Object.values(FaceShape)) {
      expect(getFaceShapeValidationFixture(shape)?.expectedShape).toBe(shape);
    }
  });

  it('documents threshold-adjacent face-shape boundary behavior with reusable fixtures', () => {
    expect(FACE_SHAPE_BOUNDARY_FIXTURES).toHaveLength(9);
    expect(new Set(FACE_SHAPE_BOUNDARY_FIXTURES.map((fixture) => fixture.boundary))).toEqual(
      new Set(['heart', 'square', 'round']),
    );

    for (const fixture of FACE_SHAPE_BOUNDARY_FIXTURES) {
      expect(fixture.landmarks, fixture.id).toHaveLength(468);
      expect(fixture.rationale, fixture.id).toEqual(expect.any(String));
      expect(extractNormalizedFaceGeometry(fixture.landmarks), fixture.id).toMatchObject(fixture.geometry);
      expect(classifyFaceShapeFromGeometry(fixture.geometry), fixture.id).toBe(fixture.expectedShape);
      expect(classifyFaceShape(fixture.landmarks), fixture.id).toBe(fixture.expectedShape);
    }
  });
});
