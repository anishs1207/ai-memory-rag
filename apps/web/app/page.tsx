"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Database,
  Network,
  ArrowRight,
  Sparkles,
  Eye,
  Mic,
  Terminal,
  Play,
  RotateCcw,
  Check,
  Copy,
  ExternalLink,
  Layers,
  Activity,
  MapPin,
  Lock,
  Code
} from "lucide-react";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Button } from "@/components/ui/button";

// Code Snippets for Developer tab
const CODE_SNIPPETS = {
  initialization: `import { InqoraMemory } from "@inqora/sdk";

// Initialize multi-tier agent memory engine
const memory = new InqoraMemory({
  apiKey: process.env.INQORA_API_KEY,
  tiers: {
    working: { maxTokens: 4096 },
    vector: { provider: "pinecone", index: "agent-memories" },
    graph: { provider: "neo4j", url: "bolt://localhost:7687" }
  }
});`,
  ingestion: `// Store memories with automated entity extraction
await memory.save({
  role: "user",
  content: "Anish's favorite language is TypeScript, and he is building Inqora.",
  metadata: {
    source: "voice-overlay",
    timestamp: new Date()
  }
});`,
  retrieval: `// Query cognitive tiers in parallel with decay scoring
const context = await memory.query({
  prompt: "What language does Anish build in?",
  minConfidence: 0.80
});

console.log(context.sources);
// Returns: ['short-term', 'vector:pinecone', 'graph:neo4j']`
};

