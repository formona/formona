"use client";

import { ChevronRight, RefreshCw } from 'lucide-react';
import { CAMERA_PERMISSION_COPY } from '../../../constants';
import type { CameraPermissionState } from '../../../types';

type PermissionControlsProps = {
  mode: 'permission';
  cameraPermission: Exclude<CameraPermissionState, 'granted'>;
  onRequestCameraPermission: () => void;
};

type CaptureControlsProps = {
  mode: 'capture';
  analysisReady: boolean;
  disabledLabel?: string;
  disabledDescription?: string;
};

type ResultControlsProps = {
  mode: 'result';
  onRetry: () => void;
  onApplyStyle: () => void;
};

type ControlsProps = PermissionControlsProps | CaptureControlsProps | ResultControlsProps;

export const Controls = (props: ControlsProps) => {
  if (props.mode === 'permission') {
    const permissionCopy = CAMERA_PERMISSION_COPY[props.cameraPermission];

    return (
      <div className="mt-6 flex w-full max-w-[310px] flex-col gap-3">
        <button
          type="button"
          onClick={props.onRequestCameraPermission}
          disabled={props.cameraPermission === 'pending'}
          className="btn btn-primary btn-full"
        >
          {permissionCopy.actionLabel}
        </button>
      </div>
    );
  }

  if (props.mode === 'capture') {
    const captureLabel = props.analysisReady ? '자동 분석 중' : props.disabledLabel ?? '얼굴 정렬 필요';
    const captureDescription = props.analysisReady
      ? '얼굴 기준점이 확인되었습니다. 추천 화면으로 자동 이동합니다.'
      : props.disabledDescription ?? '얼굴 전체를 타원 안에 맞추면 촬영 버튼이 활성화됩니다.';

    return (
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-main-brown/10 bg-white px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <p className="mb-2 text-center text-[11px] font-light leading-snug text-sub-gray">
          {captureDescription}
        </p>
        <button
          type="button"
          disabled
          className="btn btn-primary min-h-[56px] w-full text-[16px]"
          aria-live="polite"
        >
          {captureLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-main-brown/10 bg-white px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={props.onRetry}
          className="btn btn-secondary min-h-[58px] flex-1 text-main-brown"
        >
          <RefreshCw size={18} aria-hidden="true" />
          다시 찍기
        </button>
        <button
          type="button"
          onClick={props.onApplyStyle}
          className="btn btn-primary min-h-[58px] flex-[1.15]"
        >
          처음으로
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
