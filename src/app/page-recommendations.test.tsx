import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from './page';
import { APP_TIMING_MS, FACE_SHAPE_RESULT_COPY } from '../constants';
import {
  FaceShape,
  type EyebrowOverlayAnchors,
  type FaceAlignment,
  type FaceAnalysisResult,
} from '../domain/types';

const analysisMock = vi.hoisted(() => ({
  current: null as FaceAnalysisResult | null,
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  const ignoredMotionProps = new Set([
    'animate',
    'exit',
    'initial',
    'layout',
    'transition',
    'whileHover',
    'whileTap',
  ]);
  const createMotionElement = (tagName: string) => ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, ...props }, ref) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !ignoredMotionProps.has(key)),
      );

      return ReactModule.createElement(tagName, { ...domProps, ref }, children as React.ReactNode);
    },
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: new Proxy({}, {
      get: (_, tagName: string) => createMotionElement(tagName),
    }),
  };
});

vi.mock('../interface-adapters/react/components/CapturePage', () => ({
  CapturePage: ({
    onAnalysisComplete,
  }: {
    onAnalysisComplete: (imageDataUrl: string, analysis: FaceAnalysisResult) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (!analysisMock.current) throw new Error('Missing mocked analysis');
        onAnalysisComplete('data:image/jpeg;base64,monabrow', analysisMock.current);
      }}
    >
      Mock capture complete
    </button>
  ),
}));

const readyAlignment: FaceAlignment = {
  detected: true,
  centered: true,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  guidance: '정면 위치가 안정적입니다',
  confidence: 0.9,
  ready: true,
};

const mockOverlayAnchors: EyebrowOverlayAnchors = {
  left: {
    sp: { x: 0.44, y: 0.35 },
    hp: { x: 0.38, y: 0.31, source: 'iris' },
    ep: { x: 0.28, y: 0.35 },
    confidence: 1,
  },
  right: {
    sp: { x: 0.56, y: 0.35 },
    hp: { x: 0.62, y: 0.31, source: 'iris' },
    ep: { x: 0.72, y: 0.35 },
    confidence: 1,
  },
  confidence: 1,
  transform: {
    origin: { x: 0.5, y: 0.45 },
    scale: 0.24,
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
  },
};

