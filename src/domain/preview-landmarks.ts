import type {
  EyebrowOverlayAnchorSource,
  EyebrowOverlayAnchorPoint,
  EyebrowOverlayAnchors,
  FacePoint,
  VideoDimensions,
} from './types';

export interface PreviewDimensions {
  width: number;
  height: number;
}

export interface PreviewCoordinateMapping {
  scale: number;
  renderedVideoWidth: number;
  renderedVideoHeight: number;
  offsetX: number;
  offsetY: number;
  mirrorX: boolean;
}

export interface PreviewFacePoint extends FacePoint {
  source?: EyebrowOverlayAnchorPoint['source'];
  visible: boolean;
}

export interface PreviewEyebrowOverlaySideAnchors {
  sp: PreviewFacePoint;
  hp: PreviewFacePoint;
  ep: PreviewFacePoint;
  confidence: number;
}

export interface PreviewEyebrowOverlayAnchors {
  left: PreviewEyebrowOverlaySideAnchors;
  right: PreviewEyebrowOverlaySideAnchors;
  confidence: number;
}

const hasPositiveDimensions = (dimensions: VideoDimensions | PreviewDimensions) => (
  Number.isFinite(dimensions.width)
    && Number.isFinite(dimensions.height)
    && dimensions.width > 0
    && dimensions.height > 0
);

const isEyebrowOverlayAnchorSource = (source: unknown): source is EyebrowOverlayAnchorSource => (
  source === 'iris' || source === 'eye-center'
);

export const buildPreviewCoordinateMapping = (
  videoDimensions: VideoDimensions,
  previewDimensions: PreviewDimensions,
  options: { mirrorX?: boolean } = {},
): PreviewCoordinateMapping | null => {
  if (!hasPositiveDimensions(videoDimensions) || !hasPositiveDimensions(previewDimensions)) return null;

  const scale = Math.max(
    previewDimensions.width / videoDimensions.width,
    previewDimensions.height / videoDimensions.height,
  );
  const renderedVideoWidth = videoDimensions.width * scale;
  const renderedVideoHeight = videoDimensions.height * scale;

  return {
    scale,
    renderedVideoWidth,
    renderedVideoHeight,
    offsetX: (previewDimensions.width - renderedVideoWidth) / 2,
    offsetY: (previewDimensions.height - renderedVideoHeight) / 2,
    mirrorX: options.mirrorX ?? false,
  };
};

export const mapNormalizedPointToPreviewPixel = (
  point: FacePoint,
  videoDimensions: VideoDimensions,
  previewDimensions: PreviewDimensions,
  options: { mirrorX?: boolean } = {},
): PreviewFacePoint | null => {
  const mapping = buildPreviewCoordinateMapping(videoDimensions, previewDimensions, options);
  if (!mapping || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  const videoX = point.x * videoDimensions.width;
  const videoY = point.y * videoDimensions.height;
  const mappedX = mapping.offsetX + (videoX * mapping.scale);
  const mappedY = mapping.offsetY + (videoY * mapping.scale);
  const x = mapping.mirrorX ? previewDimensions.width - mappedX : mappedX;
  const y = mappedY;

  return {
    x,
    y,
    z: point.z,
    visibility: point.visibility,
    presence: point.presence,
    ...('source' in point && isEyebrowOverlayAnchorSource(point.source) ? { source: point.source } : {}),
    visible: x >= 0 && x <= previewDimensions.width && y >= 0 && y <= previewDimensions.height,
  };
};

export const mapLandmarksToPreviewPixels = (
  landmarks: readonly FacePoint[],
  videoDimensions: VideoDimensions,
  previewDimensions: PreviewDimensions,
  options: { mirrorX?: boolean } = {},
) => landmarks
  .map((point) => mapNormalizedPointToPreviewPixel(point, videoDimensions, previewDimensions, options))
  .filter((point): point is PreviewFacePoint => Boolean(point));

const mapOverlaySide = (
  side: EyebrowOverlayAnchors['left'],
  videoDimensions: VideoDimensions,
  previewDimensions: PreviewDimensions,
  options: { mirrorX?: boolean },
): PreviewEyebrowOverlaySideAnchors | null => {
  const sp = mapNormalizedPointToPreviewPixel(side.sp, videoDimensions, previewDimensions, options);
  const hp = mapNormalizedPointToPreviewPixel(side.hp, videoDimensions, previewDimensions, options);
  const ep = mapNormalizedPointToPreviewPixel(side.ep, videoDimensions, previewDimensions, options);

  if (!sp || !hp || !ep) return null;

  return {
    sp,
    hp,
    ep,
    confidence: side.confidence,
  };
};

export const mapEyebrowOverlayAnchorsToPreviewPixels = (
  anchors: EyebrowOverlayAnchors,
  videoDimensions: VideoDimensions,
  previewDimensions: PreviewDimensions,
  options: { mirrorX?: boolean } = {},
): PreviewEyebrowOverlayAnchors | null => {
  const left = mapOverlaySide(anchors.left, videoDimensions, previewDimensions, options);
  const right = mapOverlaySide(anchors.right, videoDimensions, previewDimensions, options);

  if (!left || !right) return null;

  return {
    left,
    right,
    confidence: anchors.confidence,
  };
};
