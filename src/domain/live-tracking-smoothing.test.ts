import { describe, expect, it } from 'vitest';
import { createLiveFaceTrackingSmoother } from './live-tracking-smoothing';
import type { EyebrowOverlayAnchors, FacePoint } from './types';

const makeLandmarks = (offset = 0): FacePoint[] => [
  { x: 0.4 + offset, y: 0.42 },
  { x: 0.5 + offset, y: 0.4 },
  { x: 0.6 + offset, y: 0.43 },
];

const makeOverlayAnchors = (offset = 0): EyebrowOverlayAnchors => ({
  left: {
    sp: { x: 0.36 + offset, y: 0.32 },
    hp: { x: 0.42 + offset, y: 0.28, source: 'iris' },
    ep: { x: 0.48 + offset, y: 0.33 },
    confidence: 1,
    guides: {
      spLine: {
        start: { x: 0.36 + offset, y: 0.52 },
        end: { x: 0.36 + offset, y: 0.32 },
      },
      hpLine: {
        start: { x: 0.42 + offset, y: 0.43, source: 'iris' },
        end: { x: 0.42 + offset, y: 0.28, source: 'iris' },
      },
      epLine: {
        start: { x: 0.5 + offset, y: 0.66 },
        end: { x: 0.48 + offset, y: 0.33 },
      },
      goldenRatioTarget: { x: 0.44 + offset, y: 0.33 },
    },
  },
  right: {
    sp: { x: 0.64 + offset, y: 0.32 },
    hp: { x: 0.58 + offset, y: 0.28, source: 'iris' },
    ep: { x: 0.52 + offset, y: 0.33 },
    confidence: 1,
    guides: {
      spLine: {
        start: { x: 0.64 + offset, y: 0.52 },
        end: { x: 0.64 + offset, y: 0.32 },
      },
      hpLine: {
        start: { x: 0.58 + offset, y: 0.43, source: 'iris' },
        end: { x: 0.58 + offset, y: 0.28, source: 'iris' },
      },
      epLine: {
        start: { x: 0.5 + offset, y: 0.66 },
        end: { x: 0.52 + offset, y: 0.33 },
      },
      goldenRatioTarget: { x: 0.56 + offset, y: 0.33 },
    },
  },
  confidence: 1,
  transform: {
    origin: { x: 0.5 + offset, y: 0.5 },
    scale: 0.36,
    rotationRadians: 0.02 + offset,
    rotationDegrees: (0.02 + offset) * (180 / Math.PI),
    confidence: 1,
  },
});

describe('createLiveFaceTrackingSmoother', () => {
  it('interpolates small landmark and eyebrow overlay movement between MediaPipe frames', () => {
    const smoother = createLiveFaceTrackingSmoother({ smoothingAlpha: 0.4, fastMovementThreshold: 1 });

    const first = smoother.filter({
      landmarks: makeLandmarks(0),
      overlayAnchors: makeOverlayAnchors(0),
    }, 0);
    const second = smoother.filter({
      landmarks: makeLandmarks(0.01),
      overlayAnchors: makeOverlayAnchors(0.01),
    }, 33);

    expect(first?.landmarks[0].x).toBe(0.4);
    expect(second?.landmarks[0].x).toBeCloseTo(0.404, 5);
    expect(second?.overlayAnchors?.left.sp.x).toBeCloseTo(0.364, 5);
    expect(second?.overlayAnchors?.transform.origin.x).toBeCloseTo(0.504, 5);
    expect(second?.overlayAnchors?.left.hp.source).toBe('iris');
    expect(second?.overlayAnchors?.left.guides?.epLine.start.x).toBeCloseTo(0.504, 5);
    expect(second?.overlayAnchors?.left.guides?.epLine.start.y).toBeCloseTo(0.66, 5);
    expect(second?.overlayAnchors?.left.guides?.hpLine.start.source).toBe('iris');
  });

  it('uses fast interpolation for intentional head movement and resets on large jumps', () => {
    const smoother = createLiveFaceTrackingSmoother({
      smoothingAlpha: 0.2,
      fastAlpha: 0.75,
      fastMovementThreshold: 0.015,
      resetMovementThreshold: 0.08,
    });

    smoother.filter({ landmarks: makeLandmarks(0), overlayAnchors: makeOverlayAnchors(0) }, 0);
    const moving = smoother.filter({ landmarks: makeLandmarks(0.02), overlayAnchors: makeOverlayAnchors(0.02) }, 33);
    const jumped = smoother.filter({ landmarks: makeLandmarks(0.12), overlayAnchors: makeOverlayAnchors(0.12) }, 66);

    expect(moving?.landmarks[0].x).toBeCloseTo(0.415, 5);
    expect(jumped?.landmarks[0].x).toBeCloseTo(0.52, 5);
  });

  it('briefly holds landmarks but drops eyebrow overlay anchors through a short detection dropout', () => {
    const smoother = createLiveFaceTrackingSmoother({ maxHoldMs: 120 });

    const first = smoother.filter({
      landmarks: makeLandmarks(0),
      overlayAnchors: makeOverlayAnchors(0),
    }, 1000);
    const held = smoother.filter(null, 1080);
    const expired = smoother.filter(null, 1160);

    expect(held?.landmarks).toEqual(first?.landmarks);
    expect(held?.overlayAnchors).toBeNull();
    expect(expired).toBeNull();
  });
});
