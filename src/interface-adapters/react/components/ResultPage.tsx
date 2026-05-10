"use client";

import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { BRAND_COLORS } from '../../../constants';
import { buildRecommendedEyebrowGeometry } from '../../../domain/eyebrow-geometry';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../../domain/measurement-copy';
import { buildEyebrowRecommendationState, buildEyebrowRecommendationStateFromContext } from '../../../usecases/eyebrow-recommendations';
import { cn } from '../utils';
import {
  FaceShape,
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  type FaceAnalysisResult,
  type MeasurementDisplayItem,
} from '../../../types';
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
    dotClassName: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]',
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

export function ResultPage({
  faceShape,
  capturedImage,
  analysis,
  recommendationContext,
  selectedStyle,
  onSelectedStyleChange,
  onRetry,
  onApplyStyle,
}: ResultPageProps) {
  const recommendationState = recommendationContext
    ? buildEyebrowRecommendationStateFromContext(recommendationContext)
    : buildEyebrowRecommendationState(analysis);
  const recommendations = recommendationState.status === 'ready' ? recommendationState.recommendations : [];
  const measurements = buildDisplayedMeasurements(analysis);
  const measurementGateMessage = getMeasurementGateMessage(analysis);
  const overlay = buildRecommendedEyebrowGeometry(selectedStyle, analysis?.overlayAnchors) ?? analysis?.overlay;
  const hasTrackedOverlay = Boolean(overlay?.left || overlay?.right);
  const faceShapeStatus = getFaceShapeStatus(faceShape ?? analysis?.faceShape ?? null, analysis);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="app-container h-screen overflow-hidden relative"
    >
      <div className="absolute left-0 right-0 top-0 z-0 flex h-[min(62dvh,560px)] flex-col items-center overflow-hidden">
        <div className="mt-20 mb-4 flex w-full justify-center px-6">
            <div className="relative h-[min(46dvh,410px)] max-h-[410px] max-w-full aspect-[3/4] overflow-hidden rounded-lg border border-glass-border bg-white shadow-2xl">
              {capturedImage && (
                <Image
                  src={capturedImage}
                  fill
                  unoptimized
                  sizes="(max-width: 430px) 100vw, 430px"
                  className="object-cover"
                  alt="분석 촬영 이미지"
                />
              )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedStyle?.id}-${hasTrackedOverlay ? 'tracked' : 'style'}`}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
              >
                {hasTrackedOverlay && overlay ? (
                  <svg viewBox={overlay.viewBox} preserveAspectRatio="none" className="h-full w-full">
                    <g transform="translate(100 0) scale(-1 1)">
                      {overlay.left && (
                        <>
                          {overlay.leftFill && (
                            <path
                              d={overlay.leftFill}
                              fill={BRAND_COLORS.brown}
                              opacity="0.26"
                            />
                          )}
                          <path
                            d={overlay.left}
                            fill="none"
                            stroke="#C9A96E"
                            strokeWidth={overlay.strokeWidth ?? 1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                      {overlay.right && (
                        <>
                          {overlay.rightFill && (
                            <path
                              d={overlay.rightFill}
                              fill={BRAND_COLORS.brown}
                              opacity="0.26"
                            />
                          )}
                          <path
                            d={overlay.right}
                            fill="none"
                            stroke="#C9A96E"
                            strokeWidth={overlay.strokeWidth ?? 1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </g>
                  </svg>
                ) : (
                  <svg viewBox="0 0 400 500" className="w-[85%] h-[85%]">
                    <g transform="translate(100, 200)">
                      <path d={selectedStyle?.path} fill="none" stroke={BRAND_COLORS.brown} strokeWidth="6.5" strokeLinecap="round" opacity="0.85" className="scale-[1.3]" />
                    </g>
                    <g transform="translate(225, 200)">
                      <path d={selectedStyle?.path} fill="none" stroke={BRAND_COLORS.brown} strokeWidth="6.5" strokeLinecap="round" opacity="0.85" className="scale-[1.3] translate-x-[75] scale-x-[-1]" />
                    </g>
                  </svg>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="absolute left-4 right-4 top-5 flex items-start justify-between gap-3">
              <div className="glass-pill flex items-center gap-2 rounded-full border-glass-border px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <span className="text-main-brown text-[10px] font-black uppercase tracking-[0.1em]">LIVE PREVIEW</span>
              </div>
              <div
                className="glass-pill max-w-[52%] rounded-full border-glass-border px-3 py-2 text-right"
                aria-live="polite"
              >
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", faceShapeStatus.dotClassName)} />
                  <span className="truncate text-[12px] font-bold text-main-brown">{faceShapeStatus.label}</span>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-sub-gray/70">
                  {faceShapeStatus.detail}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 px-10 text-center space-y-2">
          <h3 className="text-xl font-bold text-main-brown tracking-normal uppercase">{selectedStyle?.name}</h3>
          <p className="text-sub-gray text-[14px] font-medium leading-tight">당신에게 가장 잘 어울리는 스타일이에요.</p>
        </div>
      </div>

      <div className="absolute inset-0 z-10 overflow-y-auto no-scrollbar pt-[min(62dvh,560px)]">
        <div className="shadow-[0_-12px_40px_rgba(0,0,0,0.10)] rounded-t-lg p-6 pb-[190px] min-h-screen bg-white/95 backdrop-blur-3xl border-t border-glass-border space-y-10">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-4 bg-main-brown rounded-full" />
                <h4 className="text-[14px] font-bold text-main-brown tracking-widest uppercase opacity-40">추천 스타일 변경</h4>
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
              <h4 className="text-[14px] font-bold text-main-brown tracking-widest uppercase opacity-40">측정 수치</h4>
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
