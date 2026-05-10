"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type {
  CameraPermissionState,
  EyebrowOverlayAnchors,
  ExtractedFaceFeatureLandmarks,
  FaceAlignment,
  FaceAnalysisResult,
  FacePoint,
  FaceShape,
  IpdMeasurementGuidance,
  LandmarkFrameGuidance,
} from '../../../domain/types';
import { createLiveFaceTrackingSmoother } from '../../../domain/live-tracking-smoothing';
import { createEyebrowMeasurementStabilizer } from '../../../domain/measurement-stability';
import {
  getCameraDeviceInfo,
  openFrontCameraStream,
  replaceMediaStream,
  stopMediaStream,
  type CameraDeviceInfo,
} from '../../../infrastructure/browser/media-stream';
import { getFaceLandmarker } from '../../../infrastructure/mediapipe/face-landmarker';
import {
  buildFaceTrackingFrameState,
  EMPTY_ALIGNMENT,
  type ValidFaceTrackingFrame,
} from '../../../usecases/face-tracking';

type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseFaceMeshTrackerOptions {
  ipdMm: number;
}

interface UseFaceMeshTrackerResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraPermission: CameraPermissionState;
  trackerStatus: TrackerStatus;
  stream: MediaStream | null;
  cameraDeviceInfo: CameraDeviceInfo | null;
  latestLandmarks: FacePoint[];
  latestFeatureLandmarks: ExtractedFaceFeatureLandmarks | null;
  liveOverlayAnchors: EyebrowOverlayAnchors | null;
  detectedFaceShape: FaceShape | null;
  analysis: FaceAnalysisResult | null;
  alignment: FaceAlignment;
  ipdGuidance: IpdMeasurementGuidance | null;
  frameGuidance: LandmarkFrameGuidance | null;
  errorMessage: string | null;
  requestCameraPermission: () => Promise<void>;
  stopCameraStream: () => void;
}

