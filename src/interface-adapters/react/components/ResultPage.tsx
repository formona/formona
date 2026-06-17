"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { Info, ScanFace, Sparkles } from 'lucide-react';
import { FACE_SHAPE_RESULT_COPY } from '../../../constants';
import { buildEyebrowRecommendationState, buildEyebrowRecommendationStateFromContext } from '../../../usecases/eyebrow-recommendations';
import {
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  FaceShape,
  type FaceAnalysisResult,
} from '../../../types';
import { cn } from '../utils';
import { FlowProgress } from './FlowProgress';

interface ResultPageProps {
  faceShape: FaceShape | null;
  capturedImage: string | null;
  analysis: FaceAnalysisResult | null;
  recommendationContext: EyebrowRecommendationContext | null;
  selectedStyle: EyebrowStyle | null;
  onSelectedStyleChange: (style: EyebrowStyle) => void;
  onRetry: () => void;
  onNextStep: () => void;
}

const getStyleCategoryName = (style: EyebrowStyle | null) => {
  if (!style) return '추천형';

  if (style.id === 'upward' || style.id.includes('angular')) return '갈매기형';
  if (style.id.includes('straight')) return '일자형';
  return '아치형';
};

const BrowPreview = ({ style, selected }: { style: EyebrowStyle; selected: boolean }) => (
  <svg viewBox="0 0 100 40" className="h-5 w-8 shrink-0" aria-hidden="true">
    <path
      d={style.path}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={selected ? 7 : 6}
      transform="translate(0 2)"
    />
  </svg>
);

export function ResultPage({
  faceShape,
  capturedImage,
  analysis,
  recommendationContext,
  selectedStyle,
  onSelectedStyleChange,
  onRetry,
  onNextStep,
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
  const styleCategoryName = getStyleCategoryName(resolvedStyle);
  const resultStatus = analysis?.metricConfidence?.reportable === false ? '측정값 검토 필요' : '대칭 분석 완료';
  const [showRecommendationInfo, setShowRecommendationInfo] = useState(false);

  useEffect(() => {
    if (!resolvedStyle && recommendations[0]) {
      onSelectedStyleChange(recommendations[0]);
    }
  }, [onSelectedStyleChange, recommendations, resolvedStyle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container result-page bg-white"
    >
      <div className="result-page-scroll">
        <section
          className="flow-card result-card flex w-full flex-col"
          aria-labelledby="result-heading"
        >
          <FlowProgress currentStep={3} className="mx-auto mb-5" />

          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-main-brown/10 bg-white text-main-brown">
              <ScanFace size={27} strokeWidth={1.9} aria-hidden="true" />
            </div>
            <p className="sr-only">{resultCopy.title}</p>
            <p className="sr-only">{resolvedFaceShape}</p>
            <h2 id="result-heading" className="mt-4 text-[23px] font-bold leading-tight text-main-brown">
              추천 눈썹 디자인 결과
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-sub-gray">
              얼굴 비율과 눈썹 분석 결과를 바탕으로<br />
              가장 어울리는 눈썹을 추천합니다.
            </p>
          </div>

          <div className="result-photo-frame relative mx-auto mt-4 w-full shrink-0 overflow-hidden bg-main-brown/[0.02]">
            {capturedImage ? (
              <Image
                src={capturedImage}
                alt="분석 촬영 이미지"
                fill
                sizes="(max-width: 430px) calc(100vw - 52px), 372px"
                unoptimized
                className="object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-main-brown/35">
                <ScanFace size={72} strokeWidth={1.2} aria-hidden="true" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/55" aria-hidden="true" />
            <div className="pointer-events-none absolute left-0 right-0 top-[43%] h-px bg-white/55" aria-hidden="true" />
          </div>

          <div className="mt-3 rounded-[22px] border border-main-brown/10 bg-white p-3 shadow-[0_8px_22px_rgba(79,44,29,0.06)]">
            {recommendations.length > 0 && (
              <div className="grid grid-cols-3 gap-2" aria-label="추천 눈썹 스타일 목록">
                {recommendations.slice(0, 3).map((style) => {
                  const selected = resolvedStyle?.id === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => onSelectedStyleChange(style)}
                      className={cn(
                        "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[12px] font-bold transition",
                        selected
                          ? "border-main-brown bg-main-brown text-white"
                          : "border-main-brown/10 bg-white text-main-brown/75"
                      )}
                      aria-label={`${style.name} 선택`}
                      aria-pressed={selected}
                    >
                      <BrowPreview style={style} selected={selected} />
                      <span className="truncate">{getStyleCategoryName(style)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-main-brown/[0.04] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-main-brown text-white">
                <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="text-[15px] font-bold leading-tight text-main-brown">
                  추천 디자인: {styleCategoryName}
                </h3>
                <p className="mt-1 text-[12px] font-light text-sub-gray">{resultStatus}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecommendationInfo(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-main-brown/55 transition hover:bg-main-brown/[0.06] focus-visible:outline focus-visible:outline-3 focus-visible:outline-main-brown/20"
                aria-label="추천 디자인 설명 보기"
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-4">
            <button type="button" onClick={onNextStep} className="btn btn-primary btn-full rounded-[14px]">
              다음 단계
            </button>
            <button type="button" onClick={onRetry} className="btn btn-secondary btn-full rounded-[14px]">
              다시 측정
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showRecommendationInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 px-7"
            onClick={() => setShowRecommendationInfo(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="recommendation-info-heading"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-[330px] rounded-[22px] border border-main-brown/10 bg-white p-6 text-left shadow-[0_18px_42px_rgba(79,44,29,0.16)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-main-brown text-white">
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <h3 id="recommendation-info-heading" className="mt-4 text-[20px] font-bold text-main-brown">
                {styleCategoryName} 추천 이유
              </h3>
              <p className="mt-3 text-[13px] font-bold leading-relaxed text-main-brown">
                {resolvedStyle?.name ?? '추천 디자인'} · {resolvedFaceShape}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-sub-gray">
                {resolvedStyle?.description ?? resultCopy.insight}
              </p>
              <div className="mt-4 rounded-[14px] bg-main-brown/[0.04] px-4 py-3">
                <p className="text-[12px] font-bold text-main-brown">분석 근거</p>
                <p className="mt-1 text-[12px] leading-relaxed text-sub-gray">
                  {resultCopy.recommendationExplanation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecommendationInfo(false)}
                className="btn btn-primary btn-full mt-5 rounded-[14px]"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
