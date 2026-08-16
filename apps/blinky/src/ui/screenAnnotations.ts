export type ScreenAnnotationType = 'arrow' | 'line' | 'circle' | 'box' | 'label';

export interface ScreenAnnotation {
  id: string;
  type: ScreenAnnotationType;
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface ScreenAnnotationPlan {
  summary: string;
  annotations: ScreenAnnotation[];
}

const annotationTypes = new Set<ScreenAnnotationType>(['arrow', 'line', 'circle', 'box', 'label']);
const MAX_SHAPE_WIDTH_PERCENT = 38;
const MAX_SHAPE_HEIGHT_PERCENT = 32;
const MAX_ELLIPSE_ASPECT_RATIO = 3;
const clampPercent = (value: unknown, fallback = 50) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : fallback;
};

/** Parse and normalize the model's annotation plan; malformed shapes are discarded. */
export function parseScreenAnnotationPlan(response: string, imageWidth: number, imageHeight: number): ScreenAnnotationPlan | null {
  const fencedJson = response.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  const rawJson = fencedJson || response.match(/\{[\s\S]*"annotations"[\s\S]*\}/)?.[0];
  if (!rawJson) return null;

  try {
    const candidate = JSON.parse(rawJson) as {
      summary?: unknown;
      annotations?: unknown;
      coordinateSpace?: { width?: unknown; height?: unknown; unit?: unknown };
    };
    if (!Array.isArray(candidate.annotations)) return null;

    const declaredWidth = Number(candidate.coordinateSpace?.width);
    const declaredHeight = Number(candidate.coordinateSpace?.height);
    const coordinateWidth = Number.isFinite(declaredWidth) && declaredWidth > 0 ? declaredWidth : imageWidth;
    const coordinateHeight = Number.isFinite(declaredHeight) && declaredHeight > 0 ? declaredHeight : imageHeight;
    const usesPixels = candidate.coordinateSpace?.unit === 'pixels' || coordinateWidth > 100 || coordinateHeight > 100;
    const normalize = (value: unknown, axisSize: number, fallbackPercent: number) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numericValue)) return fallbackPercent;
      return usesPixels ? clampPercent(numericValue / axisSize * 100, fallbackPercent) : clampPercent(numericValue, fallbackPercent);
    };

    const annotations = candidate.annotations.slice(0, 12).flatMap((item, index): ScreenAnnotation[] => {
      if (!item || typeof item !== 'object') return [];
      const shape = item as Record<string, unknown>;
      if (!annotationTypes.has(shape.type as ScreenAnnotationType)) return [];

      const type = shape.type as ScreenAnnotationType;
      const common = {
        id: typeof shape.id === 'string' ? shape.id : `annotation-${index + 1}`,
        type,
        label: typeof shape.label === 'string' ? shape.label.slice(0, 120) : undefined,
      };

      if (type === 'arrow' || type === 'line') {
        return [{
          ...common,
          x1: normalize(shape.x1, coordinateWidth, 50),
          y1: normalize(shape.y1, coordinateHeight, 50),
          x2: normalize(shape.x2, coordinateWidth, 50),
          y2: normalize(shape.y2, coordinateHeight, 50),
        }];
      }

      let width = Math.min(MAX_SHAPE_WIDTH_PERCENT, normalize(shape.width, coordinateWidth, type === 'label' ? 0 : 12));
      let height = Math.min(MAX_SHAPE_HEIGHT_PERCENT, normalize(shape.height, coordinateHeight, type === 'label' ? 0 : 10));
      if (type === 'circle' && width > 0 && height > 0) {
        if (width / height > MAX_ELLIPSE_ASPECT_RATIO) width = height * MAX_ELLIPSE_ASPECT_RATIO;
        if (height / width > MAX_ELLIPSE_ASPECT_RATIO) height = width * MAX_ELLIPSE_ASPECT_RATIO;
      }
      const centerX = normalize(shape.x, coordinateWidth, 50);
      const centerY = normalize(shape.y, coordinateHeight, 50);

      return [{
        ...common,
        x: Math.min(100 - width / 2, Math.max(width / 2, centerX)),
        y: Math.min(100 - height / 2, Math.max(height / 2, centerY)),
        width,
        height,
      }];
    });

    if (annotations.length === 0) return null;
    return {
      summary: typeof candidate.summary === 'string' ? candidate.summary.trim() : '',
      annotations,
    };
  } catch {
    return null;
  }
}
