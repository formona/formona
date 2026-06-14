"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Camera, ChevronLeft, Loader2, Settings } from 'lucide-react';
import { cn } from '../utils';
import { useFaceMeshTracker } from '../hooks/useFaceMeshTracker';
import { CameraPreview } from './CameraPreview';
import { Controls } from './Controls';
import { FlowProgress } from './FlowProgress';
import type { CameraPermissionState, FaceAnalysisResult } from '../../../types';
import { buildEyebrowRecommendationState } from '../../../usecases/eyebrow-recommendations';
import { EYEBROW_METRIC_DISPLAY_KEYS } from '../../../domain/measurement-copy';
import { APP_TIMING_MS, FEATURE_FLAGS } from '../../../constants';

const CAMERA_PERMISSION_ICONS: Record<Exclude<CameraPermissionState, 'granted'>, React.ComponentType<{ size?: number; className?: string }>> = {
  idle: Camera,
  pending: Loader2,
  denied: Settings,
  unavailable: AlertCircle,
};

interface CapturePageProps {
  ipdMm: number;
  autoStartCamera?: boolean;
  onBack?: () => void;
  onAnalysisComplete: (capturedImage: string, analysis: FaceAnalysisResult) => void;
}

const isMeasurementReadyForResult = (analysis: FaceAnalysisResult | null, alignmentReady: boolean) => Boolean(
  analysis
    && alignmentReady
    && analysis.alignment.ready
    && analysis.measurementStability?.state === 'stable'
    && EYEBROW_METRIC_DISPLAY_KEYS.every((key) => (
      Number.isFinite(analysis.metrics[key]) && analysis.metrics[key] > 0
    )),
);

