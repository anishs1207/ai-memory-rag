import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ScreenAnnotation } from '../screenAnnotations';

interface ScreenAnnotationOverlayProps {
  annotations: ScreenAnnotation[];
}

export function ScreenAnnotationOverlay({ annotations }: ScreenAnnotationOverlayProps) {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const syncViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', syncViewport);
    syncViewport();
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const x = (percent = 50) => (percent / 100) * viewportWidth;
  const y = (percent = 50) => (percent / 100) * viewportHeight;

  return (
    <svg className="screen-annotation-overlay" viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} aria-hidden="true">
      <defs>
        <marker id="blinky-annotation-arrowhead" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" className="annotation-arrowhead" />
        </marker>
      </defs>

      {annotations.map((annotation, index) => {
        const delay = 0.35 + index * 0.22;
        const targetX = annotation.type === 'arrow' || annotation.type === 'line' ? x(annotation.x2) : x(annotation.x);
        const targetY = annotation.type === 'arrow' || annotation.type === 'line' ? y(annotation.y2) : y(annotation.y);
        const labelWidth = 190;
        const labelHeight = 28;
        const placeLabelRight = targetX < viewportWidth * 0.62;
        const labelX = placeLabelRight
          ? Math.min(targetX + 24, viewportWidth - labelWidth - 12)
          : Math.max(12, targetX - labelWidth - 24);
        const preferredLabelY = targetY + (index % 2 === 0 ? -44 : 20);
        const labelY = Math.min(viewportHeight - labelHeight - 100, Math.max(12, preferredLabelY));

        return (
          <g key={annotation.id} className={`screen-annotation screen-annotation-${annotation.type}`}>
            {(annotation.type === 'arrow' || annotation.type === 'line') && (
              <motion.line
                x1={x(annotation.x1)} y1={y(annotation.y1)}
                x2={x(annotation.x2)} y2={y(annotation.y2)}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay, duration: 0.8, ease: 'easeInOut' }}
                markerEnd={annotation.type === 'arrow' ? 'url(#blinky-annotation-arrowhead)' : undefined}
              />
            )}

            {annotation.type === 'circle' && (
              <motion.ellipse
                cx={x(annotation.x)} cy={y(annotation.y)}
                rx={Math.max(24, x(annotation.width) / 2)}
                ry={Math.max(20, y(annotation.height) / 2)}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay, duration: 0.9 }}
              />
            )}

            {annotation.type === 'box' && (
              <motion.rect
                x={x(annotation.x) - x(annotation.width) / 2}
                y={y(annotation.y) - y(annotation.height) / 2}
                width={Math.max(40, x(annotation.width))}
                height={Math.max(32, y(annotation.height))}
                rx="12"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay, duration: 0.9 }}
              />
            )}

            {annotation.label && (
              <motion.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.55, duration: 0.35 }}>
                <line
                  x1={targetX} y1={targetY}
                  x2={placeLabelRight ? labelX : labelX + labelWidth}
                  y2={labelY + labelHeight / 2}
                  className="annotation-label-leader"
                />
                <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="9" className="annotation-label-bg" />
                <text x={labelX + 11} y={labelY + 18} className="annotation-label-text">
                  {`${index + 1}. ${annotation.label.slice(0, 31)}`}
                </text>
              </motion.g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
