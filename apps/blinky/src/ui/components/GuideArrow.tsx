import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, ChevronLeft, ChevronRight, Volume2, Crop, Sparkles, Mic, Play } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

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
  // Voice input integration in Guide mode
  speechSupported?: boolean;
  isListening?: boolean;
  toggleListening?: () => void;
  guideInput?: string;
  setGuideInput?: (val: string) => void;
  handleGuideQuerySubmit?: (prompt?: string) => void;
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
  onRegionSelected,
  speechSupported = true,
  isListening = false,
  toggleListening,
  guideInput = '',
  setGuideInput,
  handleGuideQuerySubmit
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

  // Explicit Mouse Event handlers to ensure Electron window allows clicks on the guide bar
  const handleMouseEnterBar = () => {
    if (typeof window !== 'undefined' && window.electron?.setIgnoreMouseEvents) {
      window.electron.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeaveBar = () => {
    if (typeof window !== 'undefined' && window.electron?.setIgnoreMouseEvents && isGuideMode) {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  };

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
          className="fixed inset-0 bg-black/40 cursor-crosshair z-[10001]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnterBar}
        >
          <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded-full border border-cyan-400/40 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-xl">
            <Crop size={14} className="text-cyan-400 animate-spin-slow" />
            Click and drag to circle or select any screen region
          </div>

          {dragStart && dragCurrent && (
            <div
              className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/15 rounded-lg shadow-[0_0_25px_rgba(0,242,254,0.6)] pointer-events-none"
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
                  <div className="text-[11px] font-extrabold text-cyan-300 mb-1">
                    {activeStep.label}
                  </div>
                )}
                <MarkdownRenderer content={stepText} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Multi-Step Navigation & Dedicated Speakable Controller Bar */}
      {isGuideMode && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/90 border border-white/20 p-2 px-4 rounded-2xl shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl z-[10000] pointer-events-auto select-none transition-all duration-300"
          onMouseEnter={handleMouseEnterBar}
          onMouseLeave={handleMouseLeaveBar}
        >
          <div className="flex items-center gap-2 pr-2 border-r border-white/15">
            <Sparkles size={16} className="text-cyan-400 animate-pulse" />
            <span className="text-xs font-black tracking-wide text-white">Clicky Guide</span>
            <Badge variant="cyan" className="px-1.5 py-0 text-[9px] uppercase font-bold">
              Screen Aware
            </Badge>
          </div>

          {/* Voice Microphone Speakable Control */}
          {speechSupported && toggleListening && (
            <Button
              variant={isListening ? "destructive" : "cyan"}
              size="icon"
              className={`h-8 w-8 rounded-full shadow-lg ${isListening ? 'animate-pulse ring-4 ring-red-500/50' : ''}`}
              onClick={toggleListening}
              title={isListening ? "Listening... Click to stop" : "Speak instruction to Blinky"}
            >
              <Mic size={14} />
            </Button>
          )}

          {setGuideInput && handleGuideQuerySubmit && (
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                className="h-8 w-44 text-xs bg-white/5 border-white/20 placeholder:text-white/40"
                placeholder={isListening ? "Listening to voice..." : "Ask what to click next..."}
                value={guideInput}
                onChange={(e) => setGuideInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuideQuerySubmit()}
              />
              <Button
                variant="accent"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() => handleGuideQuerySubmit()}
                title="Send query"
              >
                <Play size={10} fill="currentColor" />
              </Button>
            </div>
          )}

          {guideSteps.length > 1 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
              <Button
                variant="outline"
                size="xs"
                className="h-7 px-2"
                onClick={handlePrevStep}
                disabled={currentStepIndex === 0}
                title="Previous step"
              >
                <ChevronLeft size={12} /> Prev
              </Button>

              <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold text-cyan-300">
                {currentStepIndex + 1} / {guideSteps.length}
              </Badge>

              <Button
                variant="outline"
                size="xs"
                className="h-7 px-2"
                onClick={handleNextStep}
                disabled={currentStepIndex === guideSteps.length - 1}
                title="Next step"
              >
                Next <ChevronRight size={12} />
              </Button>
            </div>
          )}

          {stepText && speakStep && (
            <Button
              variant="secondary"
              size="xs"
              className="h-7 px-2 gap-1 text-xs"
              onClick={() => speakStep(stepText)}
              title="Speak step"
            >
              <Volume2 size={12} /> Speak
            </Button>
          )}

          <Button
            variant="destructive"
            size="xs"
            className="h-7 px-3 gap-1 font-bold ml-1"
            onClick={() => {
              setIsGuideMode(false);
              setArrowPos({ x: -100, y: -100 });
            }}
            title="Exit Guide Mode"
          >
            <Minimize2 size={12} /> Exit
          </Button>
        </div>
      )}
    </div>
  );
}