export default function Page() {
  // Simulator State
  const [queryInput, setQueryInput] = useState(
    "What project is Anish building, and does he use TypeScript?"
  );
  const [simulationState, setSimulationState] = useState<"idle" | "short-term" | "vector" | "graph" | "complete">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [activeCodeTab, setActiveCodeTab] = useState<"initialization" | "ingestion" | "retrieval">("initialization");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Auto-scroll simulation logs
  useEffect(() => {
    if (simulationState === "idle") {
      setLogs([]);
    }
  }, [simulationState]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(CODE_SNIPPETS[activeCodeTab]);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const runSimulation = () => {
    if (!queryInput.trim()) return;

    setSimulationState("short-term");
    setLogs(["[Working Memory] Parsing active user message tokens...", "[Working Memory] Identified entity candidates: 'Anish', 'TypeScript', 'Inqora'."]);

    setTimeout(() => {
      setSimulationState("vector");
      setLogs(prev => [
        ...prev,
        "[Semantic Vector] Formulating embeddings via Gemini Text model...",
        "[Semantic Vector] Querying Pinecone vectors (Top-K=3, Threshold=0.75)...",
        "[Semantic Vector] Retrieval Match: 'Inqora framework announcement' (Decay Weight: 0.89)."
      ]);
    }, 1500);

    setTimeout(() => {
      setSimulationState("graph");
      setLogs(prev => [
        ...prev,
        "[Knowledge Graph] Inspecting Neo4j entity relations...",
        "[Knowledge Graph] Resolved node relation: (Anish:Person) -[:BUILDS]-> (Inqora:Framework)",
        "[Knowledge Graph] Resolved node relation: (Anish:Person) -[:USES]-> (TypeScript:Language)"
      ]);
    }, 3200);

    setTimeout(() => {
      setSimulationState("complete");
      setLogs(prev => [
        ...prev,
        "✨ Memory Cascade query complete.",
        "💡 Context compiled: 'Anish is building the Inqora AI Agent Memory Framework using TypeScript.'"
      ]);
    }, 4800);
  };

  const resetSimulation = () => {
    setSimulationState("idle");
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight font-sans">
              inqora
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#simulator" className="hover:text-foreground transition-colors">Simulator</a>
            <a href="#api" className="hover:text-foreground transition-colors">API Schema</a>
            <Link href="/onboarding" className="hover:text-foreground transition-colors">Onboarding</Link>
          </nav>

          <div className="flex items-center gap-3">
            <ModeToggle />
            <Link href="/chat" id="hero-cta-workspace">
              <Button size="sm" className="rounded-full shadow-sm cursor-pointer px-4 font-medium transition-transform hover:scale-[1.02]">
                Launch Workspace
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24 border-b border-border/50">
        {/* Abstract subtle background gradient */}
        <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-full max-w-7xl -translate-x-1/2 overflow-hidden px-4 opacity-30 dark:opacity-20 blur-3xl">
          <div className="aspect-[1108/632] w-[69.25rem] bg-gradient-to-r from-violet-500 to-indigo-600 opacity-20"></div>
        </div>

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span>Introducing Inqora Agentic Memory Tiers</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground font-sans max-w-4xl mx-auto leading-[1.1]"
          >
            The Cognitive Memory Layer <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:via-indigo-300 dark:to-purple-400">
              For Autonomous AI Agents
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-sans leading-relaxed"
          >
            An advanced cognitive memory framework bridging short-term context orchestration, decay-aware vector search, and structurally verified knowledge graphs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Link href="/chat">
              <Button size="lg" className="rounded-full shadow-md font-semibold px-6 cursor-pointer hover:shadow-lg transition-transform hover:scale-[1.01]" id="hero-cta-workspace-main">
                Launch Workspace
              </Button>
            </Link>
            <Link href="/image-memory" id="hero-cta-visuals">
              <Button size="lg" variant="outline" className="rounded-full font-semibold px-6 cursor-pointer hover:bg-muted transition-colors">
                Explore Visuals
              </Button>
            </Link>
            <a href="https://github.com/anishs1207/ai-memory" target="_blank" rel="noopener noreferrer" id="hero-cta-docs">
              <Button size="lg" variant="ghost" className="rounded-full text-muted-foreground font-semibold px-5 cursor-pointer hover:text-foreground">
                Developer Docs
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Interactive Memory Cascade Simulator */}
      <section id="simulator" className="py-20 bg-muted/30 border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight font-sans text-foreground">
              See the Memory Cascade in Action
            </h2>
            <p className="mt-4 text-muted-foreground">
              Simulate how Inqora routes agent queries across hierarchical cognitive databases in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Input & Control Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Test User Prompt
                </label>
                <div className="relative">
                  <textarea
                    id="sim-input-query"
                    className="w-full min-h-[100px] bg-muted/50 border border-border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Enter an agent query..."
                    disabled={simulationState !== "idle" && simulationState !== "complete"}
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    id="sim-btn-run"
                    className="flex-1 rounded-xl cursor-pointer"
                    disabled={simulationState !== "idle" && simulationState !== "complete"}
                    onClick={runSimulation}
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    Run Cascade
                  </Button>
                  {(simulationState !== "idle" && simulationState !== "complete") ? (
                    <Button
                      variant="outline"
                      className="rounded-xl flex-1 cursor-not-allowed opacity-50"
                      disabled
                    >
                      Processing...
                    </Button>
                  ) : (
                    <Button
                      id="sim-btn-reset"
                      variant="outline"
                      className="rounded-xl cursor-pointer"
                      onClick={resetSimulation}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Simulator Execution logs */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Terminal className="h-4 w-4" />
                    Cognitive Engine Logs
                  </div>
                  {simulationState !== "idle" && (
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${simulationState === "complete" ? "bg-emerald-400" : "bg-violet-400"}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${simulationState === "complete" ? "bg-emerald-500" : "bg-violet-500"}`}></span>
                    </span>
                  )}
                </div>
                <div className="bg-zinc-950 dark:bg-zinc-900 rounded-xl p-4 min-h-[180px] font-mono text-xs text-zinc-300 space-y-2 border border-zinc-800/80 overflow-y-auto">
                  {logs.length === 0 ? (
                    <span className="text-zinc-500 italic">Click "Run Cascade" to witness memory orchestration logs.</span>
                  ) : (
                    logs.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={log.startsWith("✨") || log.startsWith("💡") ? "text-violet-400 font-semibold mt-4" : ""}
                      >
                        {log}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Visual Steps representation */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col justify-between min-h-[460px]">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                <span className="text-sm font-semibold text-foreground">Visual Layer Architecture</span>
                <span className="text-xs bg-muted border border-border px-2.5 py-1 rounded-full text-muted-foreground font-medium">Cascade Sequence</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative flex-grow">
                {/* Connecting SVG arrows or layout lines */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 -z-10 hidden md:block" />

                {/* Tier 1: Working Memory */}
                <div className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 ${
                  simulationState === "short-term"
                    ? "bg-violet-500/10 border-violet-500 shadow-md scale-[1.02]"
                    : simulationState !== "idle"
                    ? "bg-muted/40 border-border opacity-70"
                    : "bg-card border-border"
                }`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full mb-4 ${
                    simulationState === "short-term" ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    <Activity className="h-6 w-6 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">1. Working Context</h4>
                  <p className="text-xs text-center text-muted-foreground">Rolling conversation history and instant summaries.</p>
                </div>

                {/* Tier 2: Vector Retrieval */}
                <div className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 ${
                  simulationState === "vector"
                    ? "bg-indigo-500/10 border-indigo-500 shadow-md scale-[1.02]"
                    : simulationState === "graph" || simulationState === "complete"
                    ? "bg-muted/40 border-border opacity-70"
                    : "bg-card border-border"
                }`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full mb-4 ${
                    simulationState === "vector" ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    <Database className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">2. Pinecone Vector</h4>
                  <p className="text-xs text-center text-muted-foreground">Semantic embeddings search with logarithmic decay decay.</p>
                </div>

                {/* Tier 3: Knowledge Graph */}
                <div className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 ${
                  simulationState === "graph"
                    ? "bg-purple-500/10 border-purple-500 shadow-md scale-[1.02]"
                    : simulationState === "complete"
                    ? "bg-purple-500/5 border-purple-500/30"
                    : "bg-card border-border"
                }`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full mb-4 ${
                    simulationState === "graph" ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    <Network className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">3. Neo4j Graph</h4>
                  <p className="text-xs text-center text-muted-foreground">Evidence-based relational extraction and link maps.</p>
                </div>
              </div>

              {/* Cognitive compiler result preview */}
              <AnimatePresence>
                {simulationState === "complete" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 text-xs flex gap-3 items-start"
                  >
                    <div className="h-5 w-5 rounded bg-violet-500/15 flex items-center justify-center text-violet-500 flex-shrink-0 mt-0.5">
                      <Sparkles className="h-3 w-3" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Result Synthesis:</span>
                      <p className="text-muted-foreground">
                        Inqora queried its tiers in parallel, resolved the entities, and compiled a memory-aware agent context for response construction.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid / Core Pillars */}
      <section id="features" className="py-20 border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight font-sans text-foreground">
              Built for production AI workflows
            </h2>
            <p className="mt-4 text-muted-foreground">
              A comprehensive system providing high-fidelity spatial overlays, visual tracking, and absolute stealth operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Hierarchical Multi-Tier Memory */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 mb-5">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Hierarchical Multi-Tier Memory</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Logarithmic memory decay simulates natural forgetting while pinecone vectors and Neo4j relations maintain verified factual relationships.
              </p>
            </div>

            {/* Feature 2: VLM Visual Intelligence */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-5">
                <Eye className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">VLM Visual Intelligence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Scene analysis, identity profile vaulting with face clustering, GPS coordinate tracking, and automatic daily neural journal drafts.
              </p>
            </div>

            {/* Feature 3: Voice stealth overlay */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-5">
                <Mic className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Voice Stealth Overlay</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Click-through toolbar with customizable transparency and overlay stealth which automatically hides itself during screen sharing sessions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer API section */}
      <section id="api" className="py-20 bg-muted/20 border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Context description */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Code className="h-3.5 w-3.5 text-indigo-500" />
                <span>Developer Sandbox</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground font-sans">
                Three lines of code to cognitive persistence
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Inqora provides a unified interface. You do not need to orchestrate vector indexes, graphs, and chat history manually. Define your configuration once and let Inqora route memories on auto-pilot.
              </p>
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-muted-foreground">TypeScript, Next.js, and Node compatible.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-muted-foreground">Auto-clustering pipelines built-in.</span>
                </div>
              </div>
            </div>

            {/* Code Block Tabs */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      id="code-tab-init"
                      className={`text-xs font-semibold py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                        activeCodeTab === "initialization"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveCodeTab("initialization")}
                    >
                      Init Tiers
                    </button>
                    <button
                      id="code-tab-store"
                      className={`text-xs font-semibold py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                        activeCodeTab === "ingestion"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveCodeTab("ingestion")}
                    >
                      Store Context
                    </button>
                    <button
                      id="code-tab-query"
                      className={`text-xs font-semibold py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                        activeCodeTab === "retrieval"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveCodeTab("retrieval")}
                    >
                      Cascade Query
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={handleCopyCode}
                  >
                    {copiedSnippet ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <div className="p-5 bg-zinc-950 dark:bg-zinc-900 border-t border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto min-h-[180px] leading-relaxed">
                  <pre>
                    <code>{CODE_SNIPPETS[activeCodeTab]}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 relative overflow-hidden bg-background">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
            Ready to integrate cognitive agent memory?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Get started by launching our memory chat dashboard and upload images to test clustering.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/chat">
              <Button size="lg" className="rounded-full shadow-md font-semibold px-6 cursor-pointer hover:shadow-lg transition-transform hover:scale-[1.01]">
                Launch Workspace
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button size="lg" variant="outline" className="rounded-full font-semibold px-6 cursor-pointer hover:bg-muted transition-colors">
                Configure Tiers
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <Brain className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-foreground">inqora</span>
          </div>
          <p>© 2026 Inqora Cognitive Memory Framework. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="https://github.com/anishs1207/ai-memory" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Github</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#simulator" className="hover:text-foreground transition-colors">Simulator</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
