"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  ArrowRight, 
  Sparkles, 
  Play, 
  Compass, 
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
  const [customStyle, setCustomStyle] = useState({
    theme: "glass", // glass | neon | dark
    color: "#3b82f6", // default blue
    position: "right", // left | right
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverRef = useRef<any>(null);

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

  // Sync state changes on local storage event for dynamic updates on the config page
  useEffect(() => {
    const handleStorageChange = () => {
      const savedConfig = localStorage.getItem("onboarding_widget_config");
      if (savedConfig) {
        setCustomStyle(JSON.parse(savedConfig));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Save active tour status to localStorage
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
    saveTourState(null, 0);
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  };

  const handleNextStep = () => {
    if (!activeTour) return;
    const tour = TOURS[activeTour];
    if (!tour) return;

    if (stepIndex < tour.steps.length - 1) {
      const nextIdx = stepIndex + 1;
      const nextStepObj = tour.steps[nextIdx];
      if (nextStepObj && pathname !== nextStepObj.route) {
        if (driverRef.current) {
          driverRef.current.destroy();
          driverRef.current = null;
        }
      }
      setStepIndex(nextIdx);
      saveTourState(activeTour, nextIdx);
    } else {
      stopTour();
    }
  };

  const handlePrevStep = () => {
    if (!activeTour) return;
    const tour = TOURS[activeTour];
    if (!tour) return;

    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      const prevStepObj = tour.steps[prevIdx];
      if (prevStepObj && pathname !== prevStepObj.route) {
        if (driverRef.current) {
          driverRef.current.destroy();
          driverRef.current = null;
        }
      }
      setStepIndex(prevIdx);
      saveTourState(activeTour, prevIdx);
    }
  };

  // Synchronize driver.js with current activeTour, stepIndex, and pathname
  useEffect(() => {
    if (!activeTour) {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      return;
    }

    const tour = TOURS[activeTour];
    if (!tour) return;

    const currentStep = tour.steps[stepIndex];
    if (!currentStep) return;

    // If step is on a different route, navigate first
    if (pathname !== currentStep.route) {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      router.push(currentStep.route);
      return;
    }

    // Wait for target selector to appear in DOM
    const interval = setInterval(() => {
      const el = document.querySelector(currentStep.selector);
      if (el) {
        clearInterval(interval);

        if (!driverRef.current) {
          driverRef.current = driver({
            showProgress: true,
            allowClose: true,
            overlayColor: "rgba(11, 15, 25, 0.75)",
            className: "driverjs-theme",
            onNextClick: () => {
              handleNextStep();
            },
            onPrevClick: () => {
              handlePrevStep();
            },
            onCloseClick: () => {
              stopTour();
            },
            onDestroyed: () => {
              // Reset if closed via escape/clicking overlay
              if (localStorage.getItem("active_tour")) {
                stopTour();
              }
            }
          });
        }

        const driverSteps = tour.steps.map((s, idx) => ({
          element: s.selector,
          popover: {
            title: s.title,
            description: s.description,
            side: s.arrowPosition,
            align: "start" as const,
            nextBtnText: idx === tour.steps.length - 1 ? "Finish" : "Next →",
            prevBtnText: "← Back",
          }
        }));

        driverRef.current.setSteps(driverSteps);
        
        if (driverRef.current.getActiveIndex() !== stepIndex) {
          driverRef.current.drive(stepIndex);
        }
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTour, stepIndex, pathname]);

  // Perform Natural Query Intent Matching
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return;

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
      alert("I matched that request closely to the 'AI Cognitive Chat Tour'!");
      startTour("chat");
    }
    setQuery("");
  };

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
    </>
  );
}
