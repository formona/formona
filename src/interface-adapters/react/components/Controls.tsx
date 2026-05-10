"use client";

import type React from 'react';
import { ChevronRight, RefreshCw, Upload } from 'lucide-react';
import { CAMERA_PERMISSION_COPY } from '../../../constants';
import type { CameraPermissionState } from '../../../types';

type FileUploadHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;

type PermissionControlsProps = {
  mode: 'permission';
  cameraPermission: Exclude<CameraPermissionState, 'granted'>;
  onRequestCameraPermission: () => void;
  onFileUpload: FileUploadHandler;
};

type CaptureControlsProps = {
  mode: 'capture';
  analysisReady: boolean;
  disabledLabel?: string;
  disabledDescription?: string;
  onCapture: () => void;
  onFileUpload: FileUploadHandler;
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
        {props.cameraPermission !== 'idle' && (
          <label className="btn btn-secondary btn-compact cursor-pointer">
            이미지 수동 업로드
            <input type="file" accept="image/*" className="hidden" onChange={props.onFileUpload} />
          </label>
        )}
      </div>
    );
  }

  if (props.mode === 'capture') {
    const captureLabel = props.analysisReady ? '촬영하고 추천 보기' : props.disabledLabel ?? '얼굴 정렬 필요';
    const captureDescription = props.analysisReady
      ? '준비가 완료되었습니다. 촬영하면 추천 단계로 이동합니다.'
      : props.disabledDescription ?? '얼굴 전체를 타원 안에 맞추면 촬영 버튼이 활성화됩니다.';

    return (
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-main-brown/10 bg-white/[0.94] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_34px_rgba(79,44,29,0.10)] backdrop-blur-xl">
        <p className="mb-3 text-center text-[12px] font-medium leading-relaxed text-sub-gray">
          {captureDescription}
        </p>
        <div className="flex w-full gap-3">
          <label className="btn btn-secondary btn-icon cursor-pointer shrink-0" aria-label="이미지 수동 업로드">
            <Upload size={22} className="text-main-brown opacity-60" />
            <input type="file" accept="image/*" className="hidden" onChange={props.onFileUpload} />
          </label>
          <button
            type="button"
            onClick={props.onCapture}
            disabled={!props.analysisReady}
            className="btn btn-primary min-h-[62px] flex-1 text-[17px]"
          >
            {captureLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-main-brown/10 bg-white/[0.96] px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_34px_rgba(79,44,29,0.10)] backdrop-blur-xl">
      <p className="mb-3 text-center text-[12px] font-medium leading-relaxed text-sub-gray">
        AR 미리보기를 확인한 뒤 다시 촬영하거나 처음 단계로 돌아가세요.
      </p>
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
