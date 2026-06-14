"use client";

import type React from 'react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CAMERA_PERMISSION_COPY } from '../../../constants';
import type { CameraPermissionState } from '../../../types';
import type {
  EyebrowGoldenRatioSideGuides,
  EyebrowOverlayAnchors,
  EyebrowStyle,
  FaceAlignment,
  FacePoint,
  FaceShape,
  IpdMeasurementGuidance,
  LandmarkFrameGuidance,
} from '../../../domain/types';
import { buildRecommendedEyebrowControlGeometry, type BrowControlPoints, type RecommendedEyebrowRenderMode } from '../../../domain/eyebrow-geometry';
import { mapNormalizedPointToPreviewPixel } from '../../../domain/preview-landmarks';
import { cn } from '../utils';
import { Controls } from './Controls';
import { FaceGuidance, type TrackerStatus } from './FaceGuidance';

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previewFrameRef?: RefObject<HTMLDivElement | null>;
  cameraPermission: CameraPermissionState;
  trackerStatus: TrackerStatus;
  alignment: FaceAlignment;
  detectedFaceShape?: FaceShape | null;
  liveOverlayAnchors?: EyebrowOverlayAnchors | null;
  selectedRecommendation?: EyebrowStyle | null;
  ipdGuidance: IpdMeasurementGuidance | null;
  frameGuidance: LandmarkFrameGuidance | null;
  errorMessage: string | null;
  PermissionIcon: React.ComponentType<{ size?: number; className?: string }> | null;
  onRequestCameraPermission: () => void;
  className?: string;
  showFaceGuidance?: boolean;
  guidanceMode?: 'capture' | 'preview';
}

interface PreviewBrowControlPoints {
  sp: FacePoint;
  hp: FacePoint;
  ep: FacePoint;
  lowerSp: FacePoint;
  lowerHp: FacePoint;
  lowerEp: FacePoint;
}

interface PreviewGuideLine {
  start: FacePoint;
  end: FacePoint;
}

interface PreviewGuideLines {
  spLine: PreviewGuideLine;
  hpLine: PreviewGuideLine;
  epLine: PreviewGuideLine;
}

