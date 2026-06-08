"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Compass, 
  Settings, 
  Code, 
  Map, 
  Copy, 
  Check, 
  Play, 
  Info, 
  Bot, 
  Activity, 
  Layers, 
  ExternalLink 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Route Map Nodes definition
type RouteNode = {
  id: string;
  name: string;
  path: string;
  description: string;
  queries: string[];
  selectors: string[];
  x: number;
  y: number;
};

const NODES: RouteNode[] = [
  {
    id: "home",
    name: "Hub Dashboard",
    path: "/",
    description: "The main gateway of Inqora, showcasing quick links and system overview.",
    queries: ["go home", "view entry", "main hub"],
    selectors: ["body"],
    x: 150,
    y: 100,
  },
  {
    id: "chat",
    name: "AI Cognitive Chat",
    path: "/chat",
    description: "Speak with general, legal, research, and budget cognitive assistant models.",
    queries: ["ask a question", "start a chat", "analyze text context"],
    selectors: ['[data-tour="chat-sidebar"]', '[data-tour="chat-models"]', '[data-tour="chat-upload"]', '[data-tour="chat-textarea"]'],
    x: 450,
    y: 100,
  },
  {
    id: "panel",
    name: "Agent Panel",
    path: "/panel",
    description: "Initialize multiple autonomous agent personas and simulate crisis stress.",
    queries: ["simulate agent stress", "initialize candidate election", "change instance count"],
    selectors: ['[data-tour="panel-instances"]', '[data-tour="panel-init"]', '[data-tour="panel-stress"]', '[data-tour="panel-logs"]'],
    x: 450,
    y: 280,
  },
  {
    id: "image-memory",
    name: "Memory Vault",
    path: "/image-memory",
    description: "Browse uploaded visual photos, identified identities, and timeline graphs.",
    queries: ["view uploaded photos", "inspect face relationships", "check event timeline"],
    selectors: ['[data-tour="vault-upload"]', '[data-tour="vault-search"]', '[data-tour="vault-tabs"]', '[data-tour="vault-sync"]'],
    x: 150,
    y: 280,
  },
  {
    id: "onboarding",
    name: "Onboarding Config",
    path: "/onboarding",
    description: "The business onboarding configurator. Adjust floating widgets and map routes.",
    queries: ["configure widget style", "read embed code", "run guided test"],
    selectors: ["canvas", ".config-panel"],
    x: 300,
    y: 190,
  }
];

