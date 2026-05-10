"use client";

import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, MoveHorizontal, ScanFace } from 'lucide-react';
import { BRAND_COLORS } from '../../../constants';
import type { FaceAlignment, FaceShape, IpdMeasurementGuidance, LandmarkFrameGuidance } from '../../../domain/types';
import { cn } from '../utils';

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

type CaptureFallbackKind = 'no-face' | 'low-confidence' | 'missing-landmarks';

interface CaptureFallbackState {
  kind: CaptureFallbackKind;
  label: string;
  title: string;
  message: string;
  action: string;
}

interface FaceGuidanceProps {
  alignment: FaceAlignment;
  trackerStatus: TrackerStatus;
  detectedFaceShape?: FaceShape | null;
  ipdGuidance?: IpdMeasurementGuidance | null;
  frameGuidance?: LandmarkFrameGuidance | null;
}

const getCaptureFallbackState = (
  frameGuidance: LandmarkFrameGuidance | null,
  ipdGuidance: IpdMeasurementGuidance | null,
): CaptureFallbackState | null => {
  if (frameGuidance?.reason === 'missing_face') {
    return {
      kind: 'no-face',
      label: '얼굴 미감지',
      title: frameGuidance.title,
      message: frameGuidance.message,
      action: '얼굴 전체가 타원 안에 보이도록 휴대폰을 정면에 맞춰주세요.',
    };
  }

  if (frameGuidance?.reason === 'low_confidence' || ipdGuidance?.reason === 'low_confidence') {
    const guidance = frameGuidance?.reason === 'low_confidence' ? frameGuidance : ipdGuidance;

    return {
      kind: 'low-confidence',
      label: '기준점 신뢰도 낮음',
      title: guidance?.title ?? 'Landmark 추적이 불안정해요',
      message: guidance?.message ?? '밝은 곳에서 휴대폰과 얼굴을 잠시 고정하면 분석이 안정됩니다.',
      action: '밝은 조명에서 정면을 보고 1초 정도 움직임을 멈춰주세요.',
    };
  }

  if (frameGuidance || ipdGuidance?.reason === 'missing_landmarks') {
    const guidance = frameGuidance ?? ipdGuidance;

    return {
      kind: 'missing-landmarks',
      label: '기준점 누락',
      title: guidance?.title ?? '얼굴 기준점이 일부 가려졌어요',
      message: guidance?.message ?? '눈썹, 눈, 턱선이 화면 밖이나 머리카락에 가려지지 않게 조정해주세요.',
      action: '앞머리, 손, 안경테를 치우고 양쪽 눈썹과 눈이 모두 보이게 맞춰주세요.',
    };
  }

  return null;
};

export const FaceGuidance = ({
  alignment,
  trackerStatus,
  detectedFaceShape = null,
  ipdGuidance = null,
  frameGuidance = null,
}: FaceGuidanceProps) => {
  const faceDetected = alignment.detected;
  const fallbackState = getCaptureFallbackState(frameGuidance, ipdGuidance);
  const aligned = Boolean(alignment.ready ?? (
    alignment.detected && alignment.centered && alignment.distanceOk && alignment.pitchOk && alignment.yawOk
  ));
  const statusLabel = trackerStatus === 'ready' ? 'FaceMesh 추적 중' : 'FaceMesh 준비 중';
  const guidanceMessage = fallbackState?.action ?? (faceDetected ? alignment.guidance : '정면을 바라봐 주세요');
  const guideColor = aligned
    ? BRAND_COLORS.faceGuideDetected
    : faceDetected
      ? '#F59E0B'
      : BRAND_COLORS.faceGuideIdle;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <motion.div
          animate={{
            scale: aligned ? 1.04 : 1,
            borderColor: guideColor,
            boxShadow: aligned ? '0 0 20px rgba(74,222,128,0.4)' : faceDetected ? '0 0 18px rgba(245,158,11,0.35)' : 'none',
          }}
          className={cn(
            "w-[74%] h-[60%] border-[3px] rounded-[100%]",
            !faceDetected && "border-dashed"
          )}
          id="face-guide"
          aria-label={aligned ? '얼굴 정렬 완료' : '얼굴 정렬 가이드'}
        />
      </div>

      <div className="absolute left-4 right-4 top-4 flex justify-center">
        <div className="glass-pill max-w-full rounded-full border-glass-border px-5 py-3 shadow-sm">
          <p aria-live="polite" className="truncate text-[14px] font-bold tracking-tight text-main-brown">
            {guidanceMessage}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 space-y-3">
        {fallbackState && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-[22px] border bg-white/[0.94] px-4 py-3 text-main-brown shadow-sm backdrop-blur-md",
              fallbackState.kind === 'no-face' ? "border-main-brown/20" : "border-amber-400/35"
            )}
          >
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
              <AlertCircle
                size={15}
                className={cn(
                  "shrink-0",
                  fallbackState.kind === 'no-face' ? "text-main-brown/55" : "text-amber-500"
                )}
              />
              <span className="rounded-full bg-main-brown/8 px-2 py-0.5 text-[10px] font-bold text-main-brown">
                AR 캡처 대기: {fallbackState.label}
              </span>
              <span>{fallbackState.title}</span>
            </p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-sub-gray">
              {fallbackState.message}
            </p>
            <p className="mt-2 text-[11px] font-bold leading-relaxed text-main-brown">
              {fallbackState.action}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-main-brown/10 bg-white/[0.82] px-4 py-3 shadow-sm backdrop-blur-md">
          <p className="flex min-w-[128px] flex-1 items-center gap-2 text-[12px] font-bold text-main-brown">
            {aligned ? <CheckCircle2 size={15} className="shrink-0" /> : faceDetected ? <MoveHorizontal size={15} className="shrink-0" /> : <ScanFace size={15} className="shrink-0" />}
            <span className="truncate">{statusLabel}</span>
          </p>
          {detectedFaceShape && (
            <span
              className="shrink-0 rounded-full bg-main-brown/8 px-2.5 py-1 text-[11px] font-bold text-main-brown"
              aria-label={`감지된 얼굴형 ${detectedFaceShape}`}
            >
              {detectedFaceShape} 감지
            </span>
          )}
          {faceDetected && (
            <div className="h-1.5 min-w-[76px] overflow-hidden rounded-full bg-main-brown/10" aria-label={`정렬 정확도 ${Math.round(alignment.confidence * 100)}%`}>
              <div
                className={cn("h-full rounded-full", aligned ? "bg-green-500" : "bg-amber-500")}
                style={{ width: `${Math.round(alignment.confidence * 100)}%` }}
              />
            </div>
          )}
          <span className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            aligned ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.55)]" : faceDetected ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]" : "bg-main-brown/25"
          )} />
        </div>
      </div>
    </>
  );
};
