import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, vi } from 'vitest';

const originalIsSecureContext = window.isSecureContext;

class MockMediaStreamTrack {
  readonly kind = 'video';
  readonly label = 'Mock front camera';
  readonly id = 'mock-video-track';
  readyState: MediaStreamTrackState = 'live';

  stop() {
    this.readyState = 'ended';
  }

  getSettings() {
    return {
      facingMode: 'user',
      width: 1080,
      height: 1920,
    };
  }
}

class MockMediaStream {
  private readonly tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks;
  }
}

Object.defineProperty(window, 'isSecureContext', {
  configurable: true,
  value: true,
});

Object.defineProperty(globalThis, 'MediaStream', {
  configurable: true,
  value: MockMediaStream,
});

Object.defineProperty(globalThis, 'MediaStreamTrack', {
  configurable: true,
  value: MockMediaStreamTrack,
});

Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: {
    getUserMedia: vi.fn(async () => new MockMediaStream()),
  },
});

HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
HTMLMediaElement.prototype.pause = vi.fn();

const mockCanvasContext = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  lineCap: 'round',
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext as unknown as CanvasRenderingContext2D);
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mock-canvas');

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

afterAll(() => {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: originalIsSecureContext,
  });
});
