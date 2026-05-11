"use client";

import { useEffect, useRef, type ComponentType } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Camera, Loader2, Settings } from 'lucide-react';
import { IPD_CONFIG } from '../../../constants';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../../domain/measurement-copy';
import { buildEyebrowRecommendationState, buildEyebrowRecommendationStateFromContext } from '../../../usecases/eyebrow-recommendations';
import { cn } from '../utils';
import {
  type CameraPermissionState,
  FaceShape,
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  type FaceAnalysisResult,
  type MeasurementDisplayItem,
} from '../../../types';
import { useFaceMeshTracker } from '../hooks/useFaceMeshTracker';
import { CameraPreview } from './CameraPreview';
import { Controls } from './Controls';
import { EyebrowStyleCarousel } from './EyebrowStyleCarousel';

interface ResultPageProps {
  faceShape: FaceShape | null;
  capturedImage: string | null;
  analysis: FaceAnalysisResult | null;
  recommendationContext: EyebrowRecommendationContext | null;
  selectedStyle: EyebrowStyle | null;
  onSelectedStyleChange: (style: EyebrowStyle) => void;
  onRetry: () => void;
  onApplyStyle: () => void;
}

const CAMERA_PERMISSION_ICONS: Record<Exclude<CameraPermissionState, 'granted'>, ComponentType<{ size?: number; className?: string }>> = {
  idle: Camera,
  pending: Loader2,
  denied: Settings,
  unavailable: AlertCircle,
};

const getFaceShapeStatus = (faceShape: FaceShape | null, analysis: FaceAnalysisResult | null) => {
  if (!analysis) {
    return {
      label: '얼굴형 분석 중',
      detail: 'Face shape loading',
      dotClassName: 'bg-main-brown/45 animate-pulse',
    };
  }

  if (!faceShape) {
    return {
      label: '얼굴형 미확인',
      detail: 'Face shape unknown',
      dotClassName: 'bg-sub-gray/60',
    };
  }

  return {
    label: faceShape,
    detail: 'Detected face shape',
    dotClassName: 'bg-main-brown',
  };
};

const buildDisplayedMeasurements = (analysis: FaceAnalysisResult | null): MeasurementDisplayItem[] => {
  if (!analysis) return [];

  return EYEBROW_METRIC_DISPLAY_ROWS.map((row) => {
    const existing = analysis.measurements.find((measurement) => (
      measurement.label === row.label || measurement.label.includes(row.label) || row.label.includes(measurement.label)
    ));
    const value = analysis.metrics[row.key];
    const confidence = analysis.metricConfidence?.metrics[row.key] ?? existing?.confidence;
    const reportable = confidence?.reportable ?? analysis.metricConfidence?.reportable ?? true;

    return {
      label: row.label,
      description: existing?.description ?? row.description,
      value: reportable && Number.isFinite(value) ? `${value.toFixed(1)}mm` : '-',
      confidence,
    };
  });
};

const getMeasurementGateMessage = (analysis: FaceAnalysisResult | null) => {
  if (!analysis) return null;

  const confidence = analysis.metricConfidence;
  if (!confidence || confidence.reportable) return null;

  return `기준점 신뢰도 ${Math.round(confidence.overallConfidence * 100)}%, 예상 오차 최대 +/-${confidence.maxEstimatedErrorMm.toFixed(1)}mm로 측정값 표시 기준을 넘었습니다.`;
};

const getLivePreviewMessage = ({
  cameraPermission,
  alignment,
  hasLiveOverlay,
  selectedStyle,
}: {
  cameraPermission: CameraPermissionState;
  alignment: FaceAnalysisResult['alignment'];
  hasLiveOverlay: boolean;
  selectedStyle: EyebrowStyle | null;
}) => {
  if (cameraPermission !== 'granted') return '카메라를 다시 연결해 현재 모습으로 AR 미리보기를 준비합니다.';
  if (!alignment.detected) return '얼굴을 화면 중앙에 맞추면 추천 눈썹이 실시간으로 표시됩니다.';
  if (!alignment.ready) return alignment.guidance || '정면을 보고 잠시 고정하면 추천 눈썹이 표시됩니다.';
  if (!hasLiveOverlay) return '눈썹 기준점을 추적하고 있습니다. 얼굴과 눈썹이 화면 안에 보이게 맞춰주세요.';
  return `${selectedStyle?.name ?? '추천 눈썹'} 실시간 트레이싱 중`;
};

