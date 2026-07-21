import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, ChevronLeft, ChevronRight, Volume2, Crop, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface GuideStep {
  stepNumber: number;
  x: number;
  y: number;
  label?: string;
  description: string;
  annotationType?: 'arrow' | 'circle' | 'box';
  boxWidth?: number;
  boxHeight?: number;
}

interface GuideArrowProps {
  isGuideMode: boolean;
  arrowPos: { x: number; y: number };
  guideText: string;
  setIsGuideMode: (mode: boolean) => void;
  setArrowPos: (pos: { x: number; y: number }) => void;
  cursorColor?: 'cyan' | 'purple' | 'green' | 'orange' | 'gold';
  guideSteps?: GuideStep[];
  currentStepIndex?: number;
  setCurrentStepIndex?: (index: number) => void;
  speakStep?: (text: string) => void;
  isRegionSelecting?: boolean;
  setIsRegionSelecting?: (val: boolean) => void;
  onRegionSelected?: (cropRect: { x: number; y: number; width: number; height: number }) => void;
}

/**
 * GuideArrow displays the shiny animated Clicky cursor aura, target reticles,
 * multi-step walkthrough controller bar, and interactive screen region circling canvas.
 */
export function GuideArrow({
  isGuideMode,
  arrowPos,
  guideText,
  setIsGuideMode,
  setArrowPos,
  cursorColor = 'cyan',
  guideSteps = [],
  currentStepIndex = 0,
  setCurrentStepIndex,
  speakStep,
  isRegionSelecting = false,
  setIsRegionSelecting,
  onRegionSelected
}: GuideArrowProps) {
  // Drag selection state for region circling tool
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const activeStep = guideSteps[currentStepIndex] || null;
  const targetX = activeStep ? activeStep.x : arrowPos.x;
  const targetY = activeStep ? activeStep.y : arrowPos.y;
  const stepText = activeStep ? activeStep.description : guideText;
  const annotationType = activeStep?.annotationType || 'circle';

  // Mouse Handlers for Region Circling Tool
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isRegionSelecting) return;
    isDraggingRef.current = true;
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRegionSelecting || !isDraggingRef.current) return;
    setDragCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isRegionSelecting || !isDraggingRef.current || !dragStart || !dragCurrent) return;
    isDraggingRef.current = false;

    const left = Math.min(dragStart.x, dragCurrent.x);
    const top = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    if (width > 10 && height > 10 && onRegionSelected) {
      onRegionSelected({ x: left, y: top, width, height });
    }

    setDragStart(null);
    setDragCurrent(null);
    if (setIsRegionSelecting) setIsRegionSelecting(false);
  };

  // Step Navigation Handlers
  const handlePrevStep = () => {
    if (currentStepIndex > 0 && setCurrentStepIndex) {
      const nextIdx = currentStepIndex - 1;
      setCurrentStepIndex(nextIdx);
      const prevStep = guideSteps[nextIdx];
      if (prevStep) {
        setArrowPos({ x: prevStep.x, y: prevStep.y });
        if (speakStep) speakStep(prevStep.description);
      }
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < guideSteps.length - 1 && setCurrentStepIndex) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = guideSteps[nextIdx];
      if (nextStep) {
        setArrowPos({ x: nextStep.x, y: nextStep.y });
        if (speakStep) speakStep(nextStep.description);
      }
    }
  };

  return (
    <div className={`cursor-theme-${cursorColor}`}>
      {/* 1. Interactive Region Circling Overlay Canvas */}
      {isRegionSelecting && (
        <div
          className="region-selection-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            style={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15,15,25,0.9)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Crop size={14} color="var(--cursor-main)" />
            Click and drag to circle or select any area on your screen
          </div>

          {dragStart && dragCurrent && (
            <div
              className="region-selection-box"
              style={{
                left: Math.min(dragStart.x, dragCurrent.x),
                top: Math.min(dragStart.y, dragCurrent.y),
                width: Math.abs(dragCurrent.x - dragStart.x),
                height: Math.abs(dragCurrent.y - dragStart.y)
              }}
            />
          )}
        </div>
      )}

      {/* 2. Shiny Clicky Cursor Aura & Target Reticle */}
      <AnimatePresence>
        {isGuideMode && targetX !== -100 && (
          <>
            {/* Target Reticle Circle Annotation */}
            {(annotationType === 'circle' || annotationType === 'arrow') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1, left: targetX, top: targetY }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="guide-target-reticle"
              />
            )}

            {/* Target Highlight Box Annotation */}
            {annotationType === 'box' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  left: targetX - (activeStep?.boxWidth || 100) / 2,
                  top: targetY - (activeStep?.boxHeight || 60) / 2,
                  width: activeStep?.boxWidth || 100,
                  height: activeStep?.boxHeight || 60
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="guide-highlight-box"
              />
            )}

            {/* Shiny Animated Cursor Aura */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: targetX - 12,
                top: targetY - 12
              }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              exit={{ opacity: 0, scale: 0 }}
              className="shiny-guide-cursor"
            >
              {/* Spoken / Written Voice Bubble */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 30 }}
                className="guide-voice-bubble"
              >
                {activeStep?.label && (
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cursor-main)', marginBottom: 2 }}>
                    {activeStep.label}
                  </div>
                )}
                <MarkdownRenderer content={stepText} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Multi-Step Navigation Controller Bar */}
      {isGuideMode && (
        <div className="step-navigation-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <Sparkles size={14} color="var(--cursor-main)" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>Clicky Guide</span>
          </div>

          {guideSteps.length > 1 && (
            <>
              <button
                className="step-nav-btn"
                onClick={handlePrevStep}
                disabled={currentStepIndex === 0}
                title="Previous step"
              >
                <ChevronLeft size={12} /> Prev
              </button>

              <span className="step-counter-badge">
                {currentStepIndex + 1} / {guideSteps.length}
              </span>

              <button
                className="step-nav-btn"
                onClick={handleNextStep}
                disabled={currentStepIndex === guideSteps.length - 1}
                title="Next step"
              >
                Next <ChevronRight size={12} />
              </button>
            </>
          )}

          {stepText && speakStep && (
            <button
              className="step-nav-btn"
              onClick={() => speakStep(stepText)}
              title="Speak current step instruction"
            >
              <Volume2 size={12} /> Speak
            </button>
          )}

          <button
            className="step-nav-btn"
            style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}
            onClick={() => {
              setIsGuideMode(false);
              setArrowPos({ x: -100, y: -100 });
            }}
            title="Exit Guide Mode"
          >
            <Minimize2 size={12} /> Exit
          </button>
        </div>
      )}
    </div>
  );
}
