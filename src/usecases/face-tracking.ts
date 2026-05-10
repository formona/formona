import {
  analyzeFaceLandmarks,
  buildFaceAlignment,
  buildIpdMeasurementGuidance,
  buildLandmarkFrameGuidance,
  extractPupilIpd,
  validateLandmarkFrame,
  validatePupilIpdMeasurement,
} from '../domain/face-analysis';
import { buildEyebrowOverlayAnchorPoints, extractFaceFeatureLandmarks } from '../domain/face-landmarks';
import type { LiveFaceTrackingSample } from '../domain/live-tracking-smoothing';
import type {
  EyebrowOverlayAnchors,
  ExtractedFaceFeatureLandmarks,
  FaceAlignment,
  FaceAnalysisResult,
  FacePoint,
  FaceShape,
  IpdMeasurementGuidance,
  LandmarkFrameGuidance,
  VideoDimensions,
} from '../domain/types';

export interface MeasurementStabilizerPort {
  filter: (analysis: FaceAnalysisResult | null, timestampMs: number) => FaceAnalysisResult | null;
  reset: () => void;
}

export interface LiveTrackingSmootherPort {
  filter: (sample: LiveFaceTrackingSample | null, timestampMs: number) => LiveFaceTrackingSample | null;
  reset: () => void;
}

export interface ValidFaceTrackingFrame {
  landmarks: FacePoint[];
  featureLandmarks: ExtractedFaceFeatureLandmarks | null;
  timestamp: number;
}

export interface FaceTrackingFrameInput {
  detectedLandmarks: FacePoint[];
  ipdMm: number;
  timestampMs: number;
  videoDimensions: VideoDimensions | null;
  lastValidFrame: ValidFaceTrackingFrame | null;
  measurementStabilizer: MeasurementStabilizerPort;
  liveTrackingSmoother: LiveTrackingSmootherPort;
}

export interface FaceTrackingFrameState {
  latestLandmarks: FacePoint[];
  latestFeatureLandmarks: ExtractedFaceFeatureLandmarks | null;
  liveOverlayAnchors: EyebrowOverlayAnchors | null;
  detectedFaceShape: FaceShape | null;
  analysis: FaceAnalysisResult | null;
  alignment: FaceAlignment;
  ipdGuidance: IpdMeasurementGuidance | null;
  frameGuidance: LandmarkFrameGuidance | null;
}

export interface FaceTrackingFrameResult {
  state: FaceTrackingFrameState;
  nextLastValidFrame: ValidFaceTrackingFrame | null;
}

export const EMPTY_ALIGNMENT: FaceAlignment = {
  detected: false,
  centered: false,
  distanceOk: false,
  pitchOk: false,
  yawOk: false,
  guidance: '가이드 라인에 맞춰주세요',
  confidence: 0,
  distanceState: 'unknown',
  horizontalDirection: 'center',
  verticalDirection: 'center',
  ready: false,
};

export const FRAME_FALLBACK_WINDOW_MS = 900;

export const buildInvalidFrameAlignment = (
  guidance: string,
  detected: boolean,
  confidence = 0,
): FaceAlignment => ({
  ...EMPTY_ALIGNMENT,
  detected,
  guidance,
  confidence,
});

export const buildFaceTrackingFrameState = ({
  detectedLandmarks,
  ipdMm,
  timestampMs,
  videoDimensions,
  lastValidFrame,
  measurementStabilizer,
  liveTrackingSmoother,
}: FaceTrackingFrameInput): FaceTrackingFrameResult => {
  const featureLandmarks = extractFaceFeatureLandmarks(detectedLandmarks);
  const frameValidation = validateLandmarkFrame(featureLandmarks);
  const nextFrameGuidance = buildLandmarkFrameGuidance(frameValidation);
  const faceMeshLandmarks = featureLandmarks?.coreLandmarks ?? [];
  const analysisLandmarks = featureLandmarks?.rawLandmarks ?? [];
  const nextLiveOverlayAnchors = frameValidation.valid && analysisLandmarks.length
    ? buildEyebrowOverlayAnchorPoints(analysisLandmarks)
    : null;
  const nextAlignment = frameValidation.valid && featureLandmarks?.hasCoreFaceMesh
    ? buildFaceAlignment(featureLandmarks.coreLandmarks)
    : buildInvalidFrameAlignment(
      nextFrameGuidance?.message ?? EMPTY_ALIGNMENT.guidance,
      frameValidation.reason !== 'missing_face',
      frameValidation.confidence,
    );
  const pupilIpd = frameValidation.valid && analysisLandmarks.length
    ? extractPupilIpd(analysisLandmarks, videoDimensions ?? undefined)
    : null;
  const ipdValidation = frameValidation.valid && analysisLandmarks.length && videoDimensions && nextAlignment.detected
    ? validatePupilIpdMeasurement(pupilIpd, nextAlignment, videoDimensions)
    : { valid: true, reason: null, confidence: 0 };
  const nextIpdGuidance = buildIpdMeasurementGuidance(ipdValidation);
  const rawAnalysis = frameValidation.valid && analysisLandmarks.length
    ? analyzeFaceLandmarks(analysisLandmarks, ipdMm, videoDimensions ?? undefined)
    : null;
  const nextAnalysis = measurementStabilizer.filter(rawAnalysis, timestampMs);
  const nextDetectedFaceShape = nextAnalysis?.faceShape ?? null;
  const fallback = frameValidation.canUseFallback
    && lastValidFrame
    && timestampMs - lastValidFrame.timestamp <= FRAME_FALLBACK_WINDOW_MS
    ? lastValidFrame
    : null;

  const liveTrackingSample = frameValidation.valid
    ? {
      landmarks: faceMeshLandmarks,
      overlayAnchors: nextLiveOverlayAnchors,
    }
    : fallback
      ? {
        landmarks: fallback.landmarks,
        overlayAnchors: null,
      }
      : null;
  const smoothedLiveTracking = liveTrackingSmoother.filter(liveTrackingSample, timestampMs);

  return {
    state: {
      latestLandmarks: smoothedLiveTracking?.landmarks ?? [],
      latestFeatureLandmarks: frameValidation.valid ? featureLandmarks : fallback?.featureLandmarks ?? null,
      liveOverlayAnchors: smoothedLiveTracking?.overlayAnchors ?? null,
      detectedFaceShape: nextDetectedFaceShape,
      analysis: nextAnalysis,
      alignment: nextAlignment,
      ipdGuidance: nextAnalysis || nextFrameGuidance ? null : nextIpdGuidance,
      frameGuidance: nextAnalysis ? null : nextFrameGuidance,
    },
    nextLastValidFrame: rawAnalysis
      ? {
        landmarks: faceMeshLandmarks,
        featureLandmarks,
        timestamp: timestampMs,
      }
      : lastValidFrame,
  };
};
