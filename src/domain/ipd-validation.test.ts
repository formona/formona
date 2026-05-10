import { describe, expect, it } from 'vitest';

import {
  buildFaceAlignment,
  buildIpdMeasurementGuidance,
  extractPupilIpd,
  validatePupilIpdMeasurement,
} from './face-analysis';
import type { FacePoint, VideoDimensions } from './types';

const dimensions: VideoDimensions = { width: 1080, height: 1920 };
const landmark = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const makeLandmarks = (overrides: Record<number, FacePoint | undefined> = {}) => {
  const landmarks = Array.from({ length: 468 }, () => landmark(0, 0));

  Object.assign(landmarks, {
    10: landmark(0.5, 0.14),
    33: landmark(0.34, 0.43),
    133: landmark(0.42, 0.43),
    145: landmark(0.38, 0.45),
    152: landmark(0.5, 0.82),
    159: landmark(0.38, 0.41),
    234: landmark(0.23, 0.52),
    263: landmark(0.66, 0.43),
    362: landmark(0.58, 0.43),
    374: landmark(0.62, 0.45),
    386: landmark(0.62, 0.41),
    454: landmark(0.77, 0.52),
    ...overrides,
  });

  return landmarks;
};

describe('IPD measurement validation', () => {
  it('classifies missing pupil landmarks and missing video pixel scale as missing landmarks', () => {
    const alignment = buildFaceAlignment(makeLandmarks());
    const withoutPixelScale = extractPupilIpd(makeLandmarks());

    expect(validatePupilIpdMeasurement(null, alignment, dimensions)).toEqual({
      valid: false,
      reason: 'missing_landmarks',
      confidence: 0,
    });
    expect(validatePupilIpdMeasurement(withoutPixelScale, alignment)).toEqual({
      valid: false,
      reason: 'missing_landmarks',
      confidence: 0,
    });
    expect(buildIpdMeasurementGuidance({
      valid: false,
      reason: 'missing_landmarks',
      confidence: 0,
    })).toMatchObject({
      reason: 'missing_landmarks',
      title: '동공 간격을 찾고 있어요',
    });
  });

  it('classifies partial eye landmarks as low confidence before using them for mm scale', () => {
    const landmarks = makeLandmarks();
    delete landmarks[159];
    delete landmarks[145];

    const pupilIpd = extractPupilIpd(landmarks, dimensions);
    const validation = validatePupilIpdMeasurement(pupilIpd, buildFaceAlignment(landmarks), dimensions);

    expect(pupilIpd?.confidence).toBe(0.5);
    expect(validation).toEqual({
      valid: false,
      reason: 'low_confidence',
      confidence: 0.5,
    });
    expect(buildIpdMeasurementGuidance(validation)).toMatchObject({
      reason: 'low_confidence',
      title: '동공 기준점이 불안정해요',
    });
  });

  it('classifies implausibly narrow detected pupil distances as invalid', () => {
    const landmarks = makeLandmarks({
      33: landmark(0.49, 0.43),
      133: landmark(0.5, 0.43),
      159: landmark(0.495, 0.41),
      145: landmark(0.495, 0.45),
      263: landmark(0.51, 0.43),
      362: landmark(0.52, 0.43),
      386: landmark(0.515, 0.41),
      374: landmark(0.515, 0.45),
    });
    const pupilIpd = extractPupilIpd(landmarks, dimensions);
    const validation = validatePupilIpdMeasurement(pupilIpd, buildFaceAlignment(landmarks), dimensions);

    expect(pupilIpd?.confidence).toBe(0.85);
    expect(validation).toEqual({
      valid: false,
      reason: 'implausible_distance',
      confidence: 0.85,
    });
    expect(buildIpdMeasurementGuidance(validation)).toMatchObject({
      reason: 'implausible_distance',
      title: '거리 기준을 다시 맞춰주세요',
    });
  });
});
