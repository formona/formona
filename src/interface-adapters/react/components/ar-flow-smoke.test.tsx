import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturePage } from './CapturePage';
import { RecommendationResults } from './RecommendationResults';
import { ResultPage } from './ResultPage';
import { APP_TIMING_MS, FACE_SHAPE_RESULT_COPY } from '../../../constants';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../../domain/measurement-copy';
import { buildEyebrowRecommendationContext, getEyebrowRecommendations } from '../../../usecases/eyebrow-recommendations';
import {
  FaceShape,
  type CameraPermissionState,
  type EyebrowMetricConfidenceModel,
  type EyebrowOverlayAnchors,
  type FaceAlignment,
  type FaceAnalysisResult,
  type IpdMeasurementGuidance,
  type LandmarkFrameGuidance,
} from '../../../domain/types';

type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

const originalDevicePixelRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
let canvasContextMock: Record<string, ReturnType<typeof vi.fn>>;

interface MockTrackerState {
  videoRef: { current: HTMLVideoElement | null };
  cameraPermission: CameraPermissionState;
  trackerStatus: TrackerStatus;
  detectedFaceShape: FaceShape | null;
  analysis: FaceAnalysisResult | null;
  liveOverlayAnchors?: EyebrowOverlayAnchors | null;
  alignment: FaceAlignment;
  ipdGuidance: IpdMeasurementGuidance | null;
  frameGuidance: LandmarkFrameGuidance | null;
  errorMessage: string | null;
  requestCameraPermission: ReturnType<typeof vi.fn>;
  stopCameraStream: ReturnType<typeof vi.fn>;
}

const trackerMock = vi.hoisted(() => {
  const idleAlignment: FaceAlignment = {
    detected: false,
    centered: false,
    distanceOk: false,
    pitchOk: false,
    yawOk: false,
    guidance: '가이드 라인에 맞춰주세요',
    confidence: 0,
  };

  return {
    videoRef: { current: null as HTMLVideoElement | null },
    requestCameraPermission: vi.fn(),
    stopCameraStream: vi.fn(),
    state: {
      videoRef: { current: null as HTMLVideoElement | null },
      cameraPermission: 'idle',
      trackerStatus: 'idle',
      detectedFaceShape: null,
      analysis: null,
      alignment: idleAlignment,
      ipdGuidance: null,
      frameGuidance: null,
      errorMessage: null,
      requestCameraPermission: vi.fn(),
      stopCameraStream: vi.fn(),
    } as MockTrackerState,
    idleAlignment,
  };
});

vi.mock('../hooks/useFaceMeshTracker', () => ({
  useFaceMeshTracker: () => trackerMock.state,
}));

const readyAlignment: FaceAlignment = {
  detected: true,
  centered: true,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  guidance: '정면 위치가 안정적입니다',
  confidence: 0.88,
  ready: true,
};

const offCenterAlignment: FaceAlignment = {
  detected: true,
  centered: false,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  guidance: '얼굴을 오른쪽으로 조금 이동해주세요',
  confidence: 0.75,
  horizontalDirection: 'left',
  verticalDirection: 'center',
  distanceState: 'ok',
  ready: false,
};

const offGazeAlignment: FaceAlignment = {
  detected: true,
  centered: true,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  gazeOk: false,
  gazeDirection: 'right',
  gazeVerticalDirection: 'center',
  guidance: '카메라 렌즈를 정면으로 바라봐 주세요',
  confidence: 0.8,
  horizontalDirection: 'center',
  verticalDirection: 'center',
  distanceState: 'ok',
  ready: false,
};

