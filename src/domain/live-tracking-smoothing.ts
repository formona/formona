import type {
  EyebrowOverlayAnchorPoint,
  EyebrowOverlayAnchors,
  EyebrowOverlaySideAnchors,
  EyebrowOverlayTransform,
  FacePoint,
} from './types';

export interface LiveFaceTrackingSmootherOptions {
  smoothingAlpha?: number;
  fastAlpha?: number;
  fastMovementThreshold?: number;
  resetMovementThreshold?: number;
  maxSampleGapMs?: number;
  maxHoldMs?: number;
}

interface LiveFaceTrackingSmootherState {
  landmarks: FacePoint[];
  overlayAnchors: EyebrowOverlayAnchors | null;
  timestampMs: number;
}

export interface LiveFaceTrackingSample {
  landmarks: FacePoint[];
  overlayAnchors: EyebrowOverlayAnchors | null;
}

const DEFAULT_OPTIONS = {
  smoothingAlpha: 0.42,
  fastAlpha: 0.72,
  fastMovementThreshold: 0.018,
  resetMovementThreshold: 0.12,
  maxSampleGapMs: 250,
  maxHoldMs: 120,
} satisfies Required<LiveFaceTrackingSmootherOptions>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const smoothNumber = (previous: number, next: number, alpha: number) => (
  previous + ((next - previous) * alpha)
);

const shortestAngleDelta = (previousRadians: number, nextRadians: number) => {
  const fullTurn = Math.PI * 2;
  return ((((nextRadians - previousRadians) + Math.PI) % fullTurn) + fullTurn) % fullTurn - Math.PI;
};

const clonePoint = <T extends FacePoint>(point: T): T => ({ ...point });

const smoothPoint = <T extends FacePoint>(previous: T, next: T, alpha: number): T => ({
  ...next,
  x: smoothNumber(previous.x, next.x, alpha),
  y: smoothNumber(previous.y, next.y, alpha),
  z: typeof next.z === 'number' && typeof previous.z === 'number'
    ? smoothNumber(previous.z, next.z, alpha)
    : next.z,
});

const pointDistance = (previous: FacePoint, next: FacePoint) => (
  Math.hypot(next.x - previous.x, next.y - previous.y)
);

const maxLandmarkMovement = (previous: FacePoint[], next: FacePoint[]) => {
  if (previous.length !== next.length || next.length === 0) return Number.POSITIVE_INFINITY;

  return next.reduce((maxMovement, point, index) => (
    Math.max(maxMovement, pointDistance(previous[index], point))
  ), 0);
};

const smoothLandmarks = (previous: FacePoint[], next: FacePoint[], alpha: number) => {
  if (previous.length !== next.length) return next.map(clonePoint);

  return next.map((point, index) => smoothPoint(previous[index], point, alpha));
};

const smoothAnchorPoint = (
  previous: EyebrowOverlayAnchorPoint,
  next: EyebrowOverlayAnchorPoint,
  alpha: number,
): EyebrowOverlayAnchorPoint => smoothPoint(previous, next, alpha);

const smoothSideAnchors = (
  previous: EyebrowOverlaySideAnchors,
  next: EyebrowOverlaySideAnchors,
  alpha: number,
): EyebrowOverlaySideAnchors => ({
  sp: smoothAnchorPoint(previous.sp, next.sp, alpha),
  hp: smoothAnchorPoint(previous.hp, next.hp, alpha),
  ep: smoothAnchorPoint(previous.ep, next.ep, alpha),
  confidence: Math.min(previous.confidence, next.confidence),
});

const smoothTransform = (
  previous: EyebrowOverlayTransform,
  next: EyebrowOverlayTransform,
  alpha: number,
): EyebrowOverlayTransform => {
  const rotationRadians = previous.rotationRadians + (shortestAngleDelta(previous.rotationRadians, next.rotationRadians) * alpha);

  return {
    origin: smoothPoint(previous.origin, next.origin, alpha),
    scale: smoothNumber(previous.scale, next.scale, alpha),
    rotationRadians,
    rotationDegrees: rotationRadians * (180 / Math.PI),
    confidence: Math.min(previous.confidence, next.confidence),
  };
};

