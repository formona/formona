import { describe, expect, it } from 'vitest';

import { buildRecommendedEyebrowGeometry } from './eyebrow-geometry';
import type { EyebrowOverlayAnchors, EyebrowStyle } from './types';

const anchors: EyebrowOverlayAnchors = {
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

const style = (id: string): EyebrowStyle => ({
  id,
  name: id,
  description: '',
  path: 'M10,20 Q50,10 90,20',
});

describe('buildRecommendedEyebrowGeometry', () => {
  it('generates drawable paths and fill outlines from recommendation style and landmark anchors', () => {
    const geometry = buildRecommendedEyebrowGeometry(style('natural_arch'), anchors);

    expect(geometry).toMatchObject({
      viewBox: '0 0 100 100',
      styleId: 'natural_arch',
      strokeWidth: expect.any(Number),
    });
    expect(geometry?.left).toMatch(/^M \d+\.\d{2} \d+\.\d{2} Q \d+\.\d{2} \d+\.\d{2} \d+\.\d{2} \d+\.\d{2}$/);
    expect(geometry?.right).toContain('Q');
    expect(geometry?.leftFill).toContain('Z');
    expect(geometry?.rightFill).toContain('Z');
  });

  it('varies the drawable geometry for angular and straight recommendations while preserving anchors', () => {
    const angular = buildRecommendedEyebrowGeometry(style('angular_arch'), anchors);
    const straight = buildRecommendedEyebrowGeometry(style('straight_horizontal'), anchors);

    expect(angular?.left).toContain(' L ');
    expect(straight?.left).toContain(' Q ');
    expect(angular?.left).not.toBe(straight?.left);
    expect(angular?.left.startsWith('M 44.00')).toBe(true);
    expect(angular?.right.startsWith('M 56.00')).toBe(true);
  });

  it('returns null when selected style or mapped anchors are unavailable', () => {
    expect(buildRecommendedEyebrowGeometry(null, anchors)).toBeNull();
    expect(buildRecommendedEyebrowGeometry(style('natural_arch'), null)).toBeNull();
  });
});