const mockOverlayAnchors: EyebrowOverlayAnchors = {
  left: {
    sp: { x: 0.44, y: 0.35 },
    hp: { x: 0.38, y: 0.31, source: 'iris' },
    ep: { x: 0.28, y: 0.35 },
    confidence: 1,
    guides: {
      spLine: {
        start: { x: 0.44, y: 0.57 },
        end: { x: 0.44, y: 0.35 },
      },
      hpLine: {
        start: { x: 0.38, y: 0.43, source: 'iris' },
        end: { x: 0.38, y: 0.31, source: 'iris' },
      },
      epLine: {
        start: { x: 0.5, y: 0.66 },
        end: { x: 0.28, y: 0.35 },
      },
      goldenRatioTarget: { x: 0.34, y: 0.35 },
    },
  },
  right: {
    sp: { x: 0.56, y: 0.35 },
    hp: { x: 0.62, y: 0.31, source: 'iris' },
    ep: { x: 0.72, y: 0.35 },
    confidence: 1,
    guides: {
      spLine: {
        start: { x: 0.56, y: 0.57 },
        end: { x: 0.56, y: 0.35 },
      },
      hpLine: {
        start: { x: 0.62, y: 0.43, source: 'iris' },
        end: { x: 0.62, y: 0.31, source: 'iris' },
      },
      epLine: {
        start: { x: 0.5, y: 0.66 },
        end: { x: 0.72, y: 0.35 },
      },
      goldenRatioTarget: { x: 0.66, y: 0.35 },
    },
  },
  confidence: 1,
  transform: {
    origin: { x: 0.5, y: 0.45 },
    scale: 0.24,
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
  },
};

const makeMetricConfidence = ({
  reportable = true,
  overallConfidence = 0.9,
  maxEstimatedErrorMm = 2.8,
}: {
  reportable?: boolean;
  overallConfidence?: number;
  maxEstimatedErrorMm?: number;
} = {}): EyebrowMetricConfidenceModel => {
  const metrics = {
    sp: 18.2,
    hp: 33.4,
    ep: 49.1,
    totalLength: 50.2,
    thickness: 6.1,
    archHeight: 7.3,
    gap: 21,
  };

  return {
    targetErrorMm: 3,
    eligibilityErrorMm: 5,
    minReportableConfidence: 0.75,
    highConfidence: 0.85,
    overallConfidence,
    maxEstimatedErrorMm,
    reportable,
    metrics: Object.fromEntries(
      Object.keys(metrics).map((key) => [
        key,
        {
          key,
          confidence: overallConfidence,
          estimatedErrorMm: maxEstimatedErrorMm,
          targetErrorMm: 3,
          eligibilityErrorMm: 5,
          reportable,
          band: reportable ? 'target' : 'ineligible',
          reasons: reportable
            ? ['stable_iris_scale', 'alignment_stable', 'landmarks_stable']
            : ['stable_iris_scale', 'alignment_unstable', 'landmarks_unstable'],
        },
      ]),
    ) as EyebrowMetricConfidenceModel['metrics'],
  };
};

