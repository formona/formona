import { describe, expect, it } from 'vitest';

import {
  buildPreviewCoordinateMapping,
  mapEyebrowOverlayAnchorsToPreviewPixels,
  mapLandmarksToPreviewPixels,
  mapNormalizedPointToPreviewPixel,
} from './preview-landmarks';
import type { EyebrowOverlayAnchors, FacePoint } from './types';

const point = (x: number, y: number, z = 0): FacePoint => ({ x, y, z });

const overlayAnchors: EyebrowOverlayAnchors = {
  left: {
    sp: { x: 0.44, y: 0.35 },
    hp: { x: 0.4, y: 0.31, source: 'iris' },
    ep: { x: 0.28, y: 0.35 },
    confidence: 1,
  },
  right: {
    sp: { x: 0.56, y: 0.35 },
    hp: { x: 0.6, y: 0.31, source: 'iris' },
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

describe('preview landmark mapping', () => {
  it('builds an object-cover mapping from video pixels into the visible preview box', () => {
    const mapping = buildPreviewCoordinateMapping(
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
    );

    expect(mapping).toMatchObject({
      scale: 0.3611111111111111,
      renderedVideoWidth: 390,
      renderedVideoHeight: 693.3333333333334,
      offsetX: 0,
      offsetY: -26.666666666666686,
      mirrorX: false,
    });
  });

  it('maps normalized FaceMesh coordinates to preview pixels with cover crop offsets', () => {
    const mapped = mapNormalizedPointToPreviewPixel(
      point(0.5, 0.5),
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
    );

    expect(mapped?.x).toBeCloseTo(195);
    expect(mapped?.y).toBeCloseTo(320);
    expect(mapped?.visible).toBe(true);

    const croppedTop = mapNormalizedPointToPreviewPixel(
      point(0.5, 0),
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
    );
    expect(croppedTop?.y).toBeCloseTo(-26.67, 2);
    expect(croppedTop?.visible).toBe(false);
  });

  it('supports mirrored selfie preview coordinates when a caller needs screen-visible x values', () => {
    const mapped = mapNormalizedPointToPreviewPixel(
      point(0.25, 0.5),
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
      { mirrorX: true },
    );

    expect(mapped?.x).toBeCloseTo(292.5);
    expect(mapped?.y).toBeCloseTo(320);
  });

  it('maps eyebrow overlay anchors while preserving anchor source metadata', () => {
    const mapped = mapEyebrowOverlayAnchorsToPreviewPixels(
      overlayAnchors,
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
    );

    expect(mapped?.left.sp.x).toBeCloseTo(171.6);
    expect(mapped?.left.hp.y).toBeCloseTo(188.27, 2);
    expect(mapped?.left.hp.source).toBe('iris');
    expect(mapped?.right.ep.x).toBeCloseTo(280.8);
    expect(mapped?.confidence).toBe(1);
  });

  it('maps every FaceMesh landmark in order and keeps off-preview points available for clipping decisions', () => {
    const mapped = mapLandmarksToPreviewPixels(
      [point(0.1, 0.1), point(0.5, 0.5), point(0.9, 0.9)],
      { width: 1080, height: 1920 },
      { width: 390, height: 640 },
    );

    expect(mapped).toHaveLength(3);
    expect(mapped[0]?.visible).toBe(true);
    expect(mapped[1]).toMatchObject({ x: 195, y: 320, visible: true });
    expect(mapped[2]?.y).toBeCloseTo(597.33, 2);
  });
});
