"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Info, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import {
  APP_TIMING_MS,
  BRAND_COLORS,
  FACE_SHAPE_RESULT_COPY,
  IPD_CONFIG,
  Page,
} from '../constants';
import {
  type EyebrowRecommendationContext,
  type EyebrowStyle,
  type FaceAnalysisResult,
} from '../types';
import { buildEyebrowRecommendationState } from '../usecases/eyebrow-recommendations';
import { CapturePage } from '../interface-adapters/react/components/CapturePage';
import { RecommendationResults } from '../interface-adapters/react/components/RecommendationResults';
import { ResultPage } from '../interface-adapters/react/components/ResultPage';
import { parseValidIpd, resolveIpdFallback, type IpdFallbackSource } from '../usecases/ipd';

const getIpdFallbackNotice = (source: IpdFallbackSource, value: number) => {
  if (source === 'last-valid') {
    return `입력값을 확인할 수 없어 마지막 유효 IPD ${value}mm를 적용했습니다.`;
  }

  if (source === 'default') {
    return `입력값을 확인할 수 없어 기본값 ${value}mm로 진행합니다.`;
  }

  return null;
};

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState<Page>(Page.SPLASH);
  const [ipd, setIpd] = useState<number>(IPD_CONFIG.defaultMm);
  const [ipdInput, setIpdInput] = useState<string>(String(IPD_CONFIG.defaultMm));
  const [ipdSaved, setIpdSaved] = useState(false);
  const [ipdFallbackNotice, setIpdFallbackNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentPage !== Page.SPLASH) return;

    const timer = window.setTimeout(() => {
      setCurrentPage(Page.IPD_INPUT);
    }, APP_TIMING_MS.splash);

    return () => window.clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    const saved = localStorage.getItem(IPD_CONFIG.storageKey);
    if (saved === null) return;

    const resolvedIpd = resolveIpdFallback(saved);
    setIpd(resolvedIpd.value);
    setIpdInput(String(resolvedIpd.value));
    localStorage.setItem(IPD_CONFIG.storageKey, String(resolvedIpd.value));
    setIpdSaved(true);
    setIpdFallbackNotice(getIpdFallbackNotice(resolvedIpd.source, resolvedIpd.value));
  }, []);

  const [showIpdInfo, setShowIpdInfo] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<EyebrowStyle | null>(null);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(null);
  const [recommendationContext, setRecommendationContext] = useState<EyebrowRecommendationContext | null>(null);
  const currentIpdInput = parseValidIpd(ipdInput);
  const ipdInputError = ipdInput.length > 0 && currentIpdInput === null;
  const canGoBack = currentPage === Page.CAPTURE || currentPage === Page.RECOMMENDATIONS || currentPage === Page.RESULT;

  const handleAnalysisComplete = (imageDataUrl: string, analysis: FaceAnalysisResult) => {
    const nextRecommendationState = buildEyebrowRecommendationState(analysis);

    setCapturedImage(imageDataUrl);
    setFaceAnalysis(analysis);
    setRecommendationContext(nextRecommendationState.context);
    setSelectedStyle(nextRecommendationState.status === 'ready' ? nextRecommendationState.recommendations[0] : null);
    setCurrentPage(Page.RECOMMENDATIONS);
  };

  const saveIpd = () => {
    const nextIpd = parseValidIpd(ipdInput);
    const resolvedIpd = nextIpd === null ? resolveIpdFallback(ipdInput, ipd) : { value: nextIpd, source: 'input' as const };

    setIpd(resolvedIpd.value);
    setIpdInput(String(resolvedIpd.value));
    localStorage.setItem(IPD_CONFIG.storageKey, String(resolvedIpd.value));
    setIpdSaved(true);
    setIpdFallbackNotice(getIpdFallbackNotice(resolvedIpd.source, resolvedIpd.value));
    return resolvedIpd;
  };

  const goBack = () => {
    switch (currentPage) {
      case Page.IPD_INPUT:
        break;
      case Page.CAPTURE:
        setCurrentPage(Page.IPD_INPUT);
        break;
      case Page.RECOMMENDATIONS:
        setCurrentPage(Page.CAPTURE);
        break;
      case Page.RESULT:
        setCurrentPage(Page.RECOMMENDATIONS);
        break;
      default:
        break;
    }
  };

  const restartScan = () => {
    setCapturedImage(null);
    setFaceAnalysis(null);
    setRecommendationContext(null);
    setSelectedStyle(null);
    setCurrentPage(Page.CAPTURE);
  };

  // Page 0: Splash
  const SplashPage = () => (
    <motion.div
      key="splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="app-container items-center justify-center bg-main-brown px-10 text-center text-white"
      aria-label="MONABROW splash screen"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-8"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/20 bg-white shadow-2xl">
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M10 5H30V10H15V18H28V23H15V35H10V5Z" fill={BRAND_COLORS.brown} />
          </svg>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-white/65">FORMONA</p>
          <h1 className="text-[42px] font-bold leading-none tracking-normal">MONABROW</h1>
          <p className="text-[15px] font-medium leading-relaxed text-white/75">
            첫 인상을 디자인하다,<br />눈썹 화장의 원픽
          </p>
        </div>
      </motion.div>
    </motion.div>
  );

  // Page 1: Intro
  const IntroPage = () => (
    <motion.div
      key="intro"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="app-container p-8 text-center justify-center"
    >
      <div className="glass p-12 rounded-[56px] w-full space-y-12 relative overflow-hidden">
        <div className="space-y-8 relative z-10">
          <div className="w-20 h-20 bg-white/90 backdrop-blur-xl rounded-[28px] flex items-center justify-center mx-auto animate-float shadow-xl border border-white/60">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M10 5H30V10H15V18H28V23H15V35H10V5Z" fill={BRAND_COLORS.brown}/>
            </svg>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter text-main-brown uppercase">MONABROW</h1>
            <div className="space-y-2">
              <p className="text-main-brown font-bold text-[18px] leading-snug">첫 인상을 디자인하다,<br />눈썹 화장의 원픽</p>
              <p className="text-sub-gray font-light text-[14px] opacity-80">당신만의 눈썹을 찾는 가장 정교한 방법</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => setCurrentPage(Page.IPD_INPUT)}
            className="btn btn-primary btn-full group/btn"
          >
            시작하기
            <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
          </button>
          <p className="text-[10px] text-sub-gray font-light opacity-50 uppercase tracking-widest">© FORMONA CO., LTD.</p>
        </div>
      </div>
    </motion.div>
  );

  // Page 2: IPD Input
  const IPDPage = () => (
    <motion.div
      key="ipd"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="app-container p-8 justify-center"
    >
      <div className="glass p-12 rounded-[52px] w-full text-center relative overflow-hidden">
        <div className="space-y-4 mt-[16px] mb-[28px]">
          <div className="w-16 h-16 bg-white/60 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-glass-border shadow-sm">
            <span className="text-2xl">👁</span>
          </div>
          <h2 className="text-2xl font-bold text-main-brown tracking-tight">동공 간격(IPD) 입력</h2>
          <p className="text-sub-gray text-[14px] font-light leading-relaxed">보다 정밀한 가상 메이크업을 위해<br />본인의 동공 간격을 입력해주세요.</p>
        </div>

        <div className="relative pt-[4px] pb-2 mb-[52px]">
          <input
            type="number"
            inputMode="decimal"
            min={IPD_CONFIG.minMm}
            max={IPD_CONFIG.maxMm}
            step={IPD_CONFIG.inputStep}
            value={ipdInput}
            onChange={(e) => {
              setIpdInput(e.target.value);
              setIpdSaved(false);
              setIpdFallbackNotice(null);
            }}
            onBlur={saveIpd}
            aria-label="동공 간격 밀리미터"
            aria-invalid={ipdInputError}
            className="w-full text-center text-7xl font-bold bg-transparent border-0 outline-none text-main-brown tracking-tighter"
            placeholder={String(IPD_CONFIG.defaultMm)}
          />
          <span className="block mt-2 text-main-brown/40 font-bold text-sm tracking-widest uppercase">Millimeters</span>
          <div className="mt-4 min-h-5">
            {ipdInputError ? (
              <p className="text-xs font-bold text-main-brown">
                {IPD_CONFIG.minMm}mm부터 {IPD_CONFIG.maxMm}mm 사이로 입력해주세요.
              </p>
            ) : ipdFallbackNotice ? (
              <p className="text-xs font-bold text-main-brown">
                {ipdFallbackNotice}
              </p>
            ) : (
              <p className="text-xs text-sub-gray">
                {ipdSaved ? '저장된 IPD 값이 자동으로 적용됩니다.' : '다음 단계에서 이 값이 기기에 저장됩니다.'}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setShowIpdInfo(true)}
          className="btn btn-secondary btn-compact mx-auto mb-[12px] mt-0 text-sub-gray"
        >
          측정 방법이 궁금하신가요?
          <Info size={14} className="text-main-brown opacity-40" />
        </button>

        <button
          onClick={() => {
            const savedIpd = saveIpd();
            if (savedIpd.source === 'input') setCurrentPage(Page.CAPTURE);
          }}
          aria-disabled={!currentIpdInput}
          className="btn btn-primary btn-full"
        >
          다음 단계
        </button>
      </div>

      <AnimatePresence>
        {showIpdInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6"
            onClick={() => setShowIpdInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-xs rounded-3xl border border-main-brown/10 bg-white p-8 text-center shadow-[0_18px_42px_rgba(79,44,29,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-main-brown/10 bg-main-brown/[0.04]">
                <Info size={28} className="text-main-brown" />
              </div>
              <div className="mt-6 space-y-4">
                <p className="text-main-brown font-bold text-lg leading-tight">
                  안경을 착용하신다면<br />
                  처방전의 PD값을 확인하세요
                </p>
                <div className="h-px bg-divider w-12 mx-auto" />
                <p className="text-sub-gray text-sm font-light leading-relaxed">
                  평균값은 {IPD_CONFIG.defaultMm}mm입니다.<br />
                  정보가 없다면 기본값으로 가능합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIpdInfo(false)}
                className="btn btn-subtle btn-full mt-6"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
  // Page 4: Recommendations (Discovery)
  const RecommendationsPage = () => {
    const recommendationState = buildEyebrowRecommendationState(faceAnalysis);

    if (recommendationState.status !== 'ready') {
      const Icon = recommendationState.status === 'loading' ? Loader2 : TriangleAlert;

      return (
        <motion.div
          key="reco-error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-container justify-center bg-white px-6"
          aria-live="polite"
        >
          <div className="rounded-lg border border-main-brown/10 bg-white p-7 text-center shadow-[0_12px_34px_rgba(79,44,29,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-main-brown/[0.06] text-main-brown">
              <Icon size={24} className={recommendationState.status === 'loading' ? 'animate-spin' : undefined} aria-hidden="true" />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-main-brown/45">
              {recommendationState.status === 'loading' ? 'Recommendation Loading' : 'Recommendation Error'}
            </p>
            <h2 className="mt-2 text-[22px] font-bold leading-tight text-main-brown">
              {recommendationState.validation.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-sub-gray">
              {recommendationState.validation.message}
            </p>
            {recommendationState.status === 'error' && (
              <button
                type="button"
                onClick={restartScan}
                className="btn btn-primary btn-full mt-7"
              >
                <RefreshCw size={18} aria-hidden="true" />
                다시 스캔
              </button>
            )}
          </div>
        </motion.div>
      );
    }

    const activeRecommendationContext = recommendationState.context;
    const detectedFaceShape = activeRecommendationContext.faceShape;
    const info = FACE_SHAPE_RESULT_COPY[detectedFaceShape];

    return (
      <RecommendationResults
        key="reco"
        faceShape={detectedFaceShape}
        resultCopy={info}
        recommendations={recommendationState.recommendations}
        recommendationContext={activeRecommendationContext}
        onSelectRecommendation={(style, context) => {
          setSelectedStyle(style);
          setRecommendationContext(context);
          setCurrentPage(Page.RESULT);
        }}
        onRetry={restartScan}
      />
    );
  };
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <AnimatePresence>
        {canGoBack && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+14px)] z-[120] w-full max-w-[430px] -translate-x-1/2 px-4"
          >
            <button
              type="button"
              onClick={goBack}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-main-brown/10 bg-white text-main-brown shadow-[0_8px_20px_rgba(79,44,29,0.12)] transition hover:border-main-brown/25 focus-visible:outline focus-visible:outline-3 focus-visible:outline-main-brown/20"
              aria-label="이전 화면"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {currentPage === Page.SPLASH && SplashPage()}
        {currentPage === Page.INTRO && IntroPage()}
        {currentPage === Page.IPD_INPUT && IPDPage()}
        {currentPage === Page.CAPTURE && (
          <CapturePage
            key="capture"
            ipdMm={ipd}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}
        {currentPage === Page.RECOMMENDATIONS && RecommendationsPage()}
        {currentPage === Page.RESULT && (
          <ResultPage
            key="result"
            faceShape={faceAnalysis?.faceShape ?? null}
            capturedImage={capturedImage}
            analysis={faceAnalysis}
            recommendationContext={recommendationContext}
            selectedStyle={selectedStyle}
            onSelectedStyleChange={setSelectedStyle}
            onRetry={restartScan}
            onApplyStyle={() => setCurrentPage(Page.IPD_INPUT)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
