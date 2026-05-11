"use client";

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import {
  FaceShape,
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  type FaceShapeResultCopy,
} from '../../../types';
import { EyebrowStyleCarousel } from './EyebrowStyleCarousel';
import { FaceShapeImage } from './FaceShapeImage';

interface RecommendationResultsProps {
  faceShape: FaceShape;
  resultCopy: FaceShapeResultCopy;
  recommendations: EyebrowStyle[];
  recommendationContext: EyebrowRecommendationContext;
  onSelectRecommendation: (style: EyebrowStyle, context: EyebrowRecommendationContext) => void;
  onRetry: () => void;
}

export function RecommendationResults({
  faceShape,
  resultCopy,
  recommendations,
  recommendationContext,
  onSelectRecommendation,
  onRetry,
}: RecommendationResultsProps) {
  const [selectedStyleId, setSelectedStyleId] = useState(recommendations[0]?.id);
  const selectedStyle = useMemo(
    () => recommendations.find((style) => style.id === selectedStyleId) ?? recommendations[0],
    [recommendations, selectedStyleId],
  );
  const handleStyleSelect = useCallback((style: EyebrowStyle) => {
    setSelectedStyleId(style.id);
  }, []);
  const metricHighlights = [
    { label: '눈썹 길이', value: `${recommendationContext.metrics.totalLength.toFixed(1)}mm` },
    { label: '아치 높이', value: `${recommendationContext.metrics.archHeight.toFixed(1)}mm` },
    { label: '눈썹 간격', value: `${recommendationContext.metrics.gap.toFixed(1)}mm` },
  ];

  if (!selectedStyle) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container overflow-hidden bg-white"
    >
      <div className="content-scrollable px-5 pb-[calc(112px+env(safe-area-inset-bottom))] pt-24">
        <section className="space-y-4" aria-labelledby="face-shape-result">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-main-brown/55">분석 완료</p>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-main-brown/55">{faceShape}</p>
                <h2 id="face-shape-result" className="mt-1 text-[26px] font-bold leading-tight text-main-brown">
                  {resultCopy.title}
                </h2>
              </div>
              <FaceShapeImage faceShape={faceShape} className="shrink-0" />
            </div>
            <p className="text-[14px] leading-relaxed text-sub-gray">{resultCopy.description}</p>
          </div>

          {metricHighlights.length > 0 && (
            <div
              className="grid grid-cols-3 gap-2 rounded-lg border border-main-brown/10 bg-white p-3"
              aria-label={`IPD ${recommendationContext.ipdMm.toFixed(1)}mm 기준 추천 측정값`}
            >
              {metricHighlights.map((metric) => (
                <div key={metric.label} className="min-w-0 rounded-md bg-main-brown/[0.03] px-2 py-3 text-center">
                  <p className="truncate text-[10px] font-bold text-sub-gray">{metric.label}</p>
                  <p className="mt-1 text-[16px] font-bold leading-none text-main-brown tabular-nums">{metric.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-main-brown text-white">
                <Sparkles size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[12px] font-bold text-main-brown/55">추천 근거</p>
                <h3 className="text-[19px] font-bold leading-tight text-main-brown">{resultCopy.insight}</h3>
                <p className="text-[13px] leading-relaxed text-sub-gray">
                  얼굴형 분석 결과와 눈썹 라인의 상승감, 아치 높이, 시작점 균형을 함께 반영한 MVP 추천입니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-3" aria-labelledby="style-carousel-heading">
          <div className="flex items-center justify-between">
            <h3 id="style-carousel-heading" className="text-[13px] font-bold text-main-brown/55">
              눈썹 스타일
            </h3>
            <span className="text-[12px] font-bold text-main-brown">{selectedStyle.name}</span>
          </div>

          <EyebrowStyleCarousel
            styles={recommendations}
            selectedStyle={selectedStyle}
            onSelectStyle={handleStyleSelect}
          />
        </section>

        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-main-brown/10 bg-white px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4">
          <p className="mb-3 text-center text-[12px] font-light leading-relaxed text-sub-gray">
            추천 스타일을 선택한 뒤 AR 미리보기로 확인하세요.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-secondary min-h-[58px] flex-1 text-main-brown"
            >
              <RefreshCw size={18} aria-hidden="true" />
              다시 스캔
            </button>
            <button
              type="button"
              onClick={() => onSelectRecommendation(selectedStyle, recommendationContext)}
              className="btn btn-primary min-h-[58px] flex-[1.25]"
            >
              AR 미리보기
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
