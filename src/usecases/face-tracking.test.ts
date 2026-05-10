import { describe, expect, it, vi } from 'vitest';

import { FaceShape, type FacePoint } from '../domain/types';
import {
  buildFaceTrackingFrameState,
  buildInvalidFrameAlignment,
  EMPTY_ALIGNMENT,
  FRAME_FALLBACK_WINDOW_MS,
  type LiveTrackingSmootherPort,
  type MeasurementStabilizerPort,
  type ValidFaceTrackingFrame,
} from './face-tracking';

const point = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const makeFaceMeshLandmarks = () => {
  const landmarks = Array.from({ length: 468 }, () => point(0, 0));

  Object.assign(landmarks, {
    10: point(0.5, 0.14),
    33: point(0.34, 0.43),
    55: point(0.42, 0.34),
    65: point(0.36, 0.31),
    98: point(0.46, 0.54),
    103: point(0.3, 0.28),
    107: point(0.27, 0.36),
    133: point(0.42, 0.43),
    145: point(0.38, 0.45),
    152: point(0.5, 0.82),
    159: point(0.38, 0.41),
    164: point(0.5, 0.58),
    172: point(0.36, 0.72),
    234: point(0.23, 0.52),
    263: point(0.66, 0.43),
    285: point(0.58, 0.34),
    295: point(0.64, 0.31),
    327: point(0.54, 0.54),
    332: point(0.7, 0.28),
    336: point(0.73, 0.36),
    362: point(0.58, 0.43),
    374: point(0.62, 0.45),
    386: point(0.62, 0.41),
    397: point(0.64, 0.72),
    454: point(0.77, 0.52),
  });

  return landmarks;
};

const createPorts = () => {
  const measurementStabilizer: MeasurementStabilizerPort = {
    filter: vi.fn((analysis) => analysis),
    reset: vi.fn(),
  };
  const liveTrackingSmoother: LiveTrackingSmootherPort = {
    filter: vi.fn((sample) => sample),
    reset: vi.fn(),
  };

  return { measurementStabilizer, liveTrackingSmoother };
};

describe('face tracking usecase orchestration', () => {
  it('builds a valid tracking frame from raw landmarks without depending on React or MediaPipe', () => {
    const ports = createPorts();
    const landmarks = makeFaceMeshLandmarks();

    const result = buildFaceTrackingFrameState({
      detectedLandmarks: landmarks,
      ipdMm: 63,
      timestampMs: 1000,
      videoDimensions: { width: 1080, height: 1920 },
      lastValidFrame: null,
      ...ports,
    });

    expect(result.state.alignment.ready).toBe(true);
    expect(result.state.analysis?.faceShape).toBe(FaceShape.OVAL);
    expect(result.state.detectedFaceShape).toBe(FaceShape.OVAL);
    expect(result.state.ipdGuidance).toBeNull();
    expect(result.state.frameGuidance).toBeNull();
    expect(result.state.latestLandmarks).toHaveLength(468);
    expect(result.state.liveOverlayAnchors).not.toBeNull();
    expect(result.nextLastValidFrame?.landmarks).toHaveLength(468);
    expect(ports.measurementStabilizer.filter).toHaveBeenCalledWith(result.state.analysis, 1000);
    expect(ports.liveTrackingSmoother.filter).toHaveBeenCalledWith(
      expect.objectContaining({ landmarks: expect.any(Array) }),
      1000,
    );
  });

  it('surfaces missing-face guidance and reuses a recent last valid frame only for live landmarks', () => {
    const ports = createPorts();
    const fallback: ValidFaceTrackingFrame = {
      landmarks: [point(0.5, 0.5)],
      featureLandmarks: null,
      timestamp: 1500,
    };

    const result = buildFaceTrackingFrameState({
      detectedLandmarks: [],
      ipdMm: 63,
      timestampMs: fallback.timestamp + FRAME_FALLBACK_WINDOW_MS,
      videoDimensions: { width: 1080, height: 1920 },
      lastValidFrame: fallback,
      ...ports,
    });

    expect(result.state.alignment).toEqual(expect.objectContaining({
      detected: false,
      confidence: 0,
    }));
    expect(result.state.frameGuidance?.reason).toBe('missing_face');
    expect(result.state.latestLandmarks).toEqual(fallback.landmarks);
    expect(result.state.liveOverlayAnchors).toBeNull();
    expect(result.nextLastValidFrame).toBe(fallback);
  });

  it('drops stale fallback landmarks after the fallback window expires', () => {
    const ports = createPorts();
    const fallback: ValidFaceTrackingFrame = {
      landmarks: [point(0.5, 0.5)],
      featureLandmarks: null,
      timestamp: 1500,
    };

    const result = buildFaceTrackingFrameState({
      detectedLandmarks: [],
      ipdMm: 63,
      timestampMs: fallback.timestamp + FRAME_FALLBACK_WINDOW_MS + 1,
      videoDimensions: { width: 1080, height: 1920 },
      lastValidFrame: fallback,
      ...ports,
    });

    expect(result.state.latestLandmarks).toEqual([]);
    expect(result.state.latestFeatureLandmarks).toBeNull();
    expect(result.nextLastValidFrame).toBe(fallback);
  });

  it('keeps frame guidance clear when a valid frame lacks video dimensions for metric analysis', () => {
    const ports = createPorts();
    const landmarks = makeFaceMeshLandmarks();

    const result = buildFaceTrackingFrameState({
      detectedLandmarks: landmarks,
      ipdMm: 63,
      timestampMs: 2000,
      videoDimensions: null,
      lastValidFrame: null,
      ...ports,
    });

    expect(result.state.alignment.detected).toBe(true);
    expect(result.state.analysis).toBeNull();
    expect(result.state.frameGuidance).toBeNull();
    expect(result.state.ipdGuidance).toBeNull();
    expect(result.nextLastValidFrame).toBeNull();
  });

  it('builds explicit invalid alignments for partially detected invalid frames', () => {
    expect(buildInvalidFrameAlignment('부분 기준점 누락', true, 0.42)).toEqual({
      ...EMPTY_ALIGNMENT,
      detected: true,
      guidance: '부분 기준점 누락',
      confidence: 0.42,
    });
  });
});
