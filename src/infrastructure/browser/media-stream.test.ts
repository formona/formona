import { describe, expect, it, vi } from 'vitest';

import { FRONT_CAMERA_FALLBACK_CONSTRAINTS } from '../../constants';
import {
  getCameraDeviceInfo,
  openFrontCameraStream,
  replaceMediaStream,
  stopMediaStream,
} from './media-stream';

describe('mobile front camera stream helpers', () => {
  it('falls back to simpler front-camera constraints when portrait constraints fail', async () => {
    const fallbackStream = new MediaStream();
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockRejectedValueOnce(new DOMException('Too constrained', 'OverconstrainedError'))
      .mockResolvedValueOnce(fallbackStream);

    await expect(openFrontCameraStream()).resolves.toBe(fallbackStream);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, FRONT_CAMERA_FALLBACK_CONSTRAINTS[0]);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, FRONT_CAMERA_FALLBACK_CONSTRAINTS[1]);
  });

  it('stops only active tracks when replacing camera streams', () => {
    const activeTrack = { readyState: 'live' as const, stop: vi.fn() };
    const endedTrack = { readyState: 'ended' as const, stop: vi.fn() };
    const currentStream = { getTracks: () => [activeTrack, endedTrack] };
    const nextStream = { getTracks: () => [] };

    expect(replaceMediaStream(currentStream, nextStream)).toBe(nextStream);

    expect(activeTrack.stop).toHaveBeenCalledOnce();
    expect(endedTrack.stop).not.toHaveBeenCalled();
  });

  it('does not stop a stream when replacing it with itself', () => {
    const activeTrack = { readyState: 'live' as const, stop: vi.fn() };
    const stream = { getTracks: () => [activeTrack] };

    expect(replaceMediaStream(stream, stream)).toBe(stream);

    expect(activeTrack.stop).not.toHaveBeenCalled();
  });

  it('tolerates empty streams and null stream shutdown requests', () => {
    expect(() => stopMediaStream(null)).not.toThrow();
    expect(() => stopMediaStream(undefined)).not.toThrow();
  });

  it('stops fallback attempts immediately when camera permission is denied', async () => {
    const deniedError = new DOMException('denied', 'NotAllowedError');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(deniedError);

    await expect(openFrontCameraStream()).rejects.toBe(deniedError);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('throws the final device startup error when all front-camera fallbacks fail', async () => {
    const firstError = new DOMException('too strict', 'OverconstrainedError');
    const secondError = new DOMException('no user camera', 'NotFoundError');
    const finalError = new DOMException('camera busy', 'NotReadableError');
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError)
      .mockRejectedValueOnce(finalError);

    await expect(openFrontCameraStream()).rejects.toBe(finalError);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(FRONT_CAMERA_FALLBACK_CONSTRAINTS.length);
  });

  it('surfaces active video track metadata for front-camera UI state', () => {
    const stream = new MediaStream();

    expect(getCameraDeviceInfo(stream)).toEqual({
      label: 'Mock front camera',
      facingMode: 'user',
      width: 1080,
      height: 1920,
    });
  });

  it('returns null without a video track and uses fallback labels without settings', () => {
    const emptyStream = { getVideoTracks: () => [] } as unknown as MediaStream;
    const anonymousStream = {
      getVideoTracks: () => [{
        label: '',
        getSettings: undefined,
      }],
    } as unknown as MediaStream;

    expect(getCameraDeviceInfo(null)).toBeNull();
    expect(getCameraDeviceInfo(undefined)).toBeNull();
    expect(getCameraDeviceInfo(emptyStream)).toBeNull();
    expect(getCameraDeviceInfo(anonymousStream)).toEqual({ label: 'Front camera' });
  });
});