export const CameraPreview = ({
  videoRef,
  canvasRef,
  previewFrameRef: externalPreviewFrameRef,
  cameraPermission,
  trackerStatus,
  alignment,
  detectedFaceShape = null,
  liveOverlayAnchors = null,
  selectedRecommendation = null,
  ipdGuidance,
  frameGuidance,
  errorMessage,
  PermissionIcon,
  onRequestCameraPermission,
  className,
  showFaceGuidance = true,
  guidanceMode = 'capture',
}: CameraPreviewProps) => {
  const permissionCopy = cameraPermission === 'granted' ? null : CAMERA_PERMISSION_COPY[cameraPermission];
  const internalPreviewFrameRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = externalPreviewFrameRef ?? internalPreviewFrameRef;
  const arOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayRevision, setOverlayRevision] = useState(0);
  const canShowLiveOverlay = cameraPermission === 'granted'
    && alignment.ready
    && Boolean(selectedRecommendation)
    && Boolean(liveOverlayAnchors);

  useEffect(() => {
    if (cameraPermission !== 'granted') return;

    const syncArOverlaySize = () => {
      const frame = previewFrameRef.current;
      const canvas = arOverlayCanvasRef.current;

      if (!frame || !canvas) return;

      const { width, height } = frame.getBoundingClientRect();
      if (!width || !height) return;

      const pixelRatio = window.devicePixelRatio || 1;
      const nextWidth = Math.round(width * pixelRatio);
      const nextHeight = Math.round(height * pixelRatio);

      const changed = canvas.width !== nextWidth || canvas.height !== nextHeight;
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (changed) setOverlayRevision((revision) => revision + 1);
    };

    syncArOverlaySize();

    const frame = previewFrameRef.current;
    const video = videoRef.current;
    const resizeObserver = typeof ResizeObserver === 'undefined' || !frame
      ? null
      : new ResizeObserver(() => syncArOverlaySize());

    if (resizeObserver && frame) {
      resizeObserver.observe(frame);
    }
    video?.addEventListener('loadedmetadata', syncArOverlaySize);
    window.addEventListener('resize', syncArOverlaySize);
    window.addEventListener('orientationchange', syncArOverlaySize);

    return () => {
      resizeObserver?.disconnect();
      video?.removeEventListener('loadedmetadata', syncArOverlaySize);
      window.removeEventListener('resize', syncArOverlaySize);
      window.removeEventListener('orientationchange', syncArOverlaySize);
    };
  }, [cameraPermission, previewFrameRef, videoRef]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    const canvas = arOverlayCanvasRef.current;
    const video = videoRef.current;
    if (!frame || !canvas || !video) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const previewRect = frame.getBoundingClientRect();
    const previewDimensions = { width: previewRect.width, height: previewRect.height };
    const videoDimensions = { width: video.videoWidth, height: video.videoHeight };
    const pixelRatio = window.devicePixelRatio || 1;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const recommendationGeometry = buildRecommendedEyebrowControlGeometry(
      selectedRecommendation,
      liveOverlayAnchors,
    );

    if (
      cameraPermission !== 'granted'
      || !alignment.ready
      || !liveOverlayAnchors
      || !recommendationGeometry
      || previewDimensions.width <= 0
      || previewDimensions.height <= 0
      || videoDimensions.width <= 0
      || videoDimensions.height <= 0
    ) {
      return;
    }

    const toPreviewPoint = (point: FacePoint): FacePoint | null => {
      const mappedPoint = mapNormalizedPointToPreviewPixel(point, videoDimensions, previewDimensions);
      return mappedPoint ? { x: mappedPoint.x, y: mappedPoint.y, z: mappedPoint.z } : null;
    };

    const mapControlPoints = (points: BrowControlPoints): PreviewBrowControlPoints | null => {
      const sp = toPreviewPoint(points.sp);
      const hp = toPreviewPoint(points.hp);
      const ep = toPreviewPoint(points.ep);
      const lowerSp = toPreviewPoint(points.lowerSp);
      const lowerHp = toPreviewPoint(points.lowerHp);
      const lowerEp = toPreviewPoint(points.lowerEp);
      if (!sp || !hp || !ep || !lowerSp || !lowerHp || !lowerEp) return null;

      return {
        sp,
        hp,
        ep,
        lowerSp,
        lowerHp,
        lowerEp,
      };
    };

    const left = mapControlPoints(recommendationGeometry.left);
    const right = mapControlPoints(recommendationGeometry.right);
    if (!left || !right) return;

    const mapGuideLine = (line: EyebrowGoldenRatioSideGuides['spLine']): PreviewGuideLine | null => {
      const start = toPreviewPoint(line.start);
      const end = toPreviewPoint(line.end);
      return start && end ? { start, end } : null;
    };
    const mapGuideLines = (guides?: EyebrowGoldenRatioSideGuides): PreviewGuideLines | null => {
      if (!guides) return null;

      const spLine = mapGuideLine(guides.spLine);
      const hpLine = mapGuideLine(guides.hpLine);
      const epLine = mapGuideLine(guides.epLine);
      if (!spLine || !hpLine || !epLine) return null;

      return {
        spLine,
        hpLine,
        epLine,
      };
    };
    const leftGuideLines = mapGuideLines(liveOverlayAnchors.left.guides);
    const rightGuideLines = mapGuideLines(liveOverlayAnchors.right.guides);

    const drawFillPath = (
      points: PreviewBrowControlPoints,
      mode: RecommendedEyebrowRenderMode,
    ) => {
      context.beginPath();
      context.moveTo(points.sp.x, points.sp.y);
      if (mode === 'angular') {
        context.lineTo(points.hp.x, points.hp.y);
        context.lineTo(points.ep.x, points.ep.y);
        context.lineTo(points.lowerEp.x, points.lowerEp.y);
        context.lineTo(points.lowerHp.x, points.lowerHp.y);
      } else {
        context.quadraticCurveTo(points.hp.x, points.hp.y, points.ep.x, points.ep.y);
        context.lineTo(points.lowerEp.x, points.lowerEp.y);
        context.quadraticCurveTo(points.lowerHp.x, points.lowerHp.y, points.lowerSp.x, points.lowerSp.y);
      }
      context.closePath();
      context.fill();
    };

    const interpolatePoint = (start: FacePoint, end: FacePoint, t: number) => ({
      x: start.x + ((end.x - start.x) * t),
      y: start.y + ((end.y - start.y) * t),
    });

    const drawCenterPath = (
      points: PreviewBrowControlPoints,
      mode: RecommendedEyebrowRenderMode,
    ) => {
      context.beginPath();
      context.moveTo(points.sp.x, points.sp.y);

      if (mode === 'angular') {
        context.lineTo(points.hp.x, points.hp.y);
        context.lineTo(points.ep.x, points.ep.y);
      } else if (mode === 'round') {
        const firstControl = interpolatePoint(points.sp, points.hp, 0.56);
        const secondControl = interpolatePoint(points.ep, points.hp, 0.56);
        context.bezierCurveTo(firstControl.x, firstControl.y, secondControl.x, secondControl.y, points.ep.x, points.ep.y);
      } else {
        context.quadraticCurveTo(points.hp.x, points.hp.y, points.ep.x, points.ep.y);
      }

      context.stroke();
    };

    const drawGuideLines = (guideLines: PreviewGuideLines | null) => {
      if (!guideLines) return;

      context.beginPath();
      context.moveTo(guideLines.spLine.start.x, guideLines.spLine.start.y);
      context.lineTo(guideLines.spLine.end.x, guideLines.spLine.end.y);
      context.moveTo(guideLines.hpLine.start.x, guideLines.hpLine.start.y);
      context.lineTo(guideLines.hpLine.end.x, guideLines.hpLine.end.y);
      context.moveTo(guideLines.epLine.start.x, guideLines.epLine.start.y);
      context.lineTo(guideLines.epLine.end.x, guideLines.epLine.end.y);
      context.stroke();
    };

    const drawHorizontalGuideLines = (
      leftLines: PreviewGuideLines | null,
      rightLines: PreviewGuideLines | null,
    ) => {
      if (!leftLines || !rightLines) return;

      const browY = (
        leftLines.spLine.end.y
        + leftLines.epLine.end.y
        + rightLines.spLine.end.y
        + rightLines.epLine.end.y
      ) / 4;
      const noseBottomY = (leftLines.spLine.start.y + rightLines.spLine.start.y) / 2;
      const browXs = [
        leftLines.epLine.end.x,
        leftLines.spLine.end.x,
        rightLines.spLine.end.x,
        rightLines.epLine.end.x,
      ];
      const minX = Math.min(...browXs);
      const maxX = Math.max(...browXs);
      const extension = Math.max(24, (maxX - minX) * 0.22);
      const startX = Math.max(0, minX - extension);
      const endX = Math.min(previewDimensions.width, maxX + extension);

      context.beginPath();
      context.moveTo(startX, browY);
      context.lineTo(endX, browY);
      context.moveTo(startX, noseBottomY);
      context.lineTo(endX, noseBottomY);
      context.stroke();
    };

    context.save();
    context.scale(pixelRatio, pixelRatio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = 'rgba(79, 44, 29, 0.92)';
    context.fillStyle = 'rgba(79, 44, 29, 0.18)';
    context.lineWidth = Math.max(2.4, recommendationGeometry.strokeWidth * 2.4);
    context.shadowColor = 'rgba(255, 255, 255, 0.75)';
    context.shadowBlur = 6;

    context.save();
    context.strokeStyle = 'rgba(201, 169, 110, 0.72)';
    context.lineWidth = 1.1;
    context.shadowBlur = 0;
    context.setLineDash?.([4, 3]);
    drawHorizontalGuideLines(leftGuideLines, rightGuideLines);
    drawGuideLines(leftGuideLines);
    drawGuideLines(rightGuideLines);
    context.restore();

    drawFillPath(left, recommendationGeometry.mode);
    drawFillPath(right, recommendationGeometry.mode);
    drawCenterPath(left, recommendationGeometry.mode);
    drawCenterPath(right, recommendationGeometry.mode);
    context.restore();
  }, [alignment.ready, cameraPermission, liveOverlayAnchors, overlayRevision, previewFrameRef, selectedRecommendation, videoRef]);

  return (
    <>
      <div
        ref={previewFrameRef}
        className={cn(
          "relative w-full flex-1 min-h-0 overflow-hidden rounded-3xl border border-main-brown/10 bg-main-brown/5",
          cameraPermission === 'granted' ? "h-full" : "aspect-[9/13]",
          className
        )}
      >
        {cameraPermission !== 'granted' ? (
          <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-6 text-center">
            {PermissionIcon && (
              <PermissionIcon
                size={44}
                className={cn(
                  "mb-5 text-main-brown",
                  cameraPermission === 'pending' ? "animate-spin opacity-60" : "opacity-25"
                )}
              />
            )}
            <div className="w-full max-w-[300px] space-y-4">
              <div className="space-y-2">
                <p className="text-[18px] font-bold leading-tight text-main-brown">{permissionCopy?.title}</p>
                <p className="text-[13px] font-light leading-relaxed text-sub-gray">
                  {permissionCopy?.description}
                </p>
              </div>
              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-2xl bg-main-brown/10 px-4 py-3 text-[13px] font-bold leading-relaxed text-main-brown"
                >
                  {errorMessage}
                </p>
              )}
            </div>
            {cameraPermission === 'idle' && (
              <p className="mt-5 max-w-[260px] text-[12px] font-light leading-relaxed text-sub-gray">
                화면 중앙에 얼굴을 맞추면 실시간 가이드가 표시됩니다.
              </p>
            )}
            {permissionCopy?.guidance && (
              <div className="mt-5 w-full max-w-[310px] space-y-3 rounded-2xl border border-main-brown/10 bg-white p-4 text-left">
                {permissionCopy.guidance.map((guide) => (
                  <div key={guide.title} className="space-y-2">
                    <p className="text-[12px] font-bold text-main-brown">{guide.title}</p>
                    <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-sub-gray">
                      {guide.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            <Controls
              mode="permission"
              cameraPermission={cameraPermission}
              onRequestCameraPermission={onRequestCameraPermission}
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />
            <canvas
              ref={arOverlayCanvasRef}
              data-testid="camera-ar-overlay"
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 z-[5] h-full w-full scale-x-[-1] object-cover transition-opacity duration-150",
                canShowLiveOverlay ? "opacity-100" : "opacity-0"
              )}
            />
            {showFaceGuidance && (
              <FaceGuidance
                alignment={alignment}
                trackerStatus={trackerStatus}
                detectedFaceShape={detectedFaceShape}
                ipdGuidance={ipdGuidance}
                frameGuidance={frameGuidance}
                mode={guidanceMode}
              />
            )}
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};