const smoothOverlayAnchors = (
  previous: EyebrowOverlayAnchors | null,
  next: EyebrowOverlayAnchors | null,
  alpha: number,
) => {
  if (!previous || !next) return next;

  return {
    left: smoothSideAnchors(previous.left, next.left, alpha),
    right: smoothSideAnchors(previous.right, next.right, alpha),
    confidence: Math.min(previous.confidence, next.confidence),
    transform: smoothTransform(previous.transform, next.transform, alpha),
  };
};

const cloneOverlayAnchors = (anchors: EyebrowOverlayAnchors | null) => (
  anchors
    ? {
      left: {
        sp: clonePoint(anchors.left.sp),
        hp: clonePoint(anchors.left.hp),
        ep: clonePoint(anchors.left.ep),
        confidence: anchors.left.confidence,
      },
      right: {
        sp: clonePoint(anchors.right.sp),
        hp: clonePoint(anchors.right.hp),
        ep: clonePoint(anchors.right.ep),
        confidence: anchors.right.confidence,
      },
      confidence: anchors.confidence,
      transform: {
        origin: clonePoint(anchors.transform.origin),
        scale: anchors.transform.scale,
        rotationRadians: anchors.transform.rotationRadians,
        rotationDegrees: anchors.transform.rotationDegrees,
        confidence: anchors.transform.confidence,
      },
    }
    : null
);

export const createLiveFaceTrackingSmoother = (
  options: LiveFaceTrackingSmootherOptions = {},
) => {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    smoothingAlpha: clamp(options.smoothingAlpha ?? DEFAULT_OPTIONS.smoothingAlpha, 0, 1),
    fastAlpha: clamp(options.fastAlpha ?? DEFAULT_OPTIONS.fastAlpha, 0, 1),
  };
  let state: LiveFaceTrackingSmootherState | null = null;

  const reset = () => {
    state = null;
  };

  const filter = (
    sample: LiveFaceTrackingSample | null,
    timestampMs: number,
  ): LiveFaceTrackingSample | null => {
    if (!sample || sample.landmarks.length === 0) {
      if (!state) return null;

      const heldForMs = timestampMs - state.timestampMs;
      if (heldForMs < 0 || heldForMs > config.maxHoldMs) return null;

      return {
        landmarks: state.landmarks.map(clonePoint),
        overlayAnchors: null,
      };
    }

    if (!state) {
      state = {
        landmarks: sample.landmarks.map(clonePoint),
        overlayAnchors: cloneOverlayAnchors(sample.overlayAnchors),
        timestampMs,
      };

      return {
        landmarks: state.landmarks.map(clonePoint),
        overlayAnchors: cloneOverlayAnchors(state.overlayAnchors),
      };
    }

    const movement = maxLandmarkMovement(state.landmarks, sample.landmarks);
    const shouldReset = timestampMs - state.timestampMs > config.maxSampleGapMs
      || movement > config.resetMovementThreshold;

    if (shouldReset) {
      state = {
        landmarks: sample.landmarks.map(clonePoint),
        overlayAnchors: cloneOverlayAnchors(sample.overlayAnchors),
        timestampMs,
      };

      return {
        landmarks: state.landmarks.map(clonePoint),
        overlayAnchors: cloneOverlayAnchors(state.overlayAnchors),
      };
    }

    const previousState = state;
    const alpha = movement > config.fastMovementThreshold ? config.fastAlpha : config.smoothingAlpha;
    state = {
      landmarks: smoothLandmarks(previousState.landmarks, sample.landmarks, alpha),
      overlayAnchors: smoothOverlayAnchors(previousState.overlayAnchors, sample.overlayAnchors, alpha),
      timestampMs,
    };

    return {
      landmarks: state.landmarks.map(clonePoint),
      overlayAnchors: cloneOverlayAnchors(state.overlayAnchors),
    };
  };

  return {
    filter,
    reset,
  };
};
