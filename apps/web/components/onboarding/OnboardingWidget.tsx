"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, 
  X, 
  Send, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Play, 
  Compass, 
  Layers, 
  ChevronRight,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// --- Tour Configuration Types ---
type TourStep = {
  route: string;
  selector: string;
  title: string;
  description: string;
  arrowPosition: "top" | "bottom" | "left" | "right";
};

type Tour = {
  id: string;
  name: string;
  description: string;
  color: string;
  steps: TourStep[];
};

// --- Tours Database ---
const TOURS: Record<string, Tour> = {
  chat: {
    id: "chat",
    name: "AI Cognitive Chat Tour",
    description: "Explore cognitive AI agent models, context files, and conversation summaries.",
    color: "from-blue-500 to-indigo-600",
    steps: [
      {
        route: "/chat",
        selector: '[data-tour="chat-sidebar"]',
        title: "Conversation Registry",
        description: "This is the active conversation sidebar. You can manage current sessions, clear old messages, toggle dark mode, or start a new chat.",
        arrowPosition: "right",
      },
      {
        route: "/chat",
        selector: '[data-tour="chat-models"]',
        title: "Cognitive Reasoners",
        description: "Toggle between General, Finance, Legal, PDF Chat, Budget, or Research model states to apply specific AI persona templates.",
        arrowPosition: "top",
      },
      {
        route: "/chat",
        selector: '[data-tour="chat-upload"]',
        title: "Add Domain Context",
        description: "Click here to upload files (PDFs, TXT, MD). The documents are indexed locally so agents can read and reference them.",
        arrowPosition: "bottom",
      },
      {
        route: "/chat",
        selector: '[data-tour="chat-textarea"]',
        title: "Talk to Inqora",
        description: "Type your query here. Use the word 'analyze' inside your prompt to inspect the agent's logical reasoning stages and search logs!",
        arrowPosition: "bottom",
      }
    ]
  },
  stress: {
    id: "stress",
    name: "Agent Panel & Stress Simulation",
    description: "Deploy autonomous council agents, view alliances, and apply stresstesting.",
    color: "from-rose-500 to-red-600",
    steps: [
      {
        route: "/panel",
        selector: '[data-tour="panel-instances"]',
        title: "Select Instance Footprint",
        description: "Set the initial number of autonomous agent personas (from 4 to 50) you wish to spawn inside the environment.",
        arrowPosition: "right",
      },
      {
        route: "/panel",
        selector: '[data-tour="panel-init"]',
        title: "Deploy Agents & Run Election",
        description: "Click this button to deploy the selected agent profiles. They will automatically run a campaign and election cycle simulation.",
        arrowPosition: "left",
      },
      {
        route: "/panel",
        selector: '[data-tour="panel-stress"]',
        title: "Environmental Stress Factors",
        description: "Input stress details here (like budget deficit or server load) and click Apply Stress to see how candidate agents coordinate decisions.",
        arrowPosition: "bottom",
      },
      {
        route: "/panel",
        selector: '[data-tour="panel-logs"]',
        title: "Real-time System Logs",
        description: "Monitor live state logs, consensus percentages, election vote breakdowns, and global media reports right here.",
        arrowPosition: "left",
      }
    ]
  },
  vault: {
    id: "vault",
    name: "VLM Memory Vault & Gallery",
    description: "Manage visual memories, identify social relationships, and run semantic search queries.",
    color: "from-emerald-500 to-teal-600",
    steps: [
      {
        route: "/image-memory",
        selector: '[data-tour="vault-upload"]',
        title: "Visual Memory Ingestion",
        description: "Drag and drop images here. Inqora's Visual Language Model (VLM) will immediately parse the images to catalog properties.",
        arrowPosition: "bottom",
      },
      {
        route: "/image-memory",
        selector: '[data-tour="vault-search"]',
        title: "Natural Tag Search",
        description: "Filter files and query specific face records, objects, locations, or dates inside your cognitive gallery using keywords.",
        arrowPosition: "bottom",
      },
      {
        route: "/image-memory",
        selector: '[data-tour="vault-tabs"]',
        title: "Identity Vault & Relationships",
        description: "Toggle between the Gallery grid, extracted social relationships network graphs, geographic maps, and events timeline tabs.",
        arrowPosition: "top",
      },
      {
        route: "/image-memory",
        selector: '[data-tour="vault-sync"]',
        title: "Synchronizer controls",
        description: "Force database sync with the server. You can also completely clear all visual memory logs with the red reset action.",
        arrowPosition: "bottom",
      }
    ]
  }
};