export default function OnboardingConfigurator() {
  const [selectedNode, setSelectedNode] = useState<RouteNode | null>(NODES[1] || null);
  const [config, setConfig] = useState({
    theme: "glass",
    color: "#3b82f6",
    position: "right",
  });
  const [copied, setCopied] = useState(false);

  // Sync state to localStorage to live-update the OnboardingWidget overlay
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_widget_config");
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  const updateConfig = (key: string, value: string) => {
    const nextConfig = { ...config, [key]: value };
    setConfig(nextConfig);
    localStorage.setItem("onboarding_widget_config", JSON.stringify(nextConfig));
    // Dispatch storage event manually so other components on this page immediately re-render
    window.dispatchEvent(new Event("storage"));
  };

  const copyEmbedCode = () => {
    const snippet = `<!-- Inqora Onboarding Guide Embed Snippet -->
<script 
  src="https://cdn.inqora.com/onboarding-widget.js" 
  data-accent-color="${config.color}" 
  data-theme="${config.theme}" 
  data-position="bottom-${config.position}" 
  async>
</script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testTour = (tourId: string) => {
    localStorage.setItem("active_tour", tourId);
    localStorage.setItem("active_tour_step", "0");
    // Force immediate sync
    window.location.href = tourId === "chat" ? "/chat" : tourId === "stress" ? "/panel" : "/image-memory";
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-800 bg-[#0e1424]/90 backdrop-blur px-8">
        <div className="flex items-center gap-2 font-semibold">
          <Compass className="h-5 w-5 text-blue-500 animate-spin-slow" />
          <span className="text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Customer Onboarding Portal
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/5">
            Configurator Active
          </Badge>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-8 space-y-8 max-w-[1400px] mx-auto w-full">
        {/* Intro */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Business Onboarding Configurator
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm">
            Map out customer paths, customize the floating guides, and generate HTML script modules to deploy interactive tours onto your website.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Map & Details */}
          <div className="lg:col-span-8 space-y-8">
            {/* Interactive SVG Route Map */}
            <Card className="bg-[#0e1424] border-slate-800 shadow-2xl relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-md flex items-center gap-2 text-white">
                  <Map className="size-4 text-blue-400" />
                  Application Route Topology Map
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  A dynamic flow visualization of Inqora's active system routes. Click nodes to view onboarding details.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-6">
                <div className="relative w-[600px] h-[380px] bg-slate-950/40 border border-slate-800/80 rounded-xl overflow-hidden p-4">
                  {/* SVG connections drawing */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                    {/* Connections */}
                    <line x1="150" y1="100" x2="450" y2="100" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="5,5" />
                    <line x1="450" y1="100" x2="450" y2="280" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="5,5" />
                    <line x1="450" y1="280" x2="150" y2="280" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="5,5" />
                    <line x1="150" y1="280" x2="150" y2="100" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="5,5" />
                    {/* Hub to Config */}
                    <line x1="150" y1="100" x2="300" y2="190" stroke="url(#lineGrad)" strokeWidth="2" />
                    <line x1="450" y1="100" x2="300" y2="190" stroke="url(#lineGrad)" strokeWidth="2" />
                    <line x1="450" y1="280" x2="300" y2="190" stroke="url(#lineGrad)" strokeWidth="2" />
                    <line x1="150" y1="280" x2="300" y2="190" stroke="url(#lineGrad)" strokeWidth="2" />
                  </svg>

                  {/* Nodes Render */}
                  {NODES.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <motion.button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          left: node.x - 65,
                          top: node.y - 25,
                        }}
                        className={`absolute w-32 h-12 rounded-xl flex flex-col justify-center items-center font-semibold text-xs border transition-all cursor-pointer shadow-lg ${
                          isSelected
                            ? "bg-gradient-to-r from-blue-600/35 to-indigo-600/35 border-blue-500 text-white shadow-blue-500/10"
                            : "bg-[#111827]/80 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span>{node.name}</span>
                        <span className="text-[9px] opacity-50 font-mono tracking-tighter mt-0.5">{node.path}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Inspector Panel */}
            {selectedNode && (
              <Card className="bg-[#0e1424] border-slate-800 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white text-md font-bold flex items-center gap-2">
                        <Layers className="size-4 text-blue-400" />
                        Onboarding Specs: {selectedNode.name}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Configured targets and customer trigger options.
                      </CardDescription>
                    </div>
                    {selectedNode.id !== "home" && selectedNode.id !== "onboarding" && (
                      <Button
                        size="sm"
                        onClick={() => testTour(selectedNode.id === "chat" ? "chat" : selectedNode.id === "panel" ? "stress" : "vault")}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 cursor-pointer"
                      >
                        <Play className="size-3 mr-1" />
                        Run Guided Test
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1">Route Purpose</h4>
                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      {selectedNode.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Bot className="size-3 text-emerald-400" />
                        Intent Keywords Matching
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.queries.map((q) => (
                          <Badge key={q} variant="secondary" className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {q}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Settings className="size-3 text-indigo-400" />
                        Target Elements Tagged
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.selectors.map((s) => (
                          <Badge key={s} variant="outline" className="border-slate-800 text-slate-400 font-mono text-[9px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Customizer & Embed Script */}
          <div className="lg:col-span-4 space-y-8">
            {/* Widget customizer */}
            <Card className="bg-[#0e1424] border-slate-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white text-md flex items-center gap-2">
                  <Settings className="size-4 text-blue-400" />
                  Widget Customizer
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Change the floating assistant style on this site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Theme selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                    Visual Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["glass", "neon", "dark"].map((t) => (
                      <button
                        key={t}
                        onClick={() => updateConfig("theme", t)}
                        className={`py-1.5 text-xs rounded-lg border font-semibold capitalize cursor-pointer transition-colors ${
                          config.theme === t
                            ? "bg-blue-600/20 border-blue-500 text-blue-400"
                            : "bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                    Neon Accent Color
                  </label>
                  <div className="flex gap-2">
                    {[
                      { hex: "#3b82f6", name: "Blue" },
                      { hex: "#10b981", name: "Green" },
                      { hex: "#f43f5e", name: "Rose" },
                      { hex: "#f59e0b", name: "Amber" },
                      { hex: "#8b5cf6", name: "Purple" }
                    ].map((col) => (
                      <button
                        key={col.hex}
                        onClick={() => updateConfig("color", col.hex)}
                        title={col.name}
                        style={{ backgroundColor: col.hex }}
                        className={`size-6 rounded-full border cursor-pointer hover:scale-110 transition-transform ${
                          config.color === col.hex ? "ring-2 ring-white border-slate-950" : "border-slate-800"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Position selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                    Screen Position
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "left", label: "Bottom Left" },
                      { val: "right", label: "Bottom Right" }
                    ].map((pos) => (
                      <button
                        key={pos.val}
                        onClick={() => updateConfig("position", pos.val)}
                        className={`py-1.5 text-xs rounded-lg border font-semibold cursor-pointer transition-colors ${
                          config.position === pos.val
                            ? "bg-blue-600/20 border-blue-500 text-blue-400"
                            : "bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Embed Generator */}
            <Card className="bg-[#0e1424] border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="bg-slate-900/50">
                <CardTitle className="text-white text-md flex items-center gap-2">
                  <Code className="size-4 text-blue-400" />
                  Integration Script
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Copy this embed snippet to load Inqora Onboarding guide on any other business site.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <pre className="text-[10px] font-mono bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-blue-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {`<!-- Inqora Onboarding Guide Embed Snippet -->
<script 
  src="https://cdn.inqora.com/onboarding-widget.js" 
  data-accent-color="${config.color}" 
  data-theme="${config.theme}" 
  data-position="bottom-${config.position}" 
  async>
</script>`}
                  </pre>
                  <button
                    onClick={copyEmbedCode}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <div className="flex items-start gap-2 text-[10px] text-slate-400 bg-blue-500/5 p-2.5 rounded border border-blue-500/10">
                  <Info className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>The script will automatically initiate the floating guide widget and load the CSS arrow layouts relative to elements mapped.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
