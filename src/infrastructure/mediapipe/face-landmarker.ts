import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

import {
  MEDIAPIPE_FACE_LANDMARKER_MODEL_URL,
  MEDIAPIPE_VISION_WASM_URL,
} from '../../constants';
import type { FacePoint } from '../../domain/types';

export interface FaceLandmarkerPort {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { faceLandmarks: FacePoint[][] };
}

let faceLandmarkerPromise: Promise<FaceLandmarkerPort> | null = null;

type ConsoleMethod = (...args: unknown[]) => void;
type MediaPipeLogGlobal = typeof globalThis & {
  __formonaMediaPipeLogFilter?: {
    originalError: ConsoleMethod;
    originalWarn: ConsoleMethod;
  };
  custom_dbg?: ConsoleMethod;
};

const KNOWN_MEDIAPIPE_NATIVE_LOG_PATTERNS = [
  'FaceBlendshapesGraph acceleration to xnnpack',
  'Feedback manager requires a model with a single signature inference',
  'OpenGL error checking is disabled',
  'Created TensorFlow Lite XNNPACK delegate for CPU',
];

const toLogMessage = (args: unknown[]) => args.map((arg) => String(arg)).join(' ');

const isKnownMediaPipeNativeLog = (message: string) => (
  KNOWN_MEDIAPIPE_NATIVE_LOG_PATTERNS.some((pattern) => message.includes(pattern))
);

const createKnownMediaPipeLogFilter = (originalLog: ConsoleMethod): ConsoleMethod => (
  (...args: unknown[]) => {
    if (isKnownMediaPipeNativeLog(toLogMessage(args))) return;

    originalLog(...args);
  }
);

const installKnownMediaPipeNativeLogFilter = () => {
  const mediaPipeGlobal = globalThis as MediaPipeLogGlobal;
  if (mediaPipeGlobal.__formonaMediaPipeLogFilter) return;

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const filteredWarn = createKnownMediaPipeLogFilter(originalWarn);
  const filteredError = createKnownMediaPipeLogFilter(originalError);

  console.warn = filteredWarn;
  console.error = filteredError;
  mediaPipeGlobal.custom_dbg = filteredWarn;
  mediaPipeGlobal.__formonaMediaPipeLogFilter = {
    originalError,
    originalWarn,
  };
};

const suppressKnownMediaPipeNativeLogs = <TResult>(operation: () => TResult): TResult => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const mediaPipeGlobal = globalThis as MediaPipeLogGlobal;
  const originalCustomDbg = mediaPipeGlobal.custom_dbg;
  const filteredWarn = createKnownMediaPipeLogFilter(originalWarn);
  const filteredError = createKnownMediaPipeLogFilter(originalError);
  const restoreLogs = () => {
    console.warn = originalWarn;
    console.error = originalError;
    mediaPipeGlobal.custom_dbg = originalCustomDbg;
  };

  console.warn = filteredWarn;
  console.error = filteredError;
  mediaPipeGlobal.custom_dbg = filteredWarn;

  try {
    const result = operation();
    const maybePromise = result as PromiseLike<unknown>;

    if (maybePromise && typeof maybePromise.then === 'function') {
      return Promise.resolve(result).finally(restoreLogs) as TResult;
    }

    restoreLogs();
    return result;
  } catch (error) {
    restoreLogs();
    throw error;
  }
};

const wrapFaceLandmarker = (landmarker: FaceLandmarkerPort): FaceLandmarkerPort => ({
  detectForVideo: (video, timestampMs) => (
    suppressKnownMediaPipeNativeLogs(() => landmarker.detectForVideo(video, timestampMs))
  ),
});

export const getFaceLandmarker = async (): Promise<FaceLandmarkerPort> => {
  if (!faceLandmarkerPromise) {
    installKnownMediaPipeNativeLogFilter();

    faceLandmarkerPromise = suppressKnownMediaPipeNativeLogs(() => (
      FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_URL)
    ))
      .then(async (vision) => {
        const landmarker = await suppressKnownMediaPipeNativeLogs(() => FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO' as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }));

        return wrapFaceLandmarker(landmarker);
      })
      .catch((error) => {
        faceLandmarkerPromise = null;
        throw error;
      });
  }

  return faceLandmarkerPromise;
};
