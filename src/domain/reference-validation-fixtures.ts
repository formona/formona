import { EYEBROW_METRIC_FIXTURES } from './eyebrow-metric-fixtures';
import { FaceShape, type EyebrowMetrics, type FacePoint, type VideoDimensions } from './types';

export interface FaceMeasurementMm {
  faceWidth: number;
  faceHeight: number;
  foreheadWidth: number;
  cheekWidth: number;
  jawWidth: number;
}

export interface ReferenceValidationFixture {
  id: string;
  label: string;
  ipdMm: number;
  dimensions: VideoDimensions;
  landmarks: FacePoint[];
  expected: {
    faceShape: FaceShape;
    pupilSource: 'iris' | 'eye-center';
    pxToMmScale: number;
    faceMm: FaceMeasurementMm;
    eyebrowMm: EyebrowMetrics;
  };
  toleranceMm: number;
  rationale: string;
}

const balancedFixture = EYEBROW_METRIC_FIXTURES[0];
const asymmetricFixture = EYEBROW_METRIC_FIXTURES[1];

export const REFERENCE_VALIDATION_FIXTURES: ReferenceValidationFixture[] = [
  {
    id: 'reference-balanced-oval-iris',
    label: 'Reference oval face with balanced brows and complete iris landmarks',
    ipdMm: balancedFixture.ipdMm,
    dimensions: balancedFixture.dimensions,
    landmarks: balancedFixture.landmarks,
    expected: {
      faceShape: FaceShape.OVAL,
      pupilSource: balancedFixture.expected.source,
      pxToMmScale: balancedFixture.expected.pxToMmScale,
      faceMm: {
        faceWidth: 170.1,
        faceHeight: 380.8,
        foreheadWidth: 126,
        cheekWidth: 170.1,
        jawWidth: 88.2,
      },
      eyebrowMm: {
        sp: balancedFixture.expected.sp,
        hp: balancedFixture.expected.hp,
        ep: balancedFixture.expected.ep,
        totalLength: balancedFixture.expected.totalLength,
        thickness: balancedFixture.expected.thickness,
        archHeight: balancedFixture.expected.archHeight,
        gap: balancedFixture.expected.gap,
      },
    },
    toleranceMm: 0.2,
    rationale: 'Locks the canonical MVP demo frame to known mm outputs for IPD scale, face dimensions, and eyebrow measurements.',
  },
  {
    id: 'reference-asymmetric-oval-iris',
    label: 'Reference oval face with a higher and longer right brow',
    ipdMm: asymmetricFixture.ipdMm,
    dimensions: asymmetricFixture.dimensions,
    landmarks: asymmetricFixture.landmarks,
    expected: {
      faceShape: FaceShape.OVAL,
      pupilSource: asymmetricFixture.expected.source,
      pxToMmScale: asymmetricFixture.expected.pxToMmScale,
      faceMm: {
        faceWidth: 170.1,
        faceHeight: 380.8,
        foreheadWidth: 126,
        cheekWidth: 170.1,
        jawWidth: 88.2,
      },
      eyebrowMm: {
        sp: asymmetricFixture.expected.sp,
        hp: asymmetricFixture.expected.hp,
        ep: asymmetricFixture.expected.ep,
        totalLength: asymmetricFixture.expected.totalLength,
        thickness: asymmetricFixture.expected.thickness,
        archHeight: asymmetricFixture.expected.archHeight,
        gap: asymmetricFixture.expected.gap,
      },
    },
    toleranceMm: 0.2,
    rationale: 'Preserves a second reference frame that proves fixture validation catches brow asymmetry without changing face-shape classification.',
  },
];

export const getReferenceValidationFixture = (id: string) => (
  REFERENCE_VALIDATION_FIXTURES.find((fixture) => fixture.id === id) ?? null
);
