"use client";

/**
 * Interactive React & Tailwind UI Builder Page
 * Features client-side live preview compiled via Babel Standalone,
 * responsive canvas widths, error boundaries, logs console,
 * and an interactive chat pane powered by Gemini 2.5.
 * 
 * Date: 2026-06-18
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as Lucide from "lucide-react";
import * as Recharts from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";


// ==========================================
// TYPES AND INTERFACES
// ==========================================

interface LogEntry {
  id: string;
  type: "info" | "success" | "error";
  message: string;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

interface SuggestedPrompt {
  label: string;
  prompt: string;
  icon: string;
}

// ==========================================
// CLASS-BASED ERROR BOUNDARY
// ==========================================

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void; resetKey: number },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: any) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-red-500/50 rounded-lg bg-red-950/10 text-red-400 h-full min-h-[300px]">
          <Lucide.AlertOctagon className="w-12 h-12 mb-3 text-red-500 animate-pulse" />
          <h3 className="font-semibold text-lg mb-1">Runtime Component Error</h3>
          <p className="text-sm text-red-400/80 mb-4 text-center max-w-md">
            The component crashed during rendering. Ensure all state references are correct.
          </p>
          <pre className="p-3 bg-red-950/30 rounded text-xs overflow-auto max-w-full text-red-300 border border-red-900/50 w-full max-h-[180px]">
            {this.state.error?.message || "Unknown rendering exception"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// PREVIEW CONTAINER & COMPILER CORE
// ==========================================

interface PreviewAreaProps {
  code: string;
  babel: any;
  onLog: (type: "info" | "success" | "error", message: string) => void;
  resetKey: number;
}

function PreviewArea({ code, babel, onLog, resetKey }: PreviewAreaProps) {
  const [DynamicComponent, setDynamicComponent] = useState<React.ComponentType | null>(null);
  const [compilationError, setCompilationError] = useState<string | null>(null);

  useEffect(() => {
    if (!babel || !code) return;

    try {
      setCompilationError(null);
      onLog("info", "Initiating Babel transpilation...");

      // Clean markdown tags if LLM accidentally added them
      let cleanedCode = code.trim();
      if (cleanedCode.startsWith("```")) {
        cleanedCode = cleanedCode.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
      }

      // Compile the JSX string using env and react presets
      const compiled = babel.transform(cleanedCode, {
        presets: ["env", "react"],
        filename: "dynamic-component.tsx",
      }).code;

      // Group UI components to inject into the sandbox
      const UIComponents = {
        Button,
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription,
        CardFooter,
        Input,
        Textarea,
        ScrollArea,
        Badge,
        Separator
      };

      // Create a mocked require function to resolve dynamic client-side imports
      const requireMock = (moduleName: string) => {
        const name = moduleName.toLowerCase();
        if (name === "react") return React;
        if (name === "lucide-react") return Lucide;
        if (name === "recharts") return Recharts;
        if (name.includes("button")) return { Button };
        if (name.includes("card")) return { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter };
        if (name.includes("input")) return { Input };
        if (name.includes("textarea")) return { Textarea };
        if (name.includes("scroll-area")) return { ScrollArea };
        if (name.includes("badge")) return { Badge };
        if (name.includes("separator")) return { Separator };
        if (name === "lucide") return Lucide;
        throw new Error(`Module "${moduleName}" is not available in the UI builder sandbox.`);
      };

      // Construct script to unpack Lucide icons and Recharts components into local variables
      let unpackScript = "";

      // React hooks unpacking
      const hooks = [
        "useState", "useEffect", "useMemo", "useCallback", "useRef",
        "useContext", "useReducer", "useTransition", "useDeferredValue", "useId"
      ];
      hooks.forEach(hook => {
        unpackScript += `const ${hook} = React.${hook};\n`;
      });

      // Lucide icons unpacking (only unpack valid identifiers)
      for (const key in Lucide) {
        if (/^[a-zA-Z0-9_]+$/.test(key)) {
          unpackScript += `const ${key} = Lucide.${key};\n`;
        }
      }

      // Recharts unpacking
      for (const key in Recharts) {
        if (/^[a-zA-Z0-9_]+$/.test(key)) {
          unpackScript += `const ${key} = Recharts.${key};\n`;
        }
      }

      // UI components unpacking
      for (const key in UIComponents) {
        unpackScript += `const ${key} = UIComponents.${key};\n`;
      }

      // Evaluate the transpiled script in a controlled context
      const renderComponent = new Function(
        "React",
        "Lucide",
        "Recharts",
        "UIComponents",
        "require",
        `
        const exports = {};
        const module = { exports };
        
        // Unpack libraries and hooks into local variables
        \${unpackScript}

        // Compiled Babel output
        \${compiled}

        // Return the component definition
        if (exports.default) return exports.default;
        if (module.exports.default) return module.exports.default;
        if (module.exports && typeof module.exports === 'function') return module.exports;
        if (typeof Component !== 'undefined') return Component;
        if (typeof App !== 'undefined') return App;
        
        // Final fallback: look inside exports
        const keys = Object.keys(exports);
        for (const k of keys) {
          if (typeof exports[k] === 'function') return exports[k];
        }
        throw new Error("Target function 'Component' or 'App' not found in transpiled code.");
        `
      );

      const EvaluatedComponent = renderComponent(
        React,
        Lucide,
        Recharts,
        UIComponents,
        requireMock
      );

      setDynamicComponent(() => EvaluatedComponent);
      onLog("success", "Transpilation completed. Component rendered successfully.");
    } catch (err: any) {
      console.error("[COMPILER_ERROR]", err);
      const errMsg = err.message || String(err);
      setCompilationError(errMsg);
      onLog("error", `Compilation failed: ${errMsg}`);
    }
  }, [code, babel, resetKey]);

  if (compilationError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-dashed border-red-500/50 rounded-lg bg-red-950/10 text-red-400 h-full min-h-[300px]">
        <Lucide.AlertCircle className="w-12 h-12 mb-3 text-red-500" />
        <h3 className="font-semibold text-lg mb-1">Babel Compilation Error</h3>
        <p className="text-sm text-red-400/80 mb-4 text-center max-w-md">
          A syntax or module resolution error occurred during Babel compilation.
        </p>
        <pre className="p-3 bg-red-950/30 rounded text-xs overflow-auto max-w-full text-red-300 border border-red-900/50 w-full max-h-[180px]">
          {compilationError}
        </pre>
      </div>
    );
  }

  if (!babel) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full min-h-[350px] text-slate-400">
        <Lucide.Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
        <p className="text-sm font-medium">Downloading client-side compiler environment...</p>
      </div>
    );
  }

  if (!DynamicComponent) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full min-h-[350px] text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
        <Lucide.FileCode className="w-12 h-12 mb-3 text-indigo-400/60" />
        <p className="text-sm">Awaiting component code to compile...</p>
      </div>
    );
  }

  return (
    <PreviewErrorBoundary resetKey={resetKey} onError={(err) => onLog("error", `Runtime Exception: ${err.message}`)}>
      <div className="w-full bg-slate-900/20 p-6 rounded-xl border border-slate-800/80 shadow-inner">
        <DynamicComponent />
      </div>
    </PreviewErrorBoundary>
  );
}

// ==========================================
// DEFAULT COMPONENT CODE FOR FIRST LOAD
// ==========================================

const DEFAULT_INITIAL_CODE = `function Component() {
  const [metrics, setMetrics] = useState([
    { name: "Mon", visitors: 4000, bounce: 40 },
    { name: "Tue", visitors: 3000, bounce: 30 },
    { name: "Wed", visitors: 5000, bounce: 45 },
    { name: "Thu", visitors: 2780, bounce: 28 },
    { name: "Fri", visitors: 1890, bounce: 22 },
    { name: "Sat", visitors: 2390, bounce: 25 },
    { name: "Sun", visitors: 3490, bounce: 35 },
  ]);

  const [counter, setCounter] = useState(0);
  const [activeMetric, setActiveMetric] = useState("visitors");

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lucide.Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">Interactive Preview</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">AI UI Builder Workspace</h2>
          <p className="text-slate-400 text-xs mt-0.5">Use the chat panel on the right to dynamically regenerate this dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCounter(c => c + 1)}
            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 transition-all font-semibold rounded-lg shadow-md hover:shadow-indigo-500/20 flex items-center gap-2 text-sm cursor-pointer"
          >
            <Lucide.Flame className="w-4 h-4 text-orange-400 animate-bounce" />
            Interactive clicks: {counter}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setActiveMetric("visitors")}
          className={\`p-4 rounded-xl border transition-all cursor-pointer \${activeMetric === "visitors" ? "bg-indigo-950/30 border-indigo-500" : "bg-slate-900/40 border-slate-800 hover:border-slate-700"}\`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400 font-medium">Daily Visitors</span>
            <Lucide.Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold">3,490</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <Lucide.ArrowUpRight className="w-3 h-3" />
            <span>+12.4% vs last week</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveMetric("bounce")}
          className={\`p-4 rounded-xl border transition-all cursor-pointer \${activeMetric === "bounce" ? "bg-indigo-950/30 border-indigo-500" : "bg-slate-900/40 border-slate-800 hover:border-slate-700"}\`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400 font-medium">Average Bounce Rate</span>
            <Lucide.Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold">32.1%</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <Lucide.ArrowDownRight className="w-3 h-3" />
            <span>-4.2% bounce rate reduction</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-slate-900/40 border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400 font-medium">System Health</span>
            <Lucide.ShieldCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold">99.99%</div>
          <div className="text-xs text-teal-400 mt-1">Operational (2ms latency)</div>
        </div>
      </div>

      {/* Chart Visualizer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-4 text-slate-300">
          Analytics Overview - Weekly Trends ({activeMetric === "visitors" ? "Visitors" : "Bounce Rate"})
        </h3>
        <div className="h-64 w-full">
          <Recharts.ResponsiveContainer width="100%" height="100%">
            <Recharts.AreaChart data={metrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Recharts.XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Recharts.YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Recharts.Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9" }}
                itemStyle={{ color: "#818cf8" }}
              />
              <Recharts.Area 
                type="monotone" 
                dataKey={activeMetric} 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorVis)" 
              />
            </Recharts.AreaChart>
          </Recharts.ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}`;

// ==========================================
// MAIN WORKSPACE PAGE COMPONENT
// ==========================================

export default function UIBuilderPage() {
  const [babel, setBabel] = useState<any>(null);
  const [componentCode, setComponentCode] = useState<string>(DEFAULT_INITIAL_CODE);
  const [resetKey, setResetKey] = useState<number>(0);

  // Layout selection triggers
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "logs">("preview");
  const [deviceWidth, setDeviceWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  
  // Chat messaging systems
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "model",
      text: "Hello! I am your AI layout builder assistant. Describe the component or interface design you need, and I will generate the code and build it directly inside the workspace preview.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Console logging state
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Dynamic Suggestion Cards
  const suggestedPrompts: SuggestedPrompt[] = [
    {
      label: "Pricing Tiers",
      prompt: "Create a modern landing page pricing section with 3 cards (Standard, Premium, Enterprise), a monthly/yearly toggle state, and clean checkout button actions.",
      icon: "BadgeDollarSign",
    },
    {
      label: "User Profile Card",
      prompt: "Build an interactive User Profile Card displaying account metrics, social connections, bio details, and a functional modal when clicking a 'View Details' button.",
      icon: "UserCircle",
    },
    {
      label: "Project Board",
      prompt: "Create a simple interactive Kanban Board featuring 3 columns (To Do, In Progress, Complete) with support to add new cards to columns and buttons to advance cards to the next column.",
      icon: "Kanban",
    },
    {
      label: "Registration Form",
      prompt: "Build a sleek multi-step signup wizard form with validation indicators, dynamic progress meter, and responsive inputs.",
      icon: "FileCheck",
    },
  ];

  // Load Babel Standalone on Client mount
  useEffect(() => {
    console.log("[UI_BUILDER] Loading Babel Standalone compiler client-side...");
    import("@babel/standalone")
      .then((BabelInstance) => {
        setBabel(BabelInstance);
        addLog("success", "Babel standalone loaded. Dynamic JSX compilation initialized.");
      })
      .catch((error) => {
        console.error("[UI_BUILDER_BABEL_LOAD_ERROR]", error);
        addLog("error", `Failed to load compiler: ${error.message}`);
      });
  }, []);

  // Scroll Chat to Bottom on updates
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Log appending callback helper
  const addLog = useCallback((type: "info" | "success" | "error", message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [
      ...prevLogs,
      { id: Math.random().toString(), type, message, timestamp },
    ]);
  }, []);

  // Form submission and API trigger
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsGenerating(true);
    addLog("info", `Requesting UI generation from Gemini API...`);

    try {
      // Map conversation format for context retention
      const historyContext = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          history: historyContext,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Server responded with an error.");
      }

      const data = await response.json();

      if (!data.code) {
        throw new Error("API succeeded but returned no executable component code.");
      }

      // Add Model reply
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: `I've generated the React component code based on your prompt. Check out the live rendering inside the preview workspace panel!`,
        },
      ]);

      // Set code and force re-compile
      setComponentCode(data.code);
      setResetKey((k) => k + 1);
      setActiveTab("preview");
      addLog("success", "Generated code received successfully from Gemini API.");
    } catch (error: any) {
      console.error("[FETCH_UI_GEN_ERROR]", error);
      addLog("error", `UI Generation failed: ${error.message || String(error)}`);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: `Sorry, I ran into an error generating that interface: ${error.message || String(error)}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(componentCode);
    addLog("info", "Component source code copied to clipboard.");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-900 bg-slate-950/60 px-6 py-4 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/30 text-indigo-400">
            <Lucide.Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
              Interactive AI UI Builder Workspace
            </h1>
            <p className="text-[10px] text-slate-400/80">Gemini-Powered Instant Prototyping Sandbox</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-900/50 border-slate-800 text-slate-400 gap-1.5 py-1 px-2.5 font-normal text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${babel ? "bg-emerald-500 animate-ping" : "bg-amber-500 animate-pulse"}`} />
              {babel ? "Babel Compiler Active" : "Babel Core Loading..."}
            </Badge>
            <Badge variant="outline" className="bg-slate-900/50 border-slate-800 text-slate-400 gap-1.5 py-1 px-2.5 font-normal text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Gemini model connected
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden max-h-[calc(100vh-73px)]">
        
        {/* Left Workspace Panel (Preview, Code & Logs) */}
        <section className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-900 bg-slate-900/10 overflow-hidden">
          
          {/* Workspace Tab Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-900 bg-slate-950/20">
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                id="tab-preview-btn"
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "preview" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Lucide.Play className="w-3.5 h-3.5 text-indigo-400" />
                Live Preview
              </button>
              <button
                id="tab-code-btn"
                onClick={() => setActiveTab("code")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "code" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Lucide.Code2 className="w-3.5 h-3.5 text-indigo-400" />
                Source Code
              </button>
              <button
                id="tab-logs-btn"
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "logs" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Lucide.Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Console Logs
                {logs.some(l => l.type === "error") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            </div>

            {/* Canvas Resizer Controls */}
            {activeTab === "preview" && (
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 gap-0.5">
                <button
                  id="device-desktop-btn"
                  onClick={() => setDeviceWidth("desktop")}
                  title="Desktop View"
                  className={`p-1.5 rounded transition-all cursor-pointer ${deviceWidth === "desktop" ? "bg-slate-900 text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Lucide.Monitor className="w-4 h-4" />
                </button>
                <button
                  id="device-tablet-btn"
                  onClick={() => setDeviceWidth("tablet")}
                  title="Tablet View"
                  className={`p-1.5 rounded transition-all cursor-pointer ${deviceWidth === "tablet" ? "bg-slate-900 text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Lucide.Tablet className="w-4 h-4" />
                </button>
                <button
                  id="device-mobile-btn"
                  onClick={() => setDeviceWidth("mobile")}
                  title="Mobile View"
                  className={`p-1.5 rounded transition-all cursor-pointer ${deviceWidth === "mobile" ? "bg-slate-900 text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Lucide.Smartphone className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Code Utilities */}
            {activeTab === "code" && (
              <Button
                id="copy-code-btn"
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300 text-xs gap-1.5 py-1 px-3"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                Copy
              </Button>
            )}

            {/* Logs Clear Trigger */}
            {activeTab === "logs" && (
              <Button
                id="clear-logs-btn"
                variant="outline"
                size="sm"
                onClick={() => setLogs([])}
                className="bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300 text-xs gap-1.5 py-1 px-3"
              >
                <Lucide.Trash2 className="w-3.5 h-3.5 text-slate-400" />
                Clear Logs
              </Button>
            )}
          </div>

          {/* Interactive Workspace Panel Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-start">
            
            {/* 1. PREVIEW TAB */}
            {activeTab === "preview" && (
              <div className="w-full flex justify-center items-start min-h-full">
                <div 
                  className={`transition-all duration-300 w-full ${
                    deviceWidth === "mobile" ? "max-w-[375px] border-x border-slate-800 shadow-2xl rounded-2xl bg-slate-950/20" : 
                    deviceWidth === "tablet" ? "max-w-[768px] border-x border-slate-800 shadow-2xl rounded-2xl bg-slate-950/20" : 
                    "w-full"
                  }`}
                >
                  {/* Smartphone/Tablet Frame Top Bar Indicator */}
                  {deviceWidth !== "desktop" && (
                    <div className="flex items-center justify-between px-6 py-2 border-b border-slate-850/80 text-[10px] text-slate-500 font-mono bg-slate-950/50 rounded-t-2xl">
                      <div className="flex items-center gap-1.5">
                        <Lucide.Clock className="w-3 h-3 text-slate-600" />
                        <span>18:22</span>
                      </div>
                      <span className="font-semibold text-slate-450 uppercase">{deviceWidth} mode</span>
                      <div className="flex items-center gap-1">
                        <Lucide.Wifi className="w-3 h-3 text-slate-600" />
                        <Lucide.BatteryCharging className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`${deviceWidth !== "desktop" ? "p-4 min-h-[500px]" : "w-full"}`}>
                    <PreviewArea
                      code={componentCode}
                      babel={babel}
                      onLog={addLog}
                      resetKey={resetKey}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. CODE TAB */}
            {activeTab === "code" && (
              <div className="w-full min-h-full flex flex-col">
                <div className="flex-1 font-mono text-xs text-indigo-300 bg-slate-950/80 border border-slate-900 rounded-xl p-5 overflow-auto max-h-[calc(100vh-210px)] select-text shadow-inner">
                  <pre className="whitespace-pre-wrap leading-relaxed select-text">
                    {componentCode}
                  </pre>
                </div>
              </div>
            )}

            {/* 3. LOGS TAB */}
            {activeTab === "logs" && (
              <div className="w-full min-h-full flex flex-col bg-slate-950/90 border border-slate-900 rounded-xl p-5 font-mono text-xs overflow-auto max-h-[calc(100vh-210px)]">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-550">
                    <Lucide.Terminal className="w-8 h-8 mb-2 text-slate-700" />
                    <span>Console log buffer is empty</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 border-b border-slate-900/40 pb-2">
                        <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 uppercase font-bold text-[9px] py-0.5 px-1.5 ${
                            log.type === "success" ? "border-emerald-500/20 text-emerald-400 bg-emerald-950/10" :
                            log.type === "error" ? "border-red-500/20 text-red-400 bg-red-950/10" :
                            "border-indigo-500/20 text-indigo-400 bg-indigo-950/10"
                          }`}
                        >
                          {log.type}
                        </Badge>
                        <span className={`leading-relaxed break-all ${
                          log.type === "error" ? "text-red-300" :
                          log.type === "success" ? "text-emerald-300" :
                          "text-slate-300"
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Side Chat panel */}
        <section className="w-full lg:w-[380px] shrink-0 bg-slate-950 border-t lg:border-t-0 border-slate-900 flex flex-col justify-between overflow-hidden max-h-[500px] lg:max-h-none">
          
          {/* Chat Panel Title */}
          <div className="px-5 py-4 border-b border-slate-900 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Lucide.MessageSquareQuote className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold tracking-wide">Design Companion</h2>
            </div>
            {isGenerating && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                <Lucide.Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </div>
            )}
          </div>

          {/* Chat Messages Feed Area */}
          <ScrollArea className="flex-1 p-5 overflow-y-auto min-h-[150px]">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col max-w-[85%] ${message.role === "user" ? "self-end items-end" : "self-start items-start"}`}
                >
                  {/* Sender Tag */}
                  <span className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wide">
                    {message.role === "user" ? "You" : "Gemini Pro"}
                  </span>
                  {/* Message Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow ${
                      message.role === "user"
                        ? "bg-indigo-650 text-white rounded-tr-none border border-indigo-550/40"
                        : "bg-slate-900 text-slate-200 border border-slate-800/80 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap select-text">{message.text}</p>
                  </div>
                </div>
              ))}
              
              {/* Generation Loader Animation */}
              {isGenerating && (
                <div className="flex flex-col max-w-[85%] self-start items-start">
                  <span className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wide">Gemini Pro</span>
                  <div className="p-3.5 bg-slate-900 text-slate-200 border border-slate-800/80 rounded-2xl rounded-tl-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {/* Suggestions Cards (Shown when history has only the initial greet) */}
              {messages.length === 1 && !isGenerating && (
                <div className="mt-4 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Quick Starters</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {suggestedPrompts.map((starter) => (
                      <Card
                        key={starter.label}
                        onClick={() => handleSendMessage(starter.prompt)}
                        className="bg-slate-900/40 hover:bg-slate-900 border-slate-900 hover:border-slate-850 cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        <CardContent className="p-3.5 flex items-start gap-3">
                          <div className="p-1.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-indigo-400 shrink-0">
                            {starter.icon === "BadgeDollarSign" && <Lucide.BadgeDollarSign className="w-4 h-4" />}
                            {starter.icon === "UserCircle" && <Lucide.UserCircle className="w-4 h-4" />}
                            {starter.icon === "Kanban" && <Lucide.Kanban className="w-4 h-4" />}
                            {starter.icon === "FileCheck" && <Lucide.FileCheck className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200 mb-0.5">{starter.label}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{starter.prompt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              <div ref={chatBottomRef} />
            </div>
          </ScrollArea>

          {/* Chat Input Section */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/60 flex items-end gap-2.5">
            <Textarea
              id="prompt-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Describe a component layout..."
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputMessage);
                }
              }}
              className="resize-none min-h-[40px] max-h-[120px] bg-slate-900/50 border-slate-850 hover:border-slate-800 focus-visible:border-slate-700 py-2.5 text-xs rounded-xl pr-3"
            />
            <Button
              id="send-prompt-btn"
              onClick={() => handleSendMessage(inputMessage)}
              disabled={!inputMessage.trim() || isGenerating}
              size="icon"
              className="bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl shadow cursor-pointer h-10 w-10 shrink-0"
            >
              <Lucide.SendHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </section>

      </main>
    </div>
  );
}