export function ResultPage({
  faceShape,
  analysis,
  recommendationContext,
  selectedStyle,
  onSelectedStyleChange,
  onRetry,
  onApplyStyle,
}: ResultPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recommendationState = recommendationContext
    ? buildEyebrowRecommendationStateFromContext(recommendationContext)
    : buildEyebrowRecommendationState(analysis);
  const recommendations = recommendationState.status === 'ready' ? recommendationState.recommendations : [];
  const measurements = buildDisplayedMeasurements(analysis);
  const measurementGateMessage = getMeasurementGateMessage(analysis);
  const previewIpdMm = recommendationContext?.ipdMm ?? analysis?.ipdMm ?? IPD_CONFIG.defaultMm;
  const {
    videoRef,
    cameraPermission,
    trackerStatus,
    latestLandmarks,
    liveOverlayAnchors,
    detectedFaceShape,
    alignment,
    ipdGuidance,
    frameGuidance,
    errorMessage,
    requestCameraPermission,
  } = useFaceMeshTracker({ ipdMm: previewIpdMm });
  const PermissionIcon = cameraPermission === 'granted' ? null : CAMERA_PERMISSION_ICONS[cameraPermission];
  const liveFaceShape = detectedFaceShape ?? faceShape ?? analysis?.faceShape ?? null;
  const faceShapeStatus = getFaceShapeStatus(liveFaceShape, analysis);
  const hasLiveOverlay = Boolean(cameraPermission === 'granted' && alignment.ready && liveOverlayAnchors && selectedStyle);
  const livePreviewMessage = getLivePreviewMessage({
    cameraPermission,
    alignment,
    hasLiveOverlay,
    selectedStyle,
  });

  useEffect(() => {
    if (cameraPermission !== 'idle') return;

    void requestCameraPermission();
  }, [cameraPermission, requestCameraPermission]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="app-container h-screen overflow-hidden relative"
    >
      <div className="absolute left-0 right-0 top-0 z-0 flex h-[min(62dvh,560px)] flex-col items-center overflow-hidden">
        <div className="mt-20 mb-4 flex w-full justify-center px-6">
          <div className="relative h-[min(46dvh,410px)] max-h-[410px] max-w-full aspect-[3/4] overflow-hidden rounded-lg border border-glass-border bg-main-brown/5">
            <CameraPreview
              videoRef={videoRef}
              canvasRef={canvasRef}
              cameraPermission={cameraPermission}
              trackerStatus={trackerStatus}
              alignment={alignment}
              detectedFaceShape={detectedFaceShape}
              liveOverlayAnchors={liveOverlayAnchors}
              landmarks={latestLandmarks}
              selectedRecommendation={selectedStyle}
              ipdGuidance={ipdGuidance}
              frameGuidance={frameGuidance}
              errorMessage={errorMessage}
              PermissionIcon={PermissionIcon}
              onRequestCameraPermission={requestCameraPermission}
              className="h-full rounded-none border-0 bg-main-brown/5 shadow-none"
              showFaceGuidance={false}
              guidanceMode="preview"
            />
            <div className="absolute left-4 right-4 top-5 flex items-start justify-between gap-3">
              <div className="glass-pill flex items-center gap-2 rounded-2xl border-glass-border px-3 py-2">
                <div className="w-2 h-2 bg-main-brown rounded-full animate-pulse" />
                <span className="text-main-brown text-[10px] font-bold">LIVE AR</span>
              </div>
              <div
                className="glass-pill max-w-[52%] rounded-2xl border-glass-border px-3 py-2 text-right"
                aria-live="polite"
              >
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", faceShapeStatus.dotClassName)} />
                  <span className="truncate text-[12px] font-bold text-main-brown">{faceShapeStatus.label}</span>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-bold text-sub-gray/70">
                  {faceShapeStatus.detail}
                </p>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="glass-pill rounded-2xl border-glass-border px-4 py-2 text-center">
                <p className="truncate text-[11px] font-bold text-main-brown" aria-live="polite">
                  {livePreviewMessage}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 px-10 text-center space-y-2">
          <h3 className="text-xl font-bold text-main-brown">{selectedStyle?.name}</h3>
          <p className="text-sub-gray text-[14px] font-light leading-tight">당신에게 가장 잘 어울리는 스타일이에요.</p>
        </div>
      </div>

      <div className="absolute inset-0 z-10 overflow-y-auto no-scrollbar pt-[min(62dvh,560px)]">
        <div className="rounded-t-lg p-6 pb-[190px] min-h-screen bg-white border-t border-glass-border space-y-10">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-4 bg-main-brown rounded-full" />
                <h4 className="text-[14px] font-bold text-main-brown opacity-60">추천 스타일 변경</h4>
              </div>
              {selectedStyle && (
                <span className="shrink-0 text-[12px] font-bold text-main-brown">{selectedStyle.name}</span>
              )}
            </div>
            {recommendationState.status === 'ready' ? (
              <EyebrowStyleCarousel
                styles={recommendations}
                selectedStyle={selectedStyle}
                onSelectStyle={onSelectedStyleChange}
                ariaLabel="AR 미리보기 눈썹 스타일 변경"
              />
            ) : (
              <div className="rounded-lg bg-main-brown/[0.04] px-4 py-5 text-center">
                <p className="text-[13px] font-bold text-main-brown">{recommendationState.validation.title}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-sub-gray">{recommendationState.validation.message}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-4 bg-main-brown rounded-full" />
              <h4 className="text-[14px] font-bold text-main-brown opacity-60">측정 수치</h4>
            </div>

            {measurementGateMessage && (
              <div className="mx-2 rounded-lg border border-main-brown/10 bg-main-brown/[0.04] px-4 py-3">
                <p className="text-[12px] font-bold text-main-brown">측정값 재확인 필요</p>
                <p className="mt-1 text-[11px] leading-relaxed text-sub-gray">{measurementGateMessage}</p>
              </div>
            )}

            <div className="space-y-4 px-2">
              {measurements.map((measurement) => (
                <div key={measurement.label} className="flex justify-between items-center py-3 border-b border-divider last:border-0">
                  <div className="space-y-1">
                    <p className="text-[14px] font-bold text-main-brown leading-none">{measurement.label}</p>
                    <p className="text-[11px] font-light text-sub-gray">{measurement.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-bold text-main-brown tabular-nums">{measurement.value}</p>
                    {measurement.confidence && (
                      <p className="mt-1 text-[10px] font-bold text-sub-gray">
                        +/-{measurement.confidence.estimatedErrorMm.toFixed(1)}mm
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Controls
            mode="result"
            onRetry={onRetry}
            onApplyStyle={onApplyStyle}
          />
        </div>
      </div>
    </motion.div>
  );
}