const makeAnalysis = (faceShape: FaceShape): FaceAnalysisResult => ({
  faceShape,
  faceDimensions: {
    faceWidth: 0.58,
    faceHeight: 0.72,
    jawWidth: 0.38,
    cheekWidth: 0.54,
    foreheadWidth: 0.58,
  },
  normalizedGeometry: {
    faceWidth: 0.58,
    faceHeight: 0.72,
    jawWidth: 0.38,
    cheekWidth: 0.54,
    foreheadWidth: 0.58,
    heightToWidth: 0.72 / 0.58,
    jawToCheek: 0.38 / 0.54,
    foreheadToCheek: 0.58 / 0.54,
    cheekToFaceWidth: 0.54 / 0.58,
  },
  proportionMetrics: {
    faceHeightToWidth: 0.72 / 0.58,
    faceWidthToHeight: 0.58 / 0.72,
    foreheadToFaceWidth: 0.58 / 0.58,
    cheekToFaceWidth: 0.54 / 0.58,
    jawToFaceWidth: 0.38 / 0.58,
    foreheadToCheek: 0.58 / 0.54,
    jawToCheek: 0.38 / 0.54,
    averageBrowToEye: 0.12,
    browToEyeHeight: 3,
    browToFaceHeight: 0.12 / 0.72,
    browGapToFaceWidth: 0.28,
    browLengthToFaceWidth: 0.24,
    archHeightToFaceHeight: 0.04,
    eyeHeightToFaceHeight: 0.05,
    eyeWidthToFaceWidth: 0.15,
    interEyeToFaceWidth: 0.28,
    confidence: 1,
  },
  faceCoordinateSpace: {
    origin: { x: 0.5, y: 0.43 },
    scale: 0.2,
    xAxis: { x: 1, y: 0 },
    yAxis: { x: 0, y: 1 },
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
    landmarks: Array.from({ length: 478 }, () => ({ x: 0, y: 0 })),
  },
  measurements: [
    { label: 'SP', value: '18.2mm' },
    { label: 'HP', value: '33.4mm' },
    { label: 'EP', value: '49.1mm' },
    { label: '전체 길이', value: '50.2mm' },
    { label: '두께', value: '6.1mm' },
    { label: '아치 높이', value: '7.3mm' },
    { label: '미간 간격', value: '21.0mm' },
  ],
  metrics: {
    sp: 18.2,
    hp: 33.4,
    ep: 49.1,
    totalLength: 50.2,
    thickness: 6.1,
    archHeight: 7.3,
    gap: 21,
  },
  eyebrowPosition: {
    left: {
      browHeight: 17.5,
      length: 50.1,
      archHeight: 7.1,
      archLocation: 0.48,
      startToPupil: 18.3,
      archToPupil: 33.2,
      endToPupil: 49.4,
    },
    right: {
      browHeight: 17.1,
      length: 50.3,
      archHeight: 7.5,
      archLocation: 0.5,
      startToPupil: 18.1,
      archToPupil: 33.6,
      endToPupil: 48.8,
    },
    browHeight: 17.3,
    browSpacing: 21,
    archHeight: 7.3,
    archLocation: 0.49,
    leftRightSymmetry: 98.6,
    heightAsymmetry: 0.02,
    lengthAsymmetry: 0.004,
    archLocationAsymmetry: 0.02,
    confidence: 1,
  },
  eyeGeometry: {
    left: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    right: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    eyeWidth: 21,
    eyeHeight: 18.7,
    eyeTiltDegrees: 0,
    interEyeSpacing: 42,
    confidence: 1,
  },
  ipdMm: 63,
  pupilIpd: {
    leftPupil: { x: 0.4, y: 0.43 },
    rightPupil: { x: 0.6, y: 0.43 },
    leftPupilPx: { x: 432, y: 825.6 },
    rightPupilPx: { x: 648, y: 825.6 },
    ipdPx: 216,
    normalizedIpd: 0.2,
    source: 'iris',
    confidence: 1,
  },
  pxToMmScale: 63 / 216,
  alignment: readyAlignment,
  overlayAnchors: mockOverlayAnchors,
  overlay: {
    left: 'M10,20 Q50,10 90,20',
    right: 'M10,20 Q50,10 90,20',
    viewBox: '0 0 100 100',
  },
});

describe('HomePage recommendation routing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    analysisMock.current = makeAnalysis(FaceShape.HEART);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the detected classifier face shape into eyebrow recommendations', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));

    expect(screen.getByRole('heading', { name: FACE_SHAPE_RESULT_COPY[FaceShape.HEART].title })).toBeInTheDocument();
    expect(screen.getAllByText(FaceShape.HEART).length).toBeGreaterThan(0);
    expect(screen.getAllByText('직선 수평형').length).toBeGreaterThan(0);
    expect(screen.queryByText('자연 아치형')).not.toBeInTheDocument();
  });

  it('shows an explicit recommendation error instead of fallback styles when metrics are invalid', async () => {
    analysisMock.current = {
      ...makeAnalysis(FaceShape.HEART),
      metrics: {
        ...makeAnalysis(FaceShape.HEART).metrics,
        totalLength: Number.NaN,
      },
    };

    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));

    expect(screen.getByText('Recommendation Error')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '눈썹 측정값을 다시 확인해야 해요' })).toBeInTheDocument();
    expect(screen.getByText(/임의 추천을 표시하지 않았습니다/)).toBeInTheDocument();
    expect(screen.queryByText('직선 수평형')).not.toBeInTheDocument();
    expect(screen.queryByText('자연 아치형')).not.toBeInTheDocument();
  });
});
