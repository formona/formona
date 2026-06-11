"use client";

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { FACE_SHAPE_RESULT_COPY } from '../../../constants';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../../domain/measurement-copy';
import { buildEyebrowRecommendationState, buildEyebrowRecommendationStateFromContext } from '../../../usecases/eyebrow-recommendations';
import {
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  FaceShape,
  type FaceAnalysisResult,
  type MeasurementDisplayItem,
} from '../../../types';
import { FaceShapeImage } from './FaceShapeImage';

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

const buildDisplayedMeasurements = (analysis: FaceAnalysisResult | null): MeasurementDisplayItem[] => {
  if (!analysis) return [];

  return EYEBROW_METRIC_DISPLAY_ROWS.map((row) => {
    const existing = analysis.measurements.find((measurement) => (
      measurement.label === row.label || measurement.label.includes(row.label) || row.label.includes(measurement.label)
    ));
    const value = analysis.metrics[row.key];
    const confidence = analysis.metricConfidence?.metrics[row.key] ?? existing?.confidence;

    return {
      label: row.label,
      description: existing?.description ?? row.description,
      value: Number.isFinite(value) ? `${value.toFixed(1)}mm` : '-',
      confidence,
    };
  });
};

const getMeasurementGateMessage = (analysis: FaceAnalysisResult | null) => {
  if (!analysis) return null;

  const confidence = analysis.metricConfidence;
  if (!confidence || confidence.reportable) return null;

  return `기준점 신뢰도 ${Math.round(confidence.overallConfidence * 100)}%, 예상 오차 최대 +/-${confidence.maxEstimatedErrorMm.toFixed(1)}mm입니다. 수치는 표시하고 데이터에는 검토 필요 품질 플래그를 함께 저장합니다.`;
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
  const recommendationState = useMemo(() => (
    recommendationContext
      ? buildEyebrowRecommendationStateFromContext(recommendationContext)
      : buildEyebrowRecommendationState(analysis)
  ), [analysis, recommendationContext]);
  const recommendations = useMemo(() => (
    recommendationState.status === 'ready' ? recommendationState.recommendations : []
  ), [recommendationState]);
  const resolvedStyle = selectedStyle ?? recommendations[0] ?? null;
  const resolvedFaceShape = faceShape ?? analysis?.faceShape ?? recommendationContext?.faceShape ?? FaceShape.OVAL;
  const resultCopy = FACE_SHAPE_RESULT_COPY[resolvedFaceShape];
  const measurements = buildDisplayedMeasurements(analysis);
  const measurementGateMessage = getMeasurementGateMessage(analysis);

  useEffect(() => {
    if (!resolvedStyle && recommendations[0]) {
      onSelectedStyleChange(recommendations[0]);
    }
  }, [onSelectedStyleChange, recommendations, resolvedStyle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container overflow-hidden bg-white"
    >
      <div className="content-scrollable px-5 pb-[calc(118px+env(safe-area-inset-bottom))] pt-24">
        <section className="space-y-5" aria-labelledby="result-heading">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-main-brown/55">분석 결과</p>
              <p className="mt-3 text-[12px] font-bold text-main-brown/55">{resolvedFaceShape}</p>
              <h2 id="result-heading" className="mt-1 text-[25px] font-bold leading-tight text-main-brown">
                {resultCopy.title}
              </h2>
            </div>
            <FaceShapeImage faceShape={resolvedFaceShape} className="shrink-0" />
          </div>

          {capturedImage && (
            <div className="overflow-hidden rounded-lg border border-main-brown/10 bg-main-brown/[0.03]">
              <Image
                src={capturedImage}
                alt="분석 촬영 이미지"
                width={390}
                height={220}
                unoptimized
                className="object-cover"
                style={{ width: '100%', height: '220px' }}
              />
            </div>
          )}

          <div className="rounded-lg border border-main-brown/10 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-main-brown text-white">
                <ShieldCheck size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-main-brown/55">추천 눈썹</p>
                <h3 className="mt-1 text-[19px] font-bold leading-tight text-main-brown">
                  {resolvedStyle?.name ?? resultCopy.insight}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-sub-gray">
                  {resultCopy.recommendationExplanation}
                </p>
              </div>
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="space-y-2" aria-label="추천 눈썹 스타일 목록">
              {recommendations.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onSelectedStyleChange(style)}
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-left transition',
                    resolvedStyle?.id === style.id
                      ? 'border-main-brown bg-main-brown/[0.04]'
                      : 'border-main-brown/10 bg-white',
                  ].join(' ')}
                  aria-pressed={resolvedStyle?.id === style.id}
                >
                  <span className="block text-[14px] font-bold text-main-brown">{style.name}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-sub-gray">{style.description}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 space-y-5" aria-labelledby="measurement-heading">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-1.5 rounded-full bg-main-brown" />
              <h3 id="measurement-heading" className="text-[14px] font-bold text-main-brown/60">측정 수치</h3>
            </div>
            <span className="text-[11px] font-bold text-sub-gray">
              {analysis ? `${analysis.ipdMm.toFixed(1)}mm IPD 기준` : '측정 대기'}
            </span>
          </div>

          {measurementGateMessage && (
            <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.04] px-4 py-3">
              <p className="text-[12px] font-bold text-main-brown">측정값 재확인 필요</p>
              <p className="mt-1 text-[11px] leading-relaxed text-sub-gray">{measurementGateMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {measurements.map((measurement) => (
              <div key={measurement.label} className="min-w-0 rounded-lg border border-main-brown/10 bg-white px-3 py-3">
                <p className="break-keep text-[10px] font-bold leading-tight text-sub-gray">{measurement.label}</p>
                <p className="mt-1 text-[10px] leading-snug text-sub-gray/80">{measurement.description}</p>
                <p className="mt-2 text-[18px] font-bold leading-none text-main-brown tabular-nums">{measurement.value}</p>
                {measurement.confidence && (
                  <p className="mt-1 text-[10px] font-bold text-sub-gray">
                    +/-{measurement.confidence.estimatedErrorMm.toFixed(1)}mm
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-main-brown/10 bg-white px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-secondary min-h-[58px] flex-1 text-main-brown"
          >
            <RefreshCw size={18} aria-hidden="true" />
            다시 찍기
          </button>
          <button
            type="button"
            onClick={onApplyStyle}
            className="btn btn-primary min-h-[58px] flex-[1.15]"
          >
            처음으로
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