export default function OnboardingWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [elementBounds, setElementBounds] = useState<DOMRect | null>(null);
  const [customStyle, setCustomStyle] = useState({
    theme: "glass", // glass | neon | dark
    color: "#3b82f6", // default blue
    position: "right", // left | right
  });

  // Load configuration from localStorage
  useEffect(() => {
    const savedTour = localStorage.getItem("active_tour");
    const savedStep = localStorage.getItem("active_tour_step");
    const savedConfig = localStorage.getItem("onboarding_widget_config");

    if (savedTour && TOURS[savedTour]) {
      setActiveTour(savedTour);
      setStepIndex(Number(savedStep || 0));
    }
    if (savedConfig) {
      setCustomStyle(JSON.parse(savedConfig));
    }
  }, []);

  // Save tour status
  const saveTourState = (tour: string | null, step: number) => {
    if (tour) {
      localStorage.setItem("active_tour", tour);
      localStorage.setItem("active_tour_step", String(step));
    } else {
      localStorage.removeItem("active_tour");
      localStorage.removeItem("active_tour_step");
    }
  };

  const startTour = (tourId: string) => {
    const tour = TOURS[tourId];
    if (!tour) return;
    setActiveTour(tourId);
    setStepIndex(0);
    setIsOpen(false);
    saveTourState(tourId, 0);

    const firstStep = tour.steps[0];
    if (firstStep && pathname !== firstStep.route) {
      router.push(firstStep.route);
    }
  };

  const stopTour = () => {
    setActiveTour(null);
    setStepIndex(0);
    setElementBounds(null);
    saveTourState(null, 0);
  };

  const nextStep = () => {
    if (!activeTour) return;
    const tour = TOURS[activeTour];
    if (!tour) return;
    if (stepIndex < tour.steps.length - 1) {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      saveTourState(activeTour, nextIdx);
      
      const nextStepObj = tour.steps[nextIdx];
      if (nextStepObj && pathname !== nextStepObj.route) {
        router.push(nextStepObj.route);
      }
    } else {
      stopTour();
    }
  };

  const prevStep = () => {
    if (!activeTour) return;
    const tour = TOURS[activeTour];
    if (!tour) return;
    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      saveTourState(activeTour, prevIdx);
      
      const prevStepObj = tour.steps[prevIdx];
      if (prevStepObj && pathname !== prevStepObj.route) {
        router.push(prevStepObj.route);
      }
    }
  };

  // Perform Natural Query Intent Matching
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return;

    // Intents matching
    if (
      cleanQuery.includes("chat") || 
      cleanQuery.includes("ai") || 
      cleanQuery.includes("rag") ||
      cleanQuery.includes("ask") ||
      cleanQuery.includes("helper")
    ) {
      startTour("chat");
    } else if (
      cleanQuery.includes("stress") || 
      cleanQuery.includes("simulate") || 
      cleanQuery.includes("panel") || 
      cleanQuery.includes("agent") || 
      cleanQuery.includes("election")
    ) {
      startTour("stress");
    } else if (
      cleanQuery.includes("memory") || 
      cleanQuery.includes("vault") || 
      cleanQuery.includes("image") || 
      cleanQuery.includes("photo") || 
      cleanQuery.includes("gallery") ||
      cleanQuery.includes("upload")
    ) {
      startTour("vault");
    } else {
      // Fallback: search-like alert or default tour
      alert("I matching system maps that request closely to the 'AI Cognitive Chat Tour'!");
      startTour("chat");
    }
    setQuery("");
  };

  // Track Target Element Bounds on route changes, scrolling, and resizing
  useEffect(() => {
    if (!activeTour) {
      setElementBounds(null);
      return;
    }

    const currentStep = TOURS[activeTour]?.steps[stepIndex];
    if (!currentStep || pathname !== currentStep.route) {
      setElementBounds(null);
      return;
    }

    const updateBounds = () => {
      const element = document.querySelector(currentStep.selector);
      if (element) {
        setElementBounds(element.getBoundingClientRect());
      } else {
        setElementBounds(null);
      }
    };

    // Poll bounds since elements might load asynchronously
    const interval = setInterval(updateBounds, 200);
    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds);
    };
  }, [activeTour, stepIndex, pathname]);

  const currentStep = activeTour ? TOURS[activeTour]?.steps[stepIndex] : null;

  // --- Dynamic Overlay Styles ---
  const getOverlayStyles = () => {
    if (!elementBounds || !currentStep) return { overlay: {}, arrow: {}, tooltip: {} };

    const offset = 12; // Gap between arrow/tooltip and elements
    const arrowSize = 8;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const elTop = elementBounds.top + scrollY;
    const elLeft = elementBounds.left + scrollX;
    const elWidth = elementBounds.width;
    const elHeight = elementBounds.height;

    let tooltipStyle: React.CSSProperties = {};
    let arrowStyle: React.CSSProperties = {};

    switch (currentStep.arrowPosition) {
      case "bottom":
        // Tooltip sits below the target element
        tooltipStyle = {
          top: `${elTop + elHeight + offset}px`,
          left: `${elLeft + elWidth / 2}px`,
          transform: "translateX(-50%)",
        };
        arrowStyle = {
          top: `-${arrowSize}px`,
          left: "50%",
          transform: "translateX(-50%) rotate(180deg)",
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${customStyle.color} transparent`,
        };
        break;
      case "top":
        // Tooltip sits above target element
        tooltipStyle = {
          top: `${elTop - offset}px`,
          left: `${elLeft + elWidth / 2}px`,
          transform: "translateX(-50%) translateY(-100%)",
        };
        arrowStyle = {
          bottom: `-${arrowSize}px`,
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: `${customStyle.color} transparent transparent transparent`,
        };
        break;
      case "right":
        // Tooltip sits to the right
        tooltipStyle = {
          top: `${elTop + elHeight / 2}px`,
          left: `${elLeft + elWidth + offset}px`,
          transform: "translateY(-50%)",
        };
        arrowStyle = {
          left: `-${arrowSize}px`,
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${customStyle.color} transparent`,
        };
        break;
      case "left":
        // Tooltip sits to the left
        tooltipStyle = {
          top: `${elTop + elHeight / 2}px`,
          left: `${elLeft - offset}px`,
          transform: "translateX(-100%) translateY(-50%)",
        };
        arrowStyle = {
          right: `-${arrowSize}px`,
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${customStyle.color} transparent`,
        };
        break;
    }

    return { tooltipStyle, arrowStyle };
  };

  const { tooltipStyle, arrowStyle } = getOverlayStyles();

  return (
    <>
      {/* Floating Onboarding Widget FAB */}
      {!activeTour && (
        <div 
          className={`fixed bottom-6 ${
            customStyle.position === "right" ? "right-6" : "left-6"
          } z-[9999]`}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            style={{ 
              borderColor: customStyle.color,
              boxShadow: `0 0 15px ${customStyle.color}30` 
            }}
            className={`flex items-center gap-2 px-4 py-3 rounded-full border text-white font-semibold cursor-pointer select-none backdrop-blur-md transition-all duration-300 ${
              customStyle.theme === "dark" 
                ? "bg-neutral-900 border-neutral-700" 
                : "bg-slate-900/80 hover:bg-slate-900/90 text-foreground"
            }`}
          >
            <Compass className="size-5 animate-spin-slow" style={{ color: customStyle.color }} />
            <span className="text-sm">Onboarding Guide</span>
            {isOpen ? <X className="size-4 ml-1" /> : <ChevronRight className="size-4 ml-1" />}
          </motion.button>
        </div>
      )}

      {/* Floating Assistant Dialog Box */}
      <AnimatePresence>
        {isOpen && !activeTour && (
          <div 
            className={`fixed bottom-20 ${
              customStyle.position === "right" ? "right-6" : "left-6"
            } w-80 max-w-[90vw] z-[9999]`}
          >
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className={`rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-xl ${
                customStyle.theme === "dark"
                  ? "bg-neutral-950/95 border-neutral-800 text-white"
                  : "bg-slate-950/90 border-slate-800 text-white"
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 animate-pulse" style={{ color: customStyle.color }} />
                  <div>
                    <h3 className="font-bold text-xs tracking-tight uppercase">Inqora Assistant</h3>
                    <p className="text-[10px] opacity-60">Guides your onboarding steps</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold opacity-60 uppercase tracking-widest">Natural Intent Search</p>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                      placeholder="Type what you want to do... (e.g. chat)"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder-white/40 focus-visible:ring-1 focus-visible:ring-blue-500"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="size-8 rounded-md bg-blue-600 hover:bg-blue-700 shrink-0"
                    >
                      <Send className="size-3.5" />
                    </Button>
                  </form>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold opacity-60 uppercase tracking-widest">Interactive Tours</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Object.values(TOURS).map((tour) => (
                      <button
                        key={tour.id}
                        onClick={() => startTour(tour.id)}
                        className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group flex items-start gap-3 cursor-pointer"
                      >
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${tour.color} shrink-0`}>
                          <Play className="size-3.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                            {tour.name}
                          </h4>
                          <p className="text-[10px] opacity-60 line-clamp-2 mt-0.5">{tour.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dashboard Shortcut link */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="opacity-60">Want to customize widgets?</span>
                  <button 
                    onClick={() => { router.push("/onboarding"); setIsOpen(false); }}
                    className="font-bold flex items-center gap-1 hover:underline text-blue-400"
                  >
                    Go to Config Dashboard <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tour Step Overlay Arrow and Tooltip */}
      {activeTour && currentStep && elementBounds && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[10000]">
          {/* Neon Pulse Overlay around the element */}
          <div 
            className="fixed pointer-events-none border-2 rounded-lg transition-all duration-300"
            style={{
              top: `${elementBounds.top}px`,
              left: `${elementBounds.left}px`,
              width: `${elementBounds.width}px`,
              height: `${elementBounds.height}px`,
              borderColor: customStyle.color,
              boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 15px ${customStyle.color}, inset 0 0 10px ${customStyle.color}`,
              zIndex: 9998,
            }}
          />

          {/* Floating Tooltip Card */}
          <div 
            className="absolute pointer-events-auto z-[9999] transition-all duration-300 w-80 max-w-[90vw]"
            style={tooltipStyle}
          >
            {/* Triangular arrow pointer */}
            <div 
              className="absolute w-0 h-0 border-solid pointer-events-none"
              style={arrowStyle}
            />

            {/* Explanatory content card */}
            <div 
              style={{ borderLeftColor: customStyle.color }}
              className="bg-slate-900 border-l-4 border border-slate-800 text-white rounded-xl shadow-2xl p-4 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Step {stepIndex + 1} of {activeTour ? TOURS[activeTour]?.steps.length || 0 : 0}
                  </span>
                </div>
                <button 
                  onClick={stopTour} 
                  className="opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-white/10"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <h4 className="text-sm font-bold text-white leading-tight">{currentStep.title}</h4>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{currentStep.description}</p>

              {/* Navigation buttons */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={stepIndex === 0}
                  className="h-7 text-xs px-2.5 hover:bg-white/5 disabled:opacity-40"
                >
                  <ArrowLeft className="size-3 mr-1" /> Back
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopTour}
                    className="h-7 text-xs px-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    End Tour
                  </Button>
                  <Button
                    size="sm"
                    onClick={nextStep}
                    style={{ backgroundColor: customStyle.color }}
                    className="h-7 text-xs px-3 hover:brightness-110 font-medium"
                  >
                    {stepIndex === (activeTour ? TOURS[activeTour]?.steps.length || 1 : 1) - 1 ? "Finish" : "Next"} 
                    <ArrowRight className="size-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
