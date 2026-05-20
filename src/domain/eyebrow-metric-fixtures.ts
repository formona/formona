import { FACE_MESH_WITH_IRIS_LANDMARK_COUNT, type FaceMeshLandmarkIndex } from './face-landmarks';
import type { FacePoint, VideoDimensions } from './types';

export interface EyebrowMetricFixture {
  id: string;
  label: string;
  ipdMm: number;
  dimensions: VideoDimensions;
  landmarks: FacePoint[];
  expected: {
    sp: number;
    hp: number;
    ep: number;
    totalLength: number;
    thickness: number;
    archHeight: number;
    gap: number;
    pxToMmScale: number;
    source: 'iris' | 'eye-center';
  };
}

const defaultDimensions: VideoDimensions = { width: 1080, height: 1920 };
const defaultIpdMm = 63;

const landmark = (
  x: number,
  y: number,
  z = 0,
): FacePoint => ({ x, y, z, presence: 1, visibility: 1 });

const baseLandmarks = () => {
  const landmarks = Array.from(
    { length: FACE_MESH_WITH_IRIS_LANDMARK_COUNT },
    () => landmark(0.5, 0.5),
  );

  Object.assign(landmarks, {
    0: landmark(0.5, 0.62),
    10: landmark(0.5, 0.14),
    13: landmark(0.5, 0.66),
    33: landmark(0.34, 0.43),
    55: landmark(0.42, 0.34),
    65: landmark(0.36, 0.31),
    98: landmark(0.44, 0.57),
    103: landmark(0.3, 0.28),
    107: landmark(0.27, 0.36),
    133: landmark(0.42, 0.43),
    145: landmark(0.38, 0.45),
    152: landmark(0.5, 0.82),
    159: landmark(0.38, 0.41),
    164: landmark(0.5, 0.6),
    172: landmark(0.36, 0.72),
    234: landmark(0.23, 0.52),
    263: landmark(0.66, 0.43),
    285: landmark(0.58, 0.34),
    295: landmark(0.64, 0.31),
    327: landmark(0.56, 0.57),
    332: landmark(0.7, 0.28),
    336: landmark(0.73, 0.36),
    362: landmark(0.58, 0.43),
    374: landmark(0.62, 0.45),
    386: landmark(0.62, 0.41),
    397: landmark(0.64, 0.72),
    454: landmark(0.77, 0.52),
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

  return landmarks;
};

const withOverrides = (
  overrides: Partial<Record<FaceMeshLandmarkIndex | number, FacePoint>>,
) => {
  const landmarks = baseLandmarks();
  Object.assign(landmarks, overrides);

  return landmarks;
};

export const EYEBROW_METRIC_FIXTURES: EyebrowMetricFixture[] = [
  {
    id: 'balanced-iris-front-camera',
    label: 'Balanced front-camera face with complete iris landmarks',
    ipdMm: defaultIpdMm,
    dimensions: defaultDimensions,
    landmarks: baseLandmarks(),
    expected: {
      sp: 123.2,
      hp: 67.2,
      ep: 178.6,
      totalLength: 50.3,
      thickness: 10,
      archHeight: 22.4,
      gap: 37.8,
      pxToMmScale: defaultIpdMm / 216,
      source: 'iris',
    },
  },
  {
    id: 'right-brow-higher-and-longer',
    label: 'Right brow is slightly higher and longer while the face remains aligned',
    ipdMm: defaultIpdMm,
    dimensions: defaultDimensions,
    landmarks: withOverrides({
      295: landmark(0.65, 0.3),
      336: landmark(0.74, 0.37),
    }),
    expected: {
      sp: 121.8,
      hp: 70,
      ep: 177.1,
      totalLength: 49.8,
      thickness: 10,
      archHeight: 26.6,
      gap: 37.9,
      pxToMmScale: defaultIpdMm / 216,
      source: 'iris',
    },
  },
];

export const makeEyebrowMetricLandmarks = (
  overrides: Partial<Record<FaceMeshLandmarkIndex | number, FacePoint>> = {},
) => withOverrides(overrides);

export const makeLowConfidenceEyebrowMetricLandmarks = () => makeEyebrowMetricLandmarks({
  55: { ...landmark(0.42, 0.34), presence: 0.45, visibility: 0.45 },
});

export const makeOutOfFrameEyebrowMetricLandmarks = () => makeEyebrowMetricLandmarks({
  55: landmark(Number.NaN, 0.34),
});