export const useFaceMeshTracker = ({ ipdMm }: UseFaceMeshTrackerOptions): UseFaceMeshTrackerResult => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastValidFrameRef = useRef<ValidFaceTrackingFrame | null>(null);
  const measurementStabilizerRef = useRef(createEyebrowMeasurementStabilizer());
  const liveTrackingSmootherRef = useRef(createLiveFaceTrackingSmoother());
  const stoppedRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraDeviceInfo, setCameraDeviceInfo] = useState<CameraDeviceInfo | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>('idle');
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('idle');
  const [latestLandmarks, setLatestLandmarks] = useState<FacePoint[]>([]);
  const [latestFeatureLandmarks, setLatestFeatureLandmarks] = useState<ExtractedFaceFeatureLandmarks | null>(null);
  const [liveOverlayAnchors, setLiveOverlayAnchors] = useState<EyebrowOverlayAnchors | null>(null);
  const [detectedFaceShape, setDetectedFaceShape] = useState<FaceShape | null>(null);
  const [analysis, setAnalysis] = useState<FaceAnalysisResult | null>(null);
  const [alignment, setAlignment] = useState<FaceAlignment>(EMPTY_ALIGNMENT);
  const [ipdGuidance, setIpdGuidance] = useState<IpdMeasurementGuidance | null>(null);
  const [frameGuidance, setFrameGuidance] = useState<LandmarkFrameGuidance | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCameraStream = useCallback((invalidatePendingRequest = true) => {
    if (invalidatePendingRequest) {
      cameraRequestIdRef.current += 1;
    }

    stoppedRef.current = true;
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    stopMediaStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      const attachedStream = videoRef.current.srcObject;
      if (attachedStream instanceof MediaStream) {
        stopMediaStream(attachedStream);
      }
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setStream(null);
    setCameraDeviceInfo(null);
    setLatestLandmarks([]);
    setLatestFeatureLandmarks(null);
    setLiveOverlayAnchors(null);
    setDetectedFaceShape(null);
    setAnalysis(null);
    setAlignment(EMPTY_ALIGNMENT);
    setIpdGuidance(null);
    setFrameGuidance(null);
    lastValidFrameRef.current = null;
    measurementStabilizerRef.current.reset();
    liveTrackingSmootherRef.current.reset();
  }, []);

  const surfaceCameraStartupFailure = useCallback((message: string) => {
    stopCameraStream();
    setCameraPermission('unavailable');
    setTrackerStatus('error');
    setErrorMessage(message);
  }, [stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    measurementStabilizerRef.current.reset();
    liveTrackingSmootherRef.current.reset();
  }, [ipdMm]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;
    video.muted = true;

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        surfaceCameraStartupFailure('카메라 영상 재생을 시작하지 못했습니다. 브라우저 권한을 확인한 뒤 다시 시도해주세요.');
      });
    }
  }, [stream, surfaceCameraStartupFailure]);

  useEffect(() => {
    if (!stream || cameraPermission !== 'granted') return;

    stoppedRef.current = false;
    let lastVideoTime = -1;

    const trackFrame = async () => {
      if (stoppedRef.current || !videoRef.current) return;
      const video = videoRef.current;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          setTrackerStatus((status) => (status === 'ready' ? status : 'loading'));
          const videoDimensions = video.videoWidth > 0 && video.videoHeight > 0
            ? { width: video.videoWidth, height: video.videoHeight }
            : null;

          if (!videoDimensions) {
            animationFrameRef.current = window.requestAnimationFrame(trackFrame);
            return;
          }

          const landmarker = await getFaceLandmarker();
          if (stoppedRef.current) return;

          const timestampMs = performance.now();
          const result = landmarker.detectForVideo(video, timestampMs);
          const detectedLandmarks = result.faceLandmarks[0] ?? [];
          const trackingFrame = buildFaceTrackingFrameState({
            detectedLandmarks,
            ipdMm,
            timestampMs,
            videoDimensions,
            lastValidFrame: lastValidFrameRef.current,
            measurementStabilizer: measurementStabilizerRef.current,
            liveTrackingSmoother: liveTrackingSmootherRef.current,
          });

          lastValidFrameRef.current = trackingFrame.nextLastValidFrame;

          if (stoppedRef.current) return;

          setLatestLandmarks(trackingFrame.state.latestLandmarks);
          setLatestFeatureLandmarks(trackingFrame.state.latestFeatureLandmarks);
          setLiveOverlayAnchors(trackingFrame.state.liveOverlayAnchors);
          setDetectedFaceShape(trackingFrame.state.detectedFaceShape);
          setAnalysis(trackingFrame.state.analysis);
          setAlignment(trackingFrame.state.alignment);
          setIpdGuidance(trackingFrame.state.ipdGuidance);
          setFrameGuidance(trackingFrame.state.frameGuidance);
          setTrackerStatus('ready');
        } catch {
          setTrackerStatus('error');
          setErrorMessage('FaceMesh 모델을 불러오지 못했습니다. 네트워크 연결 후 다시 시도해주세요.');
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(trackFrame);
    };

    animationFrameRef.current = window.requestAnimationFrame(trackFrame);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cameraPermission, ipdMm, stream]);

  const requestCameraPermission = useCallback(async () => {
    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;

    setCameraPermission('pending');
    setTrackerStatus('idle');
    setErrorMessage(null);

    const hasCameraApi = Boolean(navigator.mediaDevices?.getUserMedia);
    const isSecureCameraContext = window.isSecureContext || window.location.hostname === 'localhost';

    if (!hasCameraApi || !isSecureCameraContext) {
      surfaceCameraStartupFailure(
        !isSecureCameraContext
          ? '카메라는 보안 연결(HTTPS)에서만 사용할 수 있습니다.'
          : '이 브라우저에서는 카메라를 사용할 수 없습니다.'
      );
      return;
    }

    try {
      stopCameraStream(false);
      stoppedRef.current = false;

      const cameraStream = await openFrontCameraStream();

      if (requestId !== cameraRequestIdRef.current) {
        stopMediaStream(cameraStream);
        return;
      }

      const [videoTrack] = cameraStream.getVideoTracks();

      if (!videoTrack || videoTrack.readyState === 'ended') {
        stopMediaStream(cameraStream);
        surfaceCameraStartupFailure('사용 가능한 전면 카메라 영상을 찾지 못했습니다. 카메라 연결과 브라우저 권한을 확인해주세요.');
        return;
      }

      const nextStream = replaceMediaStream(streamRef.current, cameraStream);
      streamRef.current = nextStream;
      setStream(nextStream);
      setCameraDeviceInfo(getCameraDeviceInfo(nextStream));
      setCameraPermission('granted');
      setTrackerStatus('loading');
      setErrorMessage(null);
    } catch (err) {
      if (requestId !== cameraRequestIdRef.current) return;

      const error = err as DOMException;
      const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';

      stopCameraStream();
      setCameraPermission(denied ? 'denied' : 'unavailable');
      setTrackerStatus('error');
      setErrorMessage(
        denied
          ? '카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.'
          : '전면 카메라를 시작하지 못했습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.'
      );
    }
  }, [stopCameraStream, surfaceCameraStartupFailure]);

  return {
    videoRef,
    cameraPermission,
    trackerStatus,
    stream,
    cameraDeviceInfo,
    latestLandmarks,
    latestFeatureLandmarks,
    liveOverlayAnchors,
    detectedFaceShape,
    analysis,
    alignment,
    ipdGuidance,
    frameGuidance,
    errorMessage,
    requestCameraPermission,
    stopCameraStream,
  };
};
