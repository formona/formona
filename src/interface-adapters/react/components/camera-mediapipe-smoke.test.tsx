import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FRONT_CAMERA_CONSTRAINTS } from '../../../constants';
import type { FacePoint } from '../../../domain/types';
import { CapturePage } from './CapturePage';

const mediaPipeMock = vi.hoisted(() => ({
  detectForVideo: vi.fn(),
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: {
    createFromOptions: mediaPipeMock.createFromOptions,
  },
  FilesetResolver: {
    forVisionTasks: mediaPipeMock.forVisionTasks,
  },
}));

const point = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const makeFaceMeshLandmarks = () => {
  const landmarks = Array.from({ length: 468 }, () => point(0, 0));

  Object.assign(landmarks, {
    10: point(0.5, 0.14),
    33: point(0.34, 0.43),
    55: point(0.42, 0.34),
    65: point(0.36, 0.31),
    103: point(0.3, 0.28),
    107: point(0.27, 0.36),
    133: point(0.42, 0.43),
    145: point(0.38, 0.45),
    152: point(0.5, 0.82),
    159: point(0.38, 0.41),
    172: point(0.36, 0.72),
    234: point(0.23, 0.52),
    263: point(0.66, 0.43),
    285: point(0.58, 0.34),
    295: point(0.64, 0.31),
    332: point(0.7, 0.28),
    336: point(0.73, 0.36),
    362: point(0.58, 0.43),
    374: point(0.62, 0.45),
    386: point(0.62, 0.41),
    397: point(0.64, 0.72),
    454: point(0.77, 0.52),
  });

  return landmarks;
};

const originalReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');
const originalCurrentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
const originalVideoWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth');
const originalVideoHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');

describe('real camera and MediaPipe initialization smoke flow', () => {
  beforeEach(() => {
    mediaPipeMock.detectForVideo.mockReturnValue({
      faceLandmarks: [makeFaceMeshLandmarks()],
    });
    mediaPipeMock.createFromOptions.mockResolvedValue({
      detectForVideo: mediaPipeMock.detectForVideo,
    });
    mediaPipeMock.forVisionTasks.mockResolvedValue({ wasm: 'mock-vision-fileset' });

    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(new MediaStream());
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle: number) => {
      window.clearTimeout(handle);
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get: () => 1,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 1080,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 1920,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalReadyState) {
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', originalReadyState);
    }
    if (originalCurrentTime) {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', originalCurrentTime);
    }
    if (originalVideoWidth) {
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', originalVideoWidth);
    }
    if (originalVideoHeight) {
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', originalVideoHeight);
    }
  });

  it('starts the front camera and reaches FaceMesh-ready analysis without real hardware', async () => {
    const user = userEvent.setup();

    render(<CapturePage ipdMm={63} onAnalysisComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '카메라 허용' }));

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(FRONT_CAMERA_CONSTRAINTS);
    });
    await waitFor(() => {
      expect(mediaPipeMock.forVisionTasks).toHaveBeenCalledOnce();
      expect(mediaPipeMock.createFromOptions).toHaveBeenCalled();
      expect(mediaPipeMock.detectForVideo).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('FaceMesh 추적 중')).toBeInTheDocument();
      expect(screen.getByText('계란형 감지')).toBeInTheDocument();
      expect(screen.getByText('촬영 가능')).toBeInTheDocument();
      expect(screen.getByText('정면 위치가 안정적입니다')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '촬영하고 추천 보기' })).toBeEnabled();
    });
  });

  it('keeps capture blocked and shows guidance when MediaPipe returns no face landmarks', async () => {
    const user = userEvent.setup();
    mediaPipeMock.detectForVideo.mockReturnValue({
      faceLandmarks: [],
    });

    render(<CapturePage ipdMm={63} onAnalysisComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '카메라 허용' }));

    await waitFor(() => {
      expect(mediaPipeMock.detectForVideo).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('AR 캡처 대기: 얼굴 미감지')).toBeInTheDocument();
      expect(screen.getByText('얼굴을 찾고 있어요')).toBeInTheDocument();
      expect(screen.getByText('얼굴 전체가 가이드 안에 들어오도록 카메라를 정면으로 맞춰주세요.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '얼굴 정렬 필요' })).toBeDisabled();
    });
  });
});
