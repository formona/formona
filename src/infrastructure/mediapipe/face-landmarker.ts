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

export const getFaceLandmarker = async (): Promise<FaceLandmarkerPort> => {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = FilesetResolver
      .forVisionTasks(MEDIAPIPE_VISION_WASM_URL)
      .then(async (vision) => {
        const baseOptions = {
          modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_URL,
        };
        const sharedOptions = {
          runningMode: 'VIDEO' as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        };

        try {
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              ...baseOptions,
              delegate: 'GPU',
            },
            ...sharedOptions,
          });
        } catch {
          return FaceLandmarker.createFromOptions(vision, {
            baseOptions,
            ...sharedOptions,
          });
        }
      })
      .catch((error) => {
        faceLandmarkerPromise = null;
        throw error;
      });
  }

  return faceLandmarkerPromise;
};
