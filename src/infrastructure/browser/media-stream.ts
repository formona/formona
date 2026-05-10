import { FRONT_CAMERA_FALLBACK_CONSTRAINTS } from '../../constants';

type StoppableTrack = Pick<MediaStreamTrack, 'readyState' | 'stop'>;

type StoppableStream = {
  getTracks: () => StoppableTrack[];
};

export interface CameraDeviceInfo {
  label: string;
  facingMode?: string;
  width?: number;
  height?: number;
}

export const stopMediaStream = (stream: StoppableStream | null | undefined) => {
  stream?.getTracks().forEach((track) => {
    if (track.readyState !== 'ended') track.stop();
  });
};

export const replaceMediaStream = <TStream extends StoppableStream>(
  currentStream: StoppableStream | null | undefined,
  nextStream: TStream
) => {
  if (currentStream !== nextStream) {
    stopMediaStream(currentStream);
  }

  return nextStream;
};

const isPermissionDeniedError = (error: unknown) => {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
};

export const openFrontCameraStream = async () => {
  let lastError: unknown = null;

  for (const constraints of FRONT_CAMERA_FALLBACK_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if (isPermissionDeniedError(error)) throw error;
    }
  }

  throw lastError;
};

export const getCameraDeviceInfo = (stream: MediaStream | null | undefined): CameraDeviceInfo | null => {
  const [videoTrack] = stream?.getVideoTracks() ?? [];
  if (!videoTrack) return null;

  const settings = videoTrack.getSettings?.() ?? {};

  return {
    label: videoTrack.label || 'Front camera',
    facingMode: settings.facingMode,
    width: settings.width,
    height: settings.height,
  };
};