const makeAnalysis = (): FaceAnalysisResult => ({
  faceShape: FaceShape.OVAL,
  faceDimensions: {
    faceWidth: 0.54,
    faceHeight: 0.68,
    jawWidth: 0.28,
    cheekWidth: 0.54,
    foreheadWidth: 0.4,
  },
  normalizedGeometry: {
    faceWidth: 0.54,
    faceHeight: 0.68,
    jawWidth: 0.28,
    cheekWidth: 0.54,
    foreheadWidth: 0.4,
    heightToWidth: 0.68 / 0.54,
    jawToCheek: 0.28 / 0.54,
    foreheadToCheek: 0.4 / 0.54,
    cheekToFaceWidth: 1,
  },
  proportionMetrics: {
    faceHeightToWidth: 0.68 / 0.54,
    faceWidthToHeight: 0.54 / 0.68,
    foreheadToFaceWidth: 0.4 / 0.54,
    cheekToFaceWidth: 1,
    jawToFaceWidth: 0.28 / 0.54,
    foreheadToCheek: 0.4 / 0.54,
    jawToCheek: 0.28 / 0.54,
    averageBrowToEye: 0.12,
    browToEyeHeight: 3,
    browToFaceHeight: 0.12 / 0.68,
    browGapToFaceWidth: 0.16 / 0.54,
    browLengthToFaceWidth: 0.24,
    archHeightToFaceHeight: 0,
    eyeHeightToFaceHeight: 0.04 / 0.68,
    eyeWidthToFaceWidth: 0.08 / 0.54,
    interEyeToFaceWidth: 0.16 / 0.54,
    confidence: 1,
  },
  faceCoordinateSpace: {
    origin: { x: 0.5, y: 0.43 },
    scale: 0.2,
    xAxis: { x: 1, y: 0 },
    yAxis: { x: 0, y: 1 },
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
    landmarks: Array.from({ length: 478 }, () => ({ x: 0, y: 0 })),
  },
  measurements: [
    { label: 'SP', value: '18.2mm' },
    { label: 'HP', value: '33.4mm' },
    { label: 'EP', value: '49.1mm' },
    { label: '전체 길이', value: '50.2mm' },
    { label: '두께', value: '6.1mm' },
    { label: '아치 높이', value: '7.3mm' },
    { label: '미간 간격', value: '21.0mm' },
  ],
  metrics: {
    sp: 18.2,
    hp: 33.4,
    ep: 49.1,
    totalLength: 50.2,
    thickness: 6.1,
    archHeight: 7.3,
    gap: 21,
  },
  metricConfidence: makeMetricConfidence(),
  eyebrowPosition: {
    left: {
      browHeight: 17.5,
      length: 50.1,
      archHeight: 7.1,
      archLocation: 0.48,
      startToPupil: 18.3,
      archToPupil: 33.2,
      endToPupil: 49.4,
    },
    right: {
      browHeight: 17.1,
      length: 50.3,
      archHeight: 7.5,
      archLocation: 0.5,
      startToPupil: 18.1,
      archToPupil: 33.6,
      endToPupil: 48.8,
    },
    browHeight: 17.3,
    browSpacing: 21,
    archHeight: 7.3,
    archLocation: 0.49,
    leftRightSymmetry: 98.6,
    heightAsymmetry: 0.02,
    lengthAsymmetry: 0.004,
    archLocationAsymmetry: 0.02,
    confidence: 1,
  },
  eyeGeometry: {
    left: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    right: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    eyeWidth: 21,
    eyeHeight: 18.7,
    eyeTiltDegrees: 0,
    interEyeSpacing: 42,
    confidence: 1,
  },
  ipdMm: 63,
  pupilIpd: {
    leftPupil: { x: 0.4, y: 0.43 },
    rightPupil: { x: 0.6, y: 0.43 },
    leftPupilPx: { x: 432, y: 825.6 },
    rightPupilPx: { x: 648, y: 825.6 },
    ipdPx: 216,
    normalizedIpd: 0.2,
    source: 'iris',
    confidence: 1,
  },
  pxToMmScale: 63 / 216,
  alignment: readyAlignment,
  overlayAnchors: mockOverlayAnchors,
  overlay: {
    left: 'M10,20 Q50,10 90,20',
    right: 'M10,20 Q50,10 90,20',
    viewBox: '0 0 100 100',
  },
  measurementStability: {
    state: 'stable',
    sampleCount: 4,
    heldForMs: 0,
    maxDeltaMm: 0.4,
    smoothingAlpha: 0.35,
  },
});