export function CapturePage({ ipdMm, autoStartCamera = false, onBack, onAnalysisComplete }: CapturePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const autoAnalysisTimerRef = useRef<number | null>(null);
  const autoAnalysisStartedRef = useRef(false);
  const latestAnalysisRef = useRef<FaceAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecognitionHolding, setIsRecognitionHolding] = useState(false);
  const {
    videoRef,
    cameraPermission,
    trackerStatus,
    liveOverlayAnchors,
    detectedFaceShape,
    analysis,
    alignment,
    ipdGuidance,
    frameGuidance,
    errorMessage,
    requestCameraPermission,
    stopCameraStream,
  } = useFaceMeshTracker({ ipdMm });

  useEffect(() => {
    latestAnalysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    if (!autoStartCamera || cameraPermission !== 'idle' || isAnalyzing) return;

    void requestCameraPermission();
  }, [autoStartCamera, cameraPermission, isAnalyzing, requestCameraPermission]);

  useEffect(() => () => {
    if (autoAnalysisTimerRef.current !== null) {
      window.clearTimeout(autoAnalysisTimerRef.current);
    }
  }, []);

  const captureCurrentFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const previewFrame = previewFrameRef.current;
    const previewFrameRect = previewFrame?.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    const previewWidth = previewFrame?.clientWidth
      || previewFrameRect?.width
      || video.clientWidth
      || videoRect.width;
    const previewHeight = previewFrame?.clientHeight
      || previewFrameRect?.height
      || video.clientHeight
      || videoRect.height;
    const hasPreviewSize = previewWidth > 0 && previewHeight > 0;
    const coverScale = hasPreviewSize
      ? Math.max(previewWidth / video.videoWidth, previewHeight / video.videoHeight)
      : 1;
    const sourceWidth = hasPreviewSize
      ? Math.min(video.videoWidth, previewWidth / coverScale)
      : video.videoWidth;
    const sourceHeight = hasPreviewSize
      ? Math.min(video.videoHeight, previewHeight / coverScale)
      : video.videoHeight;
    const sourceX = Math.max(0, (video.videoWidth - sourceWidth) / 2);
    const sourceY = Math.max(0, (video.videoHeight - sourceHeight) / 2);
    const canvas = canvasRef.current;
    canvas.width = Math.max(1, Math.round(sourceWidth));
    canvas.height = Math.max(1, Math.round(sourceHeight));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    ctx.restore();

    return canvas.toDataURL('image/jpeg');
  }, [videoRef]);

  const completeAnalysis = useCallback((capturedImage: string) => {
    const currentAnalysis = latestAnalysisRef.current;
    if (!currentAnalysis) {
      autoAnalysisStartedRef.current = false;
      setIsRecognitionHolding(false);
      return;
    }

    setIsRecognitionHolding(false);
    setIsAnalyzing(true);
    stopCameraStream();
    window.setTimeout(() => {
      onAnalysisComplete(capturedImage, currentAnalysis);
      setIsAnalyzing(false);
    }, APP_TIMING_MS.analysisTransition);
  }, [onAnalysisComplete, stopCameraStream]);

  const alignmentReady = Boolean(alignment.ready ?? (
    alignment.detected
      && alignment.centered
      && alignment.distanceOk
      && alignment.pitchOk
      && alignment.yawOk
      && (alignment.gazeOk ?? true)
  ));
  const captureReady = isMeasurementReadyForResult(analysis, alignmentReady);

  useEffect(() => {
    if (cameraPermission !== 'granted' || !analysis || !captureReady) {
      if (autoAnalysisTimerRef.current !== null) {
        window.clearTimeout(autoAnalysisTimerRef.current);
        autoAnalysisTimerRef.current = null;
      }
      autoAnalysisStartedRef.current = false;
      setIsRecognitionHolding(false);
      return;
    }

    if (!captureReady || isAnalyzing || autoAnalysisStartedRef.current) return;

    autoAnalysisStartedRef.current = true;
    setIsRecognitionHolding(true);
    autoAnalysisTimerRef.current = window.setTimeout(() => {
      autoAnalysisTimerRef.current = null;
      const capturedImage = captureCurrentFrame();

      if (!capturedImage) {
        autoAnalysisStartedRef.current = false;
        setIsRecognitionHolding(false);
        return;
      }

      completeAnalysis(capturedImage);
    }, APP_TIMING_MS.recognitionHold);
  }, [alignmentReady, analysis, cameraPermission, captureCurrentFrame, captureReady, completeAnalysis, isAnalyzing]);

  const liveRecommendation = useMemo(() => {
    if (!FEATURE_FLAGS.arEyebrowOverlayEnabled) return null;
    if (!analysis) return null;

    const recommendationState = buildEyebrowRecommendationState(analysis);
    return recommendationState.status === 'ready' ? recommendationState.recommendations[0] ?? null : null;
  }, [analysis]);
  const captureBlockedState = useMemo(() => {
    if (captureReady) return null;

    if (!alignment.detected || frameGuidance?.reason === 'missing_face') {
      return {
        label: '얼굴 정렬 필요',
        description: '얼굴 전체를 타원 안에 맞추면 촬영 버튼이 활성화됩니다.',
      };
    }

    if (frameGuidance?.reason === 'low_confidence') {
      return {
        label: '기준점 안정화 중',
        description: frameGuidance.message,
      };
    }

    if (frameGuidance) {
      return {
        label: '기준점 확인 중',
        description: frameGuidance.message,
      };
    }

    if (ipdGuidance) {
      return {
        label: '동공 기준점 확인 중',
        description: ipdGuidance.message,
      };
    }

    if (!alignmentReady) {
      return {
        label: '얼굴 위치 조정',
        description: alignment.guidance || '얼굴 전체를 타원 안에 맞추면 촬영 버튼이 활성화됩니다.',
      };
    }

    if (
      analysis?.metricConfidence
      && !analysis.metricConfidence.reportable
      && analysis.measurementStability?.state !== 'stable'
    ) {
      return {
        label: '측정값 재확인 필요',
        description: `기준점 신뢰도 ${Math.round(analysis.metricConfidence.overallConfidence * 100)}%, 예상 오차 최대 +/-${analysis.metricConfidence.maxEstimatedErrorMm.toFixed(1)}mm입니다. 얼굴을 정면으로 고정해주세요.`,
      };
    }

    if (analysis) {
      return {
        label: '수치 안정화 중',
        description: '측정값이 연속 프레임에서 안정될 때까지 얼굴과 휴대폰을 잠시 고정해주세요.',
      };
    }

    return {
      label: '분석 안정화 중',
      description: '정면은 맞았습니다. 기준점이 안정되면 촬영 버튼이 활성화됩니다.',
    };
  }, [alignment.detected, alignment.guidance, analysis, alignmentReady, captureReady, frameGuidance, ipdGuidance]);
  const PermissionIcon = cameraPermission === 'granted' ? null : CAMERA_PERMISSION_ICONS[cameraPermission];

  return (
    <div
      className={cn(
        "app-container capture-page relative bg-white",
        cameraPermission === 'granted' ? "capture-page-live" : "capture-page-permission"
      )}
    >
      <section className="capture-shell flow-card" aria-labelledby="capture-heading">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="capture-card-back"
            aria-label="이전 화면"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        <FlowProgress currentStep={2} className="capture-progress-dots" />

        <div className="capture-header flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-main-brown/55">얼굴 분석</p>
            <h2 id="capture-heading" className="mt-1 text-[22px] font-bold leading-tight text-main-brown">얼굴 정렬 후 측정</h2>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-[11px] font-bold",
              captureReady
                ? "border-main-brown bg-white text-main-brown"
                : "border-main-brown/10 bg-main-brown/5 text-sub-gray"
            )}
            aria-live="polite"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                captureReady ? "bg-main-brown" : "bg-main-brown/25"
              )}
            />
            {captureReady ? (isRecognitionHolding ? '확인 중' : '분석 준비') : alignmentReady ? '분석 중' : '정렬 중'}
          </div>
        </div>

        <CameraPreview
          videoRef={videoRef}
          canvasRef={canvasRef}
          previewFrameRef={previewFrameRef}
          cameraPermission={cameraPermission}
          trackerStatus={trackerStatus}
          alignment={alignment}
          detectedFaceShape={detectedFaceShape}
          liveOverlayAnchors={liveOverlayAnchors}
          selectedRecommendation={liveRecommendation}
          ipdGuidance={ipdGuidance}
          frameGuidance={frameGuidance}
          errorMessage={errorMessage}
          PermissionIcon={PermissionIcon}
          onRequestCameraPermission={requestCameraPermission}
          className={cn(
            "capture-preview-frame",
            cameraPermission === 'granted' ? "capture-preview-live" : "capture-preview-permission"
          )}
        />
      </section>

      {cameraPermission === 'granted' && (
        <Controls
          mode="capture"
          analysisReady={captureReady}
          disabledLabel={captureBlockedState?.label}
          disabledDescription={captureBlockedState?.description}
        />
      )}

      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 px-8"
          >
            <div className="w-full max-w-[300px] rounded-2xl border border-main-brown/10 bg-white p-8 text-center">
              <div className="relative mx-auto h-36 w-28 overflow-hidden rounded-[46%] border-2 border-main-brown/30 bg-main-brown/[0.03]">
                <motion.div
                  className="absolute left-3 right-3 h-8 rounded-full bg-main-brown/10"
                  animate={{ y: [18, 96, 18], opacity: [0.18, 0.42, 0.18] }}
                  transition={{ duration: 2.35, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute left-2 right-2 h-px bg-main-brown"
                  animate={{ y: [28, 106, 28], opacity: [0.18, 0.85, 0.18] }}
                  transition={{ duration: 2.35, repeat: Infinity, ease: 'easeInOut' }}
                />
                <svg viewBox="0 0 112 144" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <motion.path
                    d="M56 16 C82 16 98 43 96 76 C94 109 78 130 56 130 C34 130 18 109 16 76 C14 43 30 16 56 16Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-main-brown"
                    animate={{ pathLength: [0.2, 1, 0.2], opacity: [0.36, 0.95, 0.36] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.path
                    d="M31 61 Q43 55 52 61 M60 61 Q71 55 83 61"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    className="text-main-brown"
                    animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <path d="M42 78 H44 M68 78 H70" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-main-brown" opacity="0.52" />
                  <motion.path
                    d="M43 102 Q56 109 69 102"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-main-brown"
                    animate={{ opacity: [0.28, 0.72, 0.28] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  />
                </svg>
              </div>
              <div className="mt-7 space-y-3">
                <h3 className="text-xl font-bold text-main-brown">AI 스타일 정밀 분석</h3>
                <p className="text-sub-gray text-xs font-light">얼굴형과 비율을 측정하고 있습니다</p>
                <div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-main-brown/10" aria-label="분석 진행 중">
                  <motion.div
                    className="h-full rounded-full bg-main-brown"
                    initial={{ width: '12%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: APP_TIMING_MS.analysisTransition / 1000, ease: 'easeInOut' }}
                  />
                </div>
                <div className="flex justify-center gap-2 pt-1" aria-hidden="true">
                  {['얼굴형', '비율', '눈썹선'].map((step, index) => (
                    <motion.span
                      key={step}
                      className="rounded-full border border-main-brown/10 px-2.5 py-1 text-[10px] font-bold text-main-brown"
                      animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                      transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut', delay: index * 0.22 }}
                    >
                      {step}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
