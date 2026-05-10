"use client";

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Camera, Loader2, Settings } from 'lucide-react';
import { cn } from '../utils';
import { useFaceMeshTracker } from '../hooks/useFaceMeshTracker';
import { CameraPreview } from './CameraPreview';
import { Controls } from './Controls';
import type { CameraPermissionState, FaceAnalysisResult } from '../../../types';
import { buildEyebrowRecommendationState } from '../../../usecases/eyebrow-recommendations';

const CAMERA_PERMISSION_ICONS: Record<Exclude<CameraPermissionState, 'granted'>, React.ComponentType<{ size?: number; className?: string }>> = {
  idle: Camera,
  pending: Loader2,
  denied: Settings,
  unavailable: AlertCircle,
};

interface CapturePageProps {
  ipdMm: number;
  onAnalysisComplete: (capturedImage: string, analysis: FaceAnalysisResult) => void;
}

export function CapturePage({ ipdMm, onAnalysisComplete }: CapturePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const {
    videoRef,
    cameraPermission,
    trackerStatus,
    latestLandmarks,
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

  const processAnalysis = (capturedImage: string) => {
    if (!analysis) return;

    setIsAnalyzing(true);
    window.setTimeout(() => {
      onAnalysisComplete(capturedImage, analysis);
      setIsAnalyzing(false);
    }, 450);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    stopCameraStream();
    processAnalysis(dataUrl);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result;
      if (typeof dataUrl !== 'string') return;

      stopCameraStream();
      processAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const alignmentReady = Boolean(alignment.ready ?? (
    alignment.detected && alignment.centered && alignment.distanceOk && alignment.pitchOk && alignment.yawOk
  ));
  const captureReady = Boolean(analysis);
  const liveRecommendation = useMemo(() => {
    if (!captureReady) return null;

    const recommendationState = buildEyebrowRecommendationState(analysis);
    return recommendationState.status === 'ready' ? recommendationState.recommendations[0] ?? null : null;
  }, [captureReady, analysis]);
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

    if (alignmentReady) {
      return {
        label: '분석 안정화 중',
        description: '정면은 맞았습니다. 기준점이 안정되면 촬영 버튼이 활성화됩니다.',
      };
    }

    return {
      label: '얼굴 위치 조정',
      description: alignment.guidance || '얼굴 전체를 타원 안에 맞추면 촬영 버튼이 활성화됩니다.',
    };
  }, [alignment.detected, alignment.guidance, alignmentReady, captureReady, frameGuidance, ipdGuidance]);
  const PermissionIcon = cameraPermission === 'granted' ? null : CAMERA_PERMISSION_ICONS[cameraPermission];

  return (
    <div className="app-container relative bg-white px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-6">
      <div className="mb-4 flex items-center justify-between gap-4 pl-[72px] pr-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-main-brown/45">AR Capture</p>
          <h2 className="mt-1 truncate text-[20px] font-bold leading-tight text-main-brown">얼굴 정렬 후 촬영</h2>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold",
            captureReady
              ? "border-green-500/20 bg-green-500/10 text-main-brown"
              : "border-main-brown/10 bg-main-brown/5 text-sub-gray"
          )}
          aria-live="polite"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              captureReady ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.55)]" : "bg-main-brown/25"
            )}
          />
          {captureReady ? '촬영 가능' : alignmentReady ? '분석 중' : '정렬 중'}
        </div>
      </div>

      <CameraPreview
        videoRef={videoRef}
        canvasRef={canvasRef}
        cameraPermission={cameraPermission}
        trackerStatus={trackerStatus}
        alignment={alignment}
        detectedFaceShape={detectedFaceShape}
        liveOverlayAnchors={liveOverlayAnchors}
        landmarks={latestLandmarks}
        selectedRecommendation={liveRecommendation}
        ipdGuidance={ipdGuidance}
        frameGuidance={frameGuidance}
        errorMessage={errorMessage}
        PermissionIcon={PermissionIcon}
        onRequestCameraPermission={requestCameraPermission}
        onFileUpload={handleFileUpload}
      />

      {cameraPermission === 'granted' && (
        <Controls
          mode="capture"
          analysisReady={captureReady}
          disabledLabel={captureBlockedState?.label}
          disabledDescription={captureBlockedState?.description}
          onCapture={handleCapture}
          onFileUpload={handleFileUpload}
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
            <div className="w-full max-w-[300px] rounded-3xl border border-main-brown/10 bg-white p-8 text-center shadow-[0_18px_44px_rgba(79,44,29,0.14)]">
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
