import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

// Property interface for GuideArrow
interface GuideArrowProps {
  isGuideMode: boolean;
  arrowPos: { x: number; y: number };
  guideText: string;
  setIsGuideMode: (mode: boolean) => void;
  setArrowPos: (pos: { x: number; y: number }) => void;
}

/**
 * GuideArrow component displays a visual arrow pointer and guidance text bubble
 * at designated coordinates on the screen during active Guide Mode sessions.
 */
export function GuideArrow({
  isGuideMode,
  arrowPos,
  guideText,
  setIsGuideMode,
  setArrowPos,
}: GuideArrowProps) {
  return (
    <>
      {/* Animated pointing arrow matching detection coordinates */}
      <AnimatePresence>
        {isGuideMode && arrowPos.x !== -100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: arrowPos.x,
              y: arrowPos.y,
              rotate: -15
            }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            exit={{ opacity: 0, scale: 0 }}
            className="guide-arrow"
          >
            <div className="guide-arrow-glow" />
            <svg
              className="guide-arrow-svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 2l12 10-12 10V2z" />
            </svg>

            {/* Voice bubble containing step instruction */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 30 }}
              className="guide-voice-bubble"
            >
              <MarkdownRenderer content={guideText} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button to escape guidance mode and restore normal window layout */}
      {isGuideMode && (
        <button
          className="interactive-overlay exit-guide-btn"
          onClick={() => {
            setIsGuideMode(false);
            setArrowPos({ x: -100, y: -100 });
          }}
          title="Exit Guide Mode and restore window size"
        >
          <Minimize2 size={13} style={{ marginRight: 6 }} />
          Exit Guide Mode
        </button>
      )}
    </>
  );
}
