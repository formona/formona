"use client";

import { BRAND_COLORS } from '../../../constants';
import { FaceShape } from '../../../types';
import { cn } from '../utils';

interface FaceShapeImageProps {
  faceShape: FaceShape;
  className?: string;
}

const FACE_SHAPE_PATHS: Record<FaceShape, string> = {
  [FaceShape.OVAL]: 'M72 20 C101 20 121 49 119 88 C117 128 96 160 72 160 C48 160 27 128 25 88 C23 49 43 20 72 20Z',
  [FaceShape.SQUARE]: 'M42 24 C52 18 92 18 102 24 C114 32 120 56 118 92 L111 134 C107 153 93 162 72 162 C51 162 37 153 33 134 L26 92 C24 56 30 32 42 24Z',
  [FaceShape.ROUND]: 'M72 24 C105 24 124 53 124 91 C124 129 103 157 72 157 C41 157 20 129 20 91 C20 53 39 24 72 24Z',
  [FaceShape.HEART]: 'M72 21 C99 19 121 43 121 78 C121 119 95 158 72 164 C49 158 23 119 23 78 C23 43 45 19 72 21Z',
};

export function FaceShapeImage({ faceShape, className }: FaceShapeImageProps) {
  const facePath = FACE_SHAPE_PATHS[faceShape];

  return (
    <div
      className={cn(
        "w-[86px] rounded-2xl border border-main-brown/10 bg-white p-2 text-center shadow-[0_8px_22px_rgba(79,44,29,0.08)]",
        className
      )}
      role="img"
      aria-label={`${faceShape} 얼굴형 이미지`}
    >
      <svg viewBox="0 0 144 188" className="h-[74px] w-full" aria-hidden="true">
        <rect x="10" y="8" width="124" height="172" rx="28" fill={BRAND_COLORS.brown} opacity="0.04" />
        <path d="M35 32 C49 14 96 14 109 32 C121 50 126 73 123 97 C120 60 106 39 72 39 C38 39 24 60 21 97 C18 73 23 50 35 32Z" fill={BRAND_COLORS.brown} opacity="0.14" />
        <path d={facePath} fill="#FFFFFF" stroke={BRAND_COLORS.brown} strokeWidth="4" />
        <path d="M45 81 Q56 75 66 82" fill="none" stroke={BRAND_COLORS.brown} strokeWidth="3.4" strokeLinecap="round" opacity="0.72" />
        <path d="M78 82 Q88 75 99 81" fill="none" stroke={BRAND_COLORS.brown} strokeWidth="3.4" strokeLinecap="round" opacity="0.72" />
        <circle cx="56" cy="94" r="3.2" fill={BRAND_COLORS.brown} opacity="0.76" />
        <circle cx="88" cy="94" r="3.2" fill={BRAND_COLORS.brown} opacity="0.76" />
        <path d="M65 111 Q72 116 79 111" fill="none" stroke={BRAND_COLORS.gray} strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
        <path d="M55 132 Q72 142 89 132" fill="none" stroke={BRAND_COLORS.brown} strokeWidth="3" strokeLinecap="round" opacity="0.58" />
      </svg>
      <span className="block truncate text-[11px] font-bold leading-tight text-main-brown">{faceShape}</span>
    </div>
  );
}
