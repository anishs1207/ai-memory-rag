import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  ChevronDown,
  BrainCircuit,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Zap,
  Navigation,
  Search,
  Globe,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  Camera,
  Trash2,
  MousePointer,
  SlidersHorizontal,
  Minimize2,
  Maximize2,
  ArrowLeft,
  ArrowRight,
  Loader,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { MarkdownRenderer } from './components/MarkdownRenderer';


function App() {
  // --- STATE DECLARATIONS ---
  const [showPanel, setShowPanel] = useState(true);
  const [isGuideMode, setIsGuideMode] = useState(false);
  const [arrowPos, setArrowPos] = useState({ x: -100, y: -100 });
  const [guideText, setGuideText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [aiResponse, setAiResponse] = useState<string>("Hello! I'm your Inqora AI assistant. Ask me anything about your screen, or toggle Guide Mode to have me show you the way.");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- NEW FEATURES STATES ---
  // Window layouts: 'toolbar' (compact bar), 'panel' (main dashboard), 'stealth' (overlay text), 'heyclicky' (webview portal)
  const [windowMode, setWindowMode] = useState<'toolbar' | 'panel' | 'stealth' | 'heyclicky'>('panel');
  // Transparency value linked to CSS --bg-opacity variable (0.15 to 0.95)
  const [bgOpacity, setBgOpacity] = useState<number>(0.75);
  // Pointer pass-through state (when true, clicks ignore Electron window outside active hovering)
  const [clickThrough, setClickThrough] = useState<boolean>(false);
  // Content protection state (when true, window is invisible in Zoom/Teams screen-sharing)
  const [contentProtected, setContentProtected] = useState<boolean>(false);
  // Current tab in the main panel: 'assist' (general chat), 'search' (quick lookup & meeting chips)
  const [activeTab, setActiveTab] = useState<'assist' | 'search'>('assist');
  // Visual base64 thumbnail of captured screenshot
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  // Auto-take screenshot right before sending to LLM
  const [autoAttachScreenshot, setAutoAttachScreenshot] = useState<boolean>(true);
  // Embedded HeyClicky loading state
  const [webviewLoading, setWebviewLoading] = useState<boolean>(true);

  // Browser navigation state for HeyClicky webview
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>("https://www.heyclicky.com/");

  // Cluely-style voice overlay sub-mode: 'cly' (custom overlay) or 'webview' (embedded heyclicky.com portal)
  const [clickySubMode, setClickySubMode] = useState<'cly' | 'webview'>('cly');
  // State for recording system application execution outcomes
  interface ExecutionLog {
    command: string;
    timestamp: string;
    status: 'success' | 'failed';
    details: string;
  }
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  // Status state of Clicky overlay ("Idle", "Listening...", "Executing...", etc.)
  const [clickyStatus, setClickyStatus] = useState<string>("Idle");

  // Speech Recognition states
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });

  // --- REFS ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webviewRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // --- EFFECTS ---
  // Apply transparency variable to stylesheet
  useEffect(() => {
    document.documentElement.style.setProperty('--bg-opacity', bgOpacity.toString());
  }, [bgOpacity]);

  // Sync window size on mode changes
  useEffect(() => {
    if (windowMode === 'toolbar') {
      window.electron.setWindowSize(800, 65);
    } else if (windowMode === 'stealth') {
      window.electron.setWindowSize(460, 300);
    } else if (windowMode === 'panel') {
      window.electron.setWindowSize(800, 520);
    } else if (windowMode === 'heyclicky') {
      if (clickySubMode === 'cly') {
        window.electron.setWindowSize(450, 520);
      } else {
        window.electron.setWindowSize(1000, 750);
      }
    }
  }, [windowMode, clickySubMode]);


  // Sync content protection to native Electron layer
  useEffect(() => {
    window.electron.setContentProtection(contentProtected);
  }, [contentProtected]);

  // Sync click-through pass-through state on state toggle
  useEffect(() => {
    window.electron.setIgnoreMouseEvents(clickThrough, { forward: true });
  }, [clickThrough]);

  // --- WEBVIEW NAVIGATION HANDLERS ---
  const handleWebviewLoadStop = () => {
    setWebviewLoading(false);
    if (webviewRef.current) {
      try {
        setCanGoBack(webviewRef.current.canGoBack());
        setCanGoForward(webviewRef.current.canGoForward());
        setCurrentUrl(webviewRef.current.getURL());
      } catch (err) {
        console.error("Webview navigation query error:", err);
      }
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.addEventListener('did-stop-loading', handleWebviewLoadStop);
      webview.addEventListener('did-start-loading', () => setWebviewLoading(true));
      return () => {
        webview.removeEventListener('did-stop-loading', handleWebviewLoadStop);
        webview.removeEventListener('did-start-loading', () => setWebviewLoading(true));
      };
    }
  }, [windowMode]); // Reload listeners on mode switch to bind to fresh webview node

  const handleWebviewBack = () => {
    if (webviewRef.current && canGoBack) webviewRef.current.goBack();
  };

  const handleWebviewForward = () => {
    if (webviewRef.current && canGoForward) webviewRef.current.goForward();
  };

  const handleWebviewReload = () => {
    if (webviewRef.current) webviewRef.current.reload();
  };

  // --- AUDIO SYNTHESIS ---
  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- CAPTURE SCREENSHOT CONTROLS ---
  const takeManualScreenshot = async () => {
    try {
      setIsAiLoading(true);
      const screenshot = await window.electron.captureScreen();
      setCapturedScreenshot(screenshot);
    } catch (err) {
      console.error("Manual capture failed:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const clearScreenshot = () => {
    setCapturedScreenshot(null);
  };

  // Helper to obtain screenshot base64 data depending on state
  const getScreenContext = async (): Promise<string | null> => {
    if (capturedScreenshot) {
      return capturedScreenshot.split(',')[1];
    }
    if (autoAttachScreenshot) {
      try {
        const screenshot = await window.electron.captureScreen();
        if (screenshot) {
          return screenshot.split(',')[1];
        }
      } catch (err) {
        console.error("Auto context capture failed:", err);
      }
    }
    return null;
  };

  // --- AI INTERACTION HANDLERS ---
  const handleGuideSearch = useCallback(async (customPrompt?: string) => {
    const query = customPrompt || inputValue;
    if (!query) return;
    setIsAiLoading(true);
    setGuideText("Scanning screen...");

    try {
      // Guide mode always requires a screen screenshot to fetch coordinates
      const base64Data = await getScreenContext() || (await window.electron.captureScreen()).split(',')[1];

      const prompt = `The user wants to know: "${query}". 
      Analyze the provided screenshot and find the exact location of the UI element or information they need. 
      Answer in 1 short sentence and provide the coordinate [x, y] in percentages (0-100) of where I should point.
      Be as precise as possible.
      Example: "The settings button is here. [92, 4]"`;

      const response = await window.electron.geminiVision(prompt, base64Data);

      const coordMatch = response.match(/\[(\d+),\s*(\d+)\]/);
      if (coordMatch) {
        const xPercent = parseInt(coordMatch[1]);
        const yPercent = parseInt(coordMatch[2]);
        setArrowPos({
          x: (xPercent / 100) * window.innerWidth,
          y: (yPercent / 100) * window.innerHeight
        });
      } else {
        setArrowPos({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight });
      }

      const cleanResponse = response.replace(/\[\d+,\s*\d+\]/, '').trim();
      setGuideText(cleanResponse);
      speak(cleanResponse);
      setCapturedScreenshot(null);
    } catch (err) {
      console.error('Guide error:', err);
      setGuideText("Sorry, I couldn't see your screen properly.");
    } finally {
      setIsAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, capturedScreenshot, autoAttachScreenshot, speak]);

  const handleAssist = useCallback(async (customPrompt?: string) => {
    const query = customPrompt || inputValue;
    if (!query && !capturedScreenshot && !autoAttachScreenshot) return;
    setIsAiLoading(true);

    try {
      const base64Data = await getScreenContext();
      let response = "";

      if (base64Data) {
        const prompt = query || "Summarize what you see on my screen in a few helpful bullet points.";
        response = await window.electron.geminiVision(prompt, base64Data);
      } else {
        if (!query) return;
        response = await window.electron.geminiChat(query);
      }

      setAiResponse(response);
      speak(response);
      setCapturedScreenshot(null);
    } catch (err) {
      console.error('Assist error:', err);
      setAiResponse("Sorry, I had trouble reaching the AI service.");
    } finally {
      setIsAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, capturedScreenshot, autoAttachScreenshot, speak]);

  const handleSmart = async () => {
    if (!inputValue) return;
    setIsAiLoading(true);
    try {
      const response = await window.electron.gemmaChat(inputValue);
      setAiResponse(response);
      speak(response);
    } catch (err) {
      console.error('Smart error:', err);
      setAiResponse("Sorry, I had trouble reaching Gemma.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTemplateClick = async (promptText: string) => {
    setInputValue(promptText);
    await handleAssist(promptText);
  };

  // --- SYSTEM APPLICATION LAUNCH EXECUTOR ---
  const handleSystemExecution = async (query: string) => {
    let command = query.toLowerCase().trim();
    
    // Clean common prefixes (e.g. "open chrome please" -> "chrome")
    const prefixes = ['open ', 'launch ', 'start ', 'run ', 'please '];
    for (const prefix of prefixes) {
      if (command.startsWith(prefix)) {
        command = command.substring(prefix.length).trim();
      }
    }
    command = command.replace(/\bplease\b/g, '').trim();

    let appName = '';
    // Check regex matches first for speed and local certainty
    if (/notepad/.test(command)) {
      appName = 'notepad';
    } else if (/calc|calculator/.test(command)) {
      appName = 'calc';
    } else if (/chrome|browser|google/.test(command)) {
      appName = 'chrome';
    } else if (/edge/.test(command)) {
      appName = 'edge';
    } else if (/paint|mspaint/.test(command)) {
      appName = 'paint';
    } else if (/explorer|file explorer/.test(command)) {
      appName = 'explorer';
    } else if (/terminal|cmd|command prompt/.test(command)) {
      appName = 'terminal';
    } else if (/powershell/.test(command)) {
      appName = 'powershell';
    } else if (/^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(command)) {
      let url = command;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      appName = url;
    }

    // Fallback: Ask local Gemma model to parse application name from conversational text
    if (!appName) {
      try {
        const extractionPrompt = `The user wants to open an application. Their request is: "${query}".
Identify the application they want to run. Respond with ONLY the single name of the application from this list (notepad, calc, chrome, edge, paint, explorer, terminal, powershell, or a web URL starting with http/https).
If it does not match any of these list items or is a general query, respond with 'none'. Do NOT include any punctuation, markdown format, or surrounding explanation.`;
        const llmResolved = (await window.electron.gemmaChat(extractionPrompt)).trim().toLowerCase();
        if (llmResolved !== 'none' && !llmResolved.includes(' ') && llmResolved.length < 50) {
          appName = llmResolved;
        }
      } catch (err) {
        console.error('LLM intent resolver error:', err);
      }
    }

    const timestamp = new Date().toLocaleTimeString();

    if (appName) {
      setClickyStatus(`Executing: ${appName}...`);
      try {
        const result = await window.electron.executeSystemCommand(appName);
        if (result.success) {
          setExecutionLogs(prev => [
            {
              command: query,
              timestamp,
              status: 'success',
              details: `Successfully launched ${appName}`
            },
            ...prev
          ]);
          setClickyStatus('Idle');
          speak(`Opened ${appName}`);
        } else {
          throw new Error(result.error || 'Execution failed');
        }
      } catch (err) {
        const error = err as Error;
        setExecutionLogs(prev => [
          {
            command: query,
            timestamp,
            status: 'failed',
            details: error.message || `Failed to launch ${appName}`
          },
          ...prev
        ]);
        setClickyStatus('Idle');
        speak(`Failed to open ${appName}`);
      }
    } else {
      // If no execution mapping is found, treat as a general conversational query
      setClickyStatus('Thinking...');
      try {
        const response = await window.electron.gemmaChat(query);
        setClickyStatus('Idle');
        speak(response);
        setExecutionLogs(prev => [
          {
            command: query,
            timestamp,
            status: 'success',
            details: response
          },
          ...prev
        ]);
      } catch {
        setClickyStatus('Idle');
        setExecutionLogs(prev => [
          {
            command: query,
            timestamp,
            status: 'failed',
            details: 'Failed to process assistant query.'
          },
          ...prev
        ]);
      }
    }
  };

  // --- VOICE SPEECH HANDLERS ---
  const handleSpeechInput = useCallback((text: string) => {
    if (windowMode === 'heyclicky' && clickySubMode === 'cly') {
      handleSystemExecution(text);
    } else {
      setInputValue(text);
      handleAssist(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMode, clickySubMode, handleAssist]);

  // Speech Recognition Web API configuration
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        if (windowMode === 'heyclicky') {
          setClickyStatus('Listening...');
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (windowMode === 'heyclicky') {
          setClickyStatus('Idle');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (windowMode === 'heyclicky') {
          setClickyStatus('Idle');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSpeechInput(transcript);
        }
      };

      recognitionRef.current = rec;
    }
  }, [windowMode, handleSpeechInput]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };


  // --- INITIALIZATION ---
  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const greeting = await window.electron.geminiChat("Write a very short, friendly 1-sentence welcome message for a desktop AI assistant called Inqora.");
        setAiResponse(greeting);
      } catch (err) {
        console.error("Failed to fetch greeting:", err);
      }
    };
    fetchGreeting();
  }, []);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        setShowPanel(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (isGuideMode) handleGuideSearch();
        else handleAssist();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        setIsGuideMode(prev => !prev);
      }
      // Ctrl+Shift+T: Click-Through
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        setClickThrough(prev => !prev);
      }
      // Ctrl+Shift+P: Screen protection Toggle
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        setContentProtected(prev => !prev);
      }
      // Ctrl+Shift+S: Screenshot
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        takeManualScreenshot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideMode, handleAssist, handleGuideSearch, clickThrough, contentProtected, capturedScreenshot]);

  // --- MOUSE HOVER CONTROLS FOR CLICK-THROUGH ---
  const handleMouseEnter = () => {
    if (isGuideMode || clickThrough) {
      window.electron.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (isGuideMode || clickThrough) {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  // --- COMPONENT RENDER ---
  return (
    <div className={`app-container ${isGuideMode ? 'guide-active' : ''} mode-${windowMode}`}>
      {/* Guide Mode Arrow Overlay */}
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

      <div
        className="window-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Top Control Bar */}
        <div className="top-bar">
          <div className="top-bar-logo">
            <BrainCircuit size={15} />
            {windowMode !== 'stealth' && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>INQORA</span>}
          </div>

          <div className="toolbar-separator" />

          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button
              className={`nav-tab-btn ${activeTab === 'assist' && windowMode !== 'heyclicky' ? 'active' : ''}`}
              onClick={() => { setActiveTab('assist'); setWindowMode('panel'); }}
              title="Assistant Panel"
            >
              <MessageSquare size={13} />
              {windowMode !== 'stealth' && <span>Assist</span>}
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'search' && windowMode !== 'heyclicky' ? 'active' : ''}`}
              onClick={() => { setActiveTab('search'); setWindowMode('panel'); }}
              title="Meeting Search Console"
            >
              <Search size={13} />
              {windowMode !== 'stealth' && <span>Search</span>}
            </button>
            <button
              className={`nav-tab-btn ${windowMode === 'heyclicky' ? 'active' : ''}`}
              onClick={() => setWindowMode('heyclicky')}
              title="HeyClicky Web Companion"
            >
              <Globe size={13} />
              {windowMode !== 'stealth' && <span>Clicky</span>}
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Layout Mode Controls */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              className={`control-icon-btn ${windowMode === 'toolbar' ? 'active' : ''}`}
              onClick={() => setWindowMode('toolbar')}
              title="Toolbar Mode"
            >
              <Minimize2 size={13} />
            </button>
            <button
              className={`control-icon-btn ${windowMode === 'stealth' ? 'active' : ''}`}
              onClick={() => setWindowMode('stealth')}
              title="Stealth Mode (Overlay text only)"
            >
              <EyeOff size={13} />
            </button>
            <button
              className={`control-icon-btn ${windowMode === 'panel' ? 'active' : ''}`}
              onClick={() => setWindowMode('panel')}
              title="Standard Panel Mode"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Stealth & Accessibility Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Click-Through Toggle */}
            <button
              className={`control-icon-btn ${clickThrough ? 'active warning' : ''}`}
              onClick={() => setClickThrough(!clickThrough)}
              title={clickThrough ? "Click-Through Enabled (Clicks pass through outside header)" : "Enable Click-Through"}
            >
              <MousePointer size={13} />
            </button>

            {/* Content protection Toggle (screen share invisibility) */}
            <button
              className={`control-icon-btn ${contentProtected ? 'active success' : ''}`}
              onClick={() => setContentProtected(!contentProtected)}
              title={contentProtected ? "Hidden from Screen Share (Invisible overlay active)" : "Hide from Screen Share"}
            >
              {contentProtected ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
            </button>

            {/* Live opacity adjustments */}
            <div className="opacity-slider-container">
              <SlidersHorizontal size={12} />
              <input
                type="range"
                min="0.15"
                max="0.95"
                step="0.05"
                value={bgOpacity}
                onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                className="opacity-slider"
                title={`Transparency: ${Math.round((1 - bgOpacity) * 100)}%`}
              />
            </div>
          </div>

          {/* Simple search bar inside top-bar in compact mode */}
          {windowMode === 'toolbar' && (
            <div className="toolbar-input-wrapper">
              <input
                type="text"
                className="toolbar-input"
                placeholder="Ask Inqora about screen..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAssist()}
              />
              <button className="toolbar-send-btn" onClick={() => handleAssist()}>
                <Play size={8} fill="currentColor" />
              </button>
            </div>
          )}

          {/* Hide/Show Panel Toggle */}
          {windowMode !== 'toolbar' && windowMode !== 'heyclicky' && (
            <button className="top-bar-btn" onClick={() => setShowPanel(!showPanel)}>
              <ChevronDown size={12} style={{ transform: showPanel ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
              {showPanel ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {/* 1. Main Assistant & Search Panels */}
        {windowMode !== 'toolbar' && windowMode !== 'heyclicky' && (
          <AnimatePresence>
            {showPanel && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="assistant-panel"
              >
                {/* Visual Screenshot Indicator in Main Panel header */}
                <div className="panel-header">
                  <div className="panel-title">
                    {activeTab === 'search' ? <Search size={14} /> : <Sparkles size={14} />}
                    <span>{activeTab === 'search' ? 'Meeting Search Console' : 'Context Assistant'}</span>
                  </div>
                  <button className="pill-btn" onClick={takeManualScreenshot}>
                    <Camera size={12} style={{ marginRight: 4 }} />
                    Capture Context
                  </button>
                </div>

                {/* Main AI Response display */}
                <div className="content-block">
                  {isAiLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                      <Loader className="spinner" size={14} />
                      <div className="ai-cursor" /> {isGuideMode ? "Locating elements..." : "Thinking..."}
                    </div>
                  ) : isGuideMode ? (
                    <p style={{ margin: 0 }}>“Guide Mode Active. Ask me how to do anything on screen.”</p>
                  ) : (
                    <MarkdownRenderer content={aiResponse} />
                  )}
                </div>

                {/* Sub Action Tabs */}
                {activeTab === 'assist' && (
                  <div className="action-row">
                    <div className={`action-item ${!isGuideMode ? 'active' : ''}`} onClick={() => setIsGuideMode(false)}>
                      <Sparkles size={12} /> Assist
                    </div>
                    <div className="action-dot" />
                    <div className={`action-item ${isGuideMode ? 'active' : ''}`} onClick={() => setIsGuideMode(true)}>
                      <Navigation size={12} /> Guide Me
                    </div>
                    <div className="action-dot" />
                    <div className="action-item" onClick={() => handleTemplateClick("Suggest 3 followup questions I can ask.")}>
                      <MessageSquare size={12} /> Followups
                    </div>
                  </div>
                )}

                {/* Sales & Meeting Quick Prompts (only in Search Console) */}
                {activeTab === 'search' && (
                  <div className="search-tab-content">
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: 6 }}>SALES & MEETING TEMPLATES</span>
                    <div className="search-templates">
                      <button className="template-chip" onClick={() => handleTemplateClick("Explain the key term or metric on my screen.")}>
                        <Zap size={10} color="var(--accent-purple)" /> Explain Metric
                      </button>
                      <button className="template-chip" onClick={() => handleTemplateClick("Give me a professional objection handler for what is visible on my screen.")}>
                        <MessageSquare size={10} color="var(--accent-orange)" /> Objection Handler
                      </button>
                      <button className="template-chip" onClick={() => handleTemplateClick("Verify the claims and fact check what is on my screen.")}>
                        <ShieldCheck size={10} color="var(--accent-green)" /> Fact Checker
                      </button>
                      <button className="template-chip" onClick={() => handleTemplateClick("List the visible action items and next steps.")}>
                        <Play size={10} color="var(--accent-blue)" /> Extract Todo
                      </button>
                    </div>
                  </div>
                )}

                {/* Screenshot preview banner */}
                {capturedScreenshot && (
                  <div className="screenshot-preview-container">
                    <img src={capturedScreenshot} className="screenshot-thumbnail" alt="Capture Preview" />
                    <div className="screenshot-info">
                      <span className="screenshot-title"><Camera size={10} /> Active Screen Context</span>
                      <span className="screenshot-desc">This snapshot will be passed to Gemini for screen awareness.</span>
                    </div>
                    <div className="screenshot-actions">
                      <button className="screenshot-btn" onClick={takeManualScreenshot} title="Retake Screenshot">
                        <RefreshCw size={12} />
                      </button>
                      <button className="screenshot-btn danger" onClick={clearScreenshot} title="Remove Screen Context">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Input Area */}
                <div className="input-container">
                  {speechSupported && (
                    <button
                      className={`chat-mic-btn ${isListening ? 'active' : ''}`}
                      onClick={toggleListening}
                      title={isListening ? "Listening... Click to stop" : "Speak to Inqora"}
                      type="button"
                    >
                      <Mic size={14} />
                    </button>
                  )}
                  <input
                    type="text"
                    className="input-field"
                    placeholder={isGuideMode ? "How do I click..." : "Ask about your screen or search terms..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (isGuideMode ? handleGuideSearch() : handleAssist())}
                  />

                  {/* Auto screenshot attachment checkbox */}
                  <label className="auto-attach-label" title="Automatically capture screen when sending query">
                    <input
                      type="checkbox"
                      className="auto-attach-checkbox"
                      checked={autoAttachScreenshot}
                      onChange={(e) => setAutoAttachScreenshot(e.target.checked)}
                    />
                    <span>Auto-Screen</span>
                  </label>

                  <button className="smart-btn" onClick={handleSmart} title="Queries Gemini Text Only">
                    <Zap size={12} style={{ marginRight: 2 }} /> Smart
                  </button>

                  <button className="play-btn" onClick={isGuideMode ? () => handleGuideSearch() : () => handleAssist()}>
                    <Play size={12} fill="currentColor" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* 2. Embedded HeyClicky Webview tab or Cluely-style voice companion overlay */}
        {windowMode === 'heyclicky' && (
          clickySubMode === 'cly' ? (
            <div className="clicky-container" style={{ width: '100%', height: '100%' }}>
              <div className="cly-dashboard">
                {/* Dynamic voice pulsing orb in the center */}
                <div className="cly-orb-section">
                  <div className="cly-orb-wrapper">
                    {/* Glowing outer wave lines */}
                    <div className="cly-orb-pulse-ring" />
                    <div className="cly-orb-pulse-ring" />
                    <div className="cly-orb-pulse-ring" />
                    
                    {/* Active clickable microphone orb */}
                    <div 
                      className={`cly-orb ${isListening ? 'listening' : ''} ${clickyStatus.startsWith('Thinking') ? 'thinking' : ''} ${clickyStatus.startsWith('Executing') ? 'executing' : ''}`}
                      onClick={toggleListening}
                      title={isListening ? "Listening... Click to stop" : "Click to Speak"}
                    >
                      <Mic size={24} color="#fff" />
                    </div>
                  </div>

                  {/* Visual companion status banner */}
                  <div className={`cly-status-badge ${isListening ? 'listening' : ''} ${clickyStatus.startsWith('Thinking') ? 'thinking' : ''} ${clickyStatus.startsWith('Executing') ? 'executing' : ''}`}>
                    {clickyStatus}
                  </div>
                </div>

                {/* Glassmorphic command action execution log */}
                <div className="cly-log-panel">
                  <div className="cly-log-header">Voice Action History</div>
                  <div className="cly-log-list">
                    {executionLogs.length === 0 ? (
                      <div className="cly-log-empty">
                        No actions triggered yet. Ask "open Notepad" or "open Chrome" to try.
                      </div>
                    ) : (
                      executionLogs.map((log, idx) => (
                        <div className="cly-log-item" key={idx}>
                          <div className="cly-log-left">
                            <span className="cly-log-timestamp">{log.timestamp}</span>
                            <span className="cly-log-command">“{log.command}”</span>
                          </div>
                          <span className={`cly-log-status ${log.status}`}>
                            {log.status === 'success' ? 'Executed' : 'Failed'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Compact command manual keyboard text fallback bar */}
                <div className="input-container" style={{ width: '100%' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type a voice command (e.g. open notepad)..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inputValue) {
                        handleSystemExecution(inputValue);
                        setInputValue("");
                      }
                    }}
                  />
                  <button 
                    className="play-btn" 
                    onClick={() => {
                      if (inputValue) {
                        handleSystemExecution(inputValue);
                        setInputValue("");
                      }
                    }}
                  >
                    <Play size={12} fill="currentColor" />
                  </button>
                </div>

                {/* Voice companion footer controls */}
                <div className="cly-footer-row">
                  <button 
                    className={`cly-mic-btn ${isListening ? 'active' : ''}`}
                    onClick={toggleListening}
                    title={isListening ? "Stop listening" : "Start Speech-to-Text"}
                  >
                    <Mic size={14} />
                  </button>

                  <button 
                    className="cly-companion-toggle"
                    onClick={() => setClickySubMode('webview')}
                  >
                    <Globe size={12} /> Switch to Web Portal
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="clicky-container">
              {/* Custom browser navigation controls for embedded webview */}
              <div className="clicky-nav-bar">
                <button
                  className="clicky-nav-btn"
                  onClick={handleWebviewBack}
                  disabled={!canGoBack}
                  title="Go Back"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  className="clicky-nav-btn"
                  onClick={handleWebviewForward}
                  disabled={!canGoForward}
                  title="Go Forward"
                >
                  <ArrowRight size={14} />
                </button>
                <button
                  className="clicky-nav-btn"
                  onClick={handleWebviewReload}
                  title="Reload Page"
                >
                  <RefreshCw size={13} />
                </button>

                <div className="clicky-address-bar">{currentUrl}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    className="cly-companion-toggle"
                    onClick={() => setClickySubMode('cly')}
                    style={{ marginRight: 8 }}
                  >
                    <Mic size={10} /> Voice Companion
                  </button>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>HeyClicky Browser Companion</span>
                  <Globe size={14} color="var(--accent-purple)" />
                </div>
              </div>

              {/* Webview guest element */}
              <div className="clicky-webview-wrapper">
                <webview
                  ref={webviewRef}
                  src="https://www.heyclicky.com/"
                  className="clicky-webview"
                />

                {webviewLoading && (
                  <div className="webview-loader">
                    <Loader className="spinner" size={24} />
                    <span>Securely loading HeyClicky...</span>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default App;