const renderCapturePage = (onAnalysisComplete = vi.fn()) => {
  const view = render(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

  return { ...view, onAnalysisComplete };
};

describe('MVP AR eyebrow recommendation flow smoke states', () => {
  beforeEach(() => {
    trackerMock.requestCameraPermission = vi.fn();
    trackerMock.stopCameraStream = vi.fn();
    trackerMock.state = {
      videoRef: trackerMock.videoRef,
      cameraPermission: 'idle',
      trackerStatus: 'idle',
      detectedFaceShape: null,
      analysis: null,
      alignment: trackerMock.idleAlignment,
      ipdGuidance: null,
      frameGuidance: null,
      errorMessage: null,
      requestCameraPermission: trackerMock.requestCameraPermission,
      stopCameraStream: trackerMock.stopCameraStream,
    };

    canvasContextMock = {
      beginPath: vi.fn(),
      bezierCurveTo: vi.fn(),
      arc: vi.fn(),
      clearRect: vi.fn(),
      closePath: vi.fn(),
      drawImage: vi.fn(),
      fill: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContextMock as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,monabrow');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (originalDevicePixelRatio) {
      Object.defineProperty(window, 'devicePixelRatio', originalDevicePixelRatio);
    } else {
      Reflect.deleteProperty(window, 'devicePixelRatio');
    }
  });

  it('requests the camera automatically when remounted for retry capture', () => {
    render(<CapturePage ipdMm={63} autoStartCamera onAnalysisComplete={vi.fn()} />);

    expect(trackerMock.requestCameraPermission).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '카메라 허용' })).toBeInTheDocument();
  });

  it('transitions CapturePage from loading to camera-ready to face-detected and analysis-loading', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1920);
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'loading',
      alignment: trackerMock.idleAlignment,
      analysis: null,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('FaceMesh 준비 중')).toBeInTheDocument();
    expect(screen.getByText('정렬 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '얼굴 정렬 필요' })).toBeDisabled();

    trackerMock.state = {
      ...trackerMock.state,
      trackerStatus: 'ready',
      alignment: trackerMock.idleAlignment,
      analysis: null,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('FaceMesh 추적 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '얼굴 정렬 필요' })).toBeDisabled();

    const analysis = { ...makeAnalysis(), faceShape: FaceShape.ROUND };
    trackerMock.state = {
      ...trackerMock.state,
      trackerStatus: 'ready',
      detectedFaceShape: FaceShape.OVAL,
      alignment: readyAlignment,
      analysis,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    const captureButton = screen.getByRole('button', { name: '인식 완료' });
    expect(screen.getByText('인식 완료')).toBeInTheDocument();
    expect(screen.getByText('계란형 감지')).toBeInTheDocument();
    expect(screen.getByText('정면 위치가 안정적입니다')).toBeInTheDocument();
    expect(captureButton).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.recognitionHold);
    });

    expect(trackerMock.stopCameraStream).toHaveBeenCalledOnce();
    expect(screen.getByText('AI 스타일 정밀 분석')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.analysisTransition);
    });

    expect(onAnalysisComplete).toHaveBeenCalledWith('data:image/jpeg;base64,monabrow', analysis);
  });

  it('normalizes a mobile landscape camera frame to the result photo aspect ratio', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1920);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function getClientWidth(this: HTMLElement) {
      return this.tagName === 'VIDEO' ? 0 : 390;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.tagName === 'VIDEO' ? 0 : 640;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      const width = this.tagName === 'VIDEO' ? 0 : 390;
      const height = this.tagName === 'VIDEO' ? 0 : 640;

      return {
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    const analysis = makeAnalysis();
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      detectedFaceShape: FaceShape.OVAL,
      alignment: readyAlignment,
      analysis,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.recognitionHold);
    });

    const drawImageArgs = vi.mocked(canvasContextMock.drawImage).mock.calls.at(-1);

    expect(drawImageArgs?.[0]).toBeInstanceOf(HTMLVideoElement);
    expect(drawImageArgs?.[1] as number).toBe(510);
    expect(drawImageArgs?.[2] as number).toBe(0);
    expect(drawImageArgs?.[3] as number).toBe(900);
    expect(drawImageArgs?.[4] as number).toBe(1080);
    expect(drawImageArgs?.[5] as number).toBe(0);
    expect(drawImageArgs?.[6] as number).toBe(0);
    expect(drawImageArgs?.[7] as number).toBe(900);
    expect(drawImageArgs?.[8] as number).toBe(1080);
  });

  it('mounts a mirrored AR overlay canvas over the live camera frame and resizes it to the viewport box', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
      height: 640,
      x: 0,
      y: 0,
      top: 0,
      right: 390,
      bottom: 640,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    });

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: readyAlignment,
      analysis: makeAnalysis(),
    };

    renderCapturePage();

    const overlayCanvas = screen.getByTestId('camera-ar-overlay') as HTMLCanvasElement;

    expect(overlayCanvas).toHaveClass('absolute', 'inset-0', 'scale-x-[-1]');
    await waitFor(() => {
      expect(overlayCanvas.width).toBe(780);
      expect(overlayCanvas.height).toBe(1280);
      expect(overlayCanvas.style.width).toBe('390px');
      expect(overlayCanvas.style.height).toBe('640px');
    });
  });

  it('keeps the live eyebrow overlay locked even when recommendation anchors are ready', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
      height: 640,
      x: 0,
      y: 0,
      top: 0,
      right: 390,
      bottom: 640,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1920);

    const analysis = makeAnalysis();
    const rotatedLiveOverlayAnchors = {
      ...mockOverlayAnchors,
      transform: {
        ...mockOverlayAnchors.transform,
        rotationRadians: Math.PI / 6,
        rotationDegrees: 30,
      },
    } satisfies EyebrowOverlayAnchors;

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      detectedFaceShape: FaceShape.OVAL,
      alignment: readyAlignment,
      analysis,
      liveOverlayAnchors: rotatedLiveOverlayAnchors,
    };

    const { onAnalysisComplete, rerender } = renderCapturePage();
    const overlayCanvas = screen.getByTestId('camera-ar-overlay') as HTMLCanvasElement;

    await waitFor(() => {
      expect(canvasContextMock.clearRect).toHaveBeenCalled();
    });
    expect(overlayCanvas).toHaveClass('opacity-0');
    expect(canvasContextMock.arc).not.toHaveBeenCalled();
    expect(canvasContextMock.transform).not.toHaveBeenCalled();
    expect(canvasContextMock.quadraticCurveTo).not.toHaveBeenCalled();
    expect(canvasContextMock.stroke).not.toHaveBeenCalled();
    expect(canvasContextMock.moveTo).not.toHaveBeenCalled();

    vi.mocked(canvasContextMock.clearRect).mockClear();
    vi.mocked(canvasContextMock.quadraticCurveTo).mockClear();
    vi.mocked(canvasContextMock.stroke).mockClear();
    vi.mocked(canvasContextMock.transform).mockClear();

    trackerMock.state = {
      ...trackerMock.state,
      alignment: readyAlignment,
      analysis,
      liveOverlayAnchors: null,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    await waitFor(() => {
      expect(canvasContextMock.clearRect).toHaveBeenCalled();
    });
    expect(overlayCanvas).toHaveClass('opacity-0');
    expect(canvasContextMock.transform).not.toHaveBeenCalled();
    expect(canvasContextMock.quadraticCurveTo).not.toHaveBeenCalled();
    expect(canvasContextMock.stroke).not.toHaveBeenCalled();

    vi.mocked(canvasContextMock.quadraticCurveTo).mockClear();
    vi.mocked(canvasContextMock.stroke).mockClear();

    trackerMock.state = {
      ...trackerMock.state,
      alignment: trackerMock.idleAlignment,
      analysis: null,
      liveOverlayAnchors: null,
      detectedFaceShape: null,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    await waitFor(() => {
      expect(canvasContextMock.clearRect).toHaveBeenCalled();
    });
    expect(canvasContextMock.quadraticCurveTo).not.toHaveBeenCalled();
    expect(canvasContextMock.stroke).not.toHaveBeenCalled();
  });

  it('keeps capture blocked when stable measurements exist but the latest live frame is off-center', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: offCenterAlignment,
      analysis: makeAnalysis(),
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getAllByText('얼굴을 오른쪽으로 조금 이동해주세요').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '얼굴 위치 조정' })).toBeDisabled();
    expect(onAnalysisComplete).not.toHaveBeenCalled();
  });

  it('continues capture when stable measurements carry a low-reportability quality flag', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1920);
    const { onAnalysisComplete, rerender } = renderCapturePage();
    const lowReportabilityAnalysis = {
      ...makeAnalysis(),
      metricConfidence: makeMetricConfidence({
        reportable: false,
        overallConfidence: 0.72,
        maxEstimatedErrorMm: 5.6,
      }),
    };

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: readyAlignment,
      analysis: lowReportabilityAnalysis,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.queryByText('측정값 재확인 필요')).not.toBeInTheDocument();
    expect(screen.getByText('인식 완료')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인식 완료' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.recognitionHold);
    });

    expect(trackerMock.stopCameraStream).toHaveBeenCalledOnce();

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.analysisTransition);
    });

    expect(onAnalysisComplete).toHaveBeenCalledWith('data:image/jpeg;base64,monabrow', lowReportabilityAnalysis);
  });

  it('keeps capture blocked until measurement stability is stable', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();
    const warmingAnalysis = {
      ...makeAnalysis(),
      measurementStability: {
        state: 'warming' as const,
        sampleCount: 2,
        heldForMs: 0,
        maxDeltaMm: 0.4,
        smoothingAlpha: 0.35,
      },
    };

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: readyAlignment,
      analysis: warmingAnalysis,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('수치 안정화 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수치 안정화 중' })).toBeDisabled();
    expect(onAnalysisComplete).not.toHaveBeenCalled();
  });

  it('cancels capture when the latest live frame is no longer facing the camera lens', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1920);
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: offGazeAlignment,
      analysis: makeAnalysis(),
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getAllByText('카메라 렌즈를 정면으로 바라봐 주세요').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '얼굴 위치 조정' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(APP_TIMING_MS.recognitionHold + APP_TIMING_MS.analysisTransition);
    });

    expect(trackerMock.stopCameraStream).not.toHaveBeenCalled();
    expect(onAnalysisComplete).not.toHaveBeenCalled();
  });

  it('surfaces AR fallback guidance when no face is visible', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: {
        ...trackerMock.idleAlignment,
        guidance: '얼굴 전체가 가이드 안에 들어오도록 카메라를 정면으로 맞춰주세요.',
        ready: false,
      },
      analysis: null,
      ipdGuidance: null,
      frameGuidance: {
        reason: 'missing_face',
        title: '얼굴을 찾고 있어요',
        message: '얼굴 전체가 가이드 안에 들어오도록 카메라를 정면으로 맞춰주세요.',
      },
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('얼굴 분석 대기: 얼굴 미감지')).toBeInTheDocument();
    expect(screen.getByText('얼굴을 찾고 있어요')).toBeInTheDocument();
    expect(screen.getAllByText('얼굴 전체가 타원 안에 보이도록 휴대폰을 정면에 맞춰주세요.')).toHaveLength(2);
    expect(screen.getByText('정렬 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '얼굴 정렬 필요' })).toBeDisabled();
  });

  it('surfaces AR guidance when pupil IPD cannot be measured reliably', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: {
        ...readyAlignment,
        confidence: 0.75,
        ready: false,
      },
      analysis: null,
      ipdGuidance: {
        reason: 'low_confidence',
        title: '동공 기준점이 불안정해요',
        message: '밝은 곳에서 얼굴을 고정하고 눈을 또렷하게 뜬 상태로 잠시 유지해주세요.',
      },
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('얼굴 분석 대기: 기준점 신뢰도 낮음')).toBeInTheDocument();
    expect(screen.getByText('동공 기준점이 불안정해요')).toBeInTheDocument();
    expect(screen.getAllByText('밝은 곳에서 얼굴을 고정하고 눈을 또렷하게 뜬 상태로 잠시 유지해주세요.')).toHaveLength(2);
    expect(screen.getAllByText('밝은 조명에서 정면을 보고 1초 정도 움직임을 멈춰주세요.')).toHaveLength(2);
    expect(screen.getByText('정렬 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '동공 기준점 확인 중' })).toBeDisabled();
  });

  it('does not label a front-facing pending analysis as an alignment problem', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: readyAlignment,
      analysis: null,
      ipdGuidance: null,
      frameGuidance: null,
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('분석 중')).toBeInTheDocument();
    expect(screen.getByText('정면은 맞았습니다. 기준점이 안정되면 촬영 버튼이 활성화됩니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '분석 안정화 중' })).toBeDisabled();
  });

  it('surfaces fallback guidance when MediaPipe returns a missing eyebrow landmark frame', () => {
    const { onAnalysisComplete, rerender } = renderCapturePage();

    trackerMock.state = {
      ...trackerMock.state,
      cameraPermission: 'granted',
      trackerStatus: 'ready',
      alignment: {
        ...trackerMock.idleAlignment,
        detected: true,
        guidance: '눈썹, 눈, 턱선이 화면 밖이나 머리카락에 가려지지 않게 조정해주세요.',
        confidence: 0.72,
      },
      analysis: null,
      ipdGuidance: null,
      frameGuidance: {
        reason: 'missing_eyebrow_landmarks',
        title: '눈썹 기준점을 찾고 있어요',
        message: '앞머리, 손, 안경테가 눈썹을 가리지 않게 하고 양쪽 눈썹이 화면 안에 들어오도록 맞춰주세요.',
      },
    };
    rerender(<CapturePage ipdMm={63} onAnalysisComplete={onAnalysisComplete} />);

    expect(screen.getByText('얼굴 분석 대기: 기준점 누락')).toBeInTheDocument();
    expect(screen.getByText('눈썹 기준점을 찾고 있어요')).toBeInTheDocument();
    expect(screen.getAllByText('앞머리, 손, 안경테가 눈썹을 가리지 않게 하고 양쪽 눈썹이 화면 안에 들어오도록 맞춰주세요.')).toHaveLength(2);
    expect(screen.getAllByText('앞머리, 손, 안경테를 치우고 양쪽 눈썹과 눈이 모두 보이게 맞춰주세요.')).toHaveLength(2);
    expect(screen.getByText('정렬 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '기준점 확인 중' })).toBeDisabled();
  });

  it('renders the recommendation-ready state and selects a result style', () => {
    const recommendations = getEyebrowRecommendations(FaceShape.ROUND);
    const analysis = { ...makeAnalysis(), faceShape: FaceShape.ROUND };
    const recommendationContext = buildEyebrowRecommendationContext(analysis);
    const onSelectRecommendation = vi.fn();

    render(
      <RecommendationResults
        faceShape={FaceShape.ROUND}
        resultCopy={FACE_SHAPE_RESULT_COPY[FaceShape.ROUND]}
        recommendations={recommendations}
        recommendationContext={recommendationContext}
        onSelectRecommendation={onSelectRecommendation}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('분석 완료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: FACE_SHAPE_RESULT_COPY[FaceShape.ROUND].title })).toBeInTheDocument();
    EYEBROW_METRIC_DISPLAY_ROWS.forEach((row) => {
      expect(screen.getByText(row.label)).toBeInTheDocument();
    });
    expect(screen.getByText('18.2mm')).toBeInTheDocument();
    expect(screen.getByText('33.4mm')).toBeInTheDocument();
    expect(screen.getByText('49.1mm')).toBeInTheDocument();
    expect(screen.getByText('50.2mm')).toBeInTheDocument();
    expect(screen.getByText('6.1mm')).toBeInTheDocument();
    expect(screen.getByText('7.3mm')).toBeInTheDocument();
    expect(screen.getByText('21.0mm')).toBeInTheDocument();
    expect(screen.getAllByText('각진 아치형').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '상승형 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(onSelectRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'upward' }),
      expect.objectContaining({
        faceShape: FaceShape.ROUND,
        metrics: expect.objectContaining({
          totalLength: 50.2,
          archHeight: 7.3,
          gap: 21,
        }),
        normalizedGeometry: expect.objectContaining({
          heightToWidth: 0.68 / 0.54,
          jawToCheek: 0.28 / 0.54,
        }),
        pxToMmScale: 63 / 216,
      }),
    );
  });

  it('displays the detected face-shape explanation in the result UI', () => {
    const recommendations = getEyebrowRecommendations(FaceShape.OVAL);
    const selectedStyle = recommendations[0]!;
    const analysis = makeAnalysis();

    render(
      <ResultPage
        faceShape={FaceShape.OVAL}
        capturedImage="data:image/jpeg;base64,monabrow"
        analysis={analysis}
        recommendationContext={buildEyebrowRecommendationContext(analysis)}
        selectedStyle={selectedStyle}
        onSelectedStyleChange={vi.fn()}
        onRetry={vi.fn()}
        onNextStep={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '추천 눈썹 디자인 결과' })).toBeInTheDocument();
    expect(screen.getAllByText(FaceShape.OVAL).length).toBeGreaterThan(0);
    expect(screen.getByText('추천 디자인: 아치형')).toBeInTheDocument();
    expect(screen.getByText('대칭 분석 완료')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '추천 디자인 설명 보기' }));

    expect(screen.getByRole('dialog', { name: '아치형 추천 이유' })).toBeInTheDocument();
    expect(screen.getByText(FACE_SHAPE_RESULT_COPY[FaceShape.OVAL].recommendationExplanation)).toBeInTheDocument();
  });

  it('renders the captured result image without live AR preview', () => {
    const recommendations = getEyebrowRecommendations(FaceShape.OVAL);
    const selectedStyle = recommendations[0]!;
    const analysis = makeAnalysis();

    const { container } = render(
      <ResultPage
        faceShape={FaceShape.OVAL}
        capturedImage="data:image/jpeg;base64,monabrow"
        analysis={analysis}
        recommendationContext={buildEyebrowRecommendationContext(analysis)}
        selectedStyle={selectedStyle}
        onSelectedStyleChange={vi.fn()}
        onRetry={vi.fn()}
        onNextStep={vi.fn()}
      />,
    );

    const resultImage = screen.getByAltText('분석 촬영 이미지');
    const resultPhotoFrame = resultImage.closest('.result-photo-frame');

    expect(resultImage).toBeInTheDocument();
    expect(resultPhotoFrame).toHaveClass('shrink-0');
    expect(resultImage).toHaveClass('object-cover');
    expect(resultImage).not.toHaveClass('object-contain');
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('camera-ar-overlay')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE AR')).not.toBeInTheDocument();
  });

  it('displays recommendation style controls in the result UI', () => {
    const recommendations = getEyebrowRecommendations(FaceShape.OVAL);
    const selectedStyle = recommendations[0]!;
    const analysis = makeAnalysis();

    render(
      <ResultPage
        faceShape={FaceShape.OVAL}
        capturedImage="data:image/jpeg;base64,monabrow"
        analysis={analysis}
        recommendationContext={buildEyebrowRecommendationContext(analysis)}
        selectedStyle={selectedStyle}
        onSelectedStyleChange={vi.fn()}
        onRetry={vi.fn()}
        onNextStep={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '자연 아치형 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '직선형 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '부드러운 곡선형 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 측정' })).toBeInTheDocument();
  });

  it('shows eyebrow metric values with a quality warning when confidence is low or error exceeds the threshold', () => {
    const recommendations = getEyebrowRecommendations(FaceShape.OVAL);
    const selectedStyle = recommendations[0]!;
    const analysis = {
      ...makeAnalysis(),
      metricConfidence: makeMetricConfidence({
        reportable: false,
        overallConfidence: 0.72,
        maxEstimatedErrorMm: 5.6,
      }),
    };

    render(
      <ResultPage
        faceShape={FaceShape.OVAL}
        capturedImage="data:image/jpeg;base64,monabrow"
        analysis={analysis}
        recommendationContext={buildEyebrowRecommendationContext(analysis)}
        selectedStyle={selectedStyle}
        onSelectedStyleChange={vi.fn()}
        onRetry={vi.fn()}
        onNextStep={vi.fn()}
      />,
    );

    expect(screen.getByText('측정값 검토 필요')).toBeInTheDocument();
    expect(screen.queryByText('대칭 분석 완료')).not.toBeInTheDocument();
  });
});
