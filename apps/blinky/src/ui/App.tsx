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

  // Sync mixed click-through pointer events on overlay windows
  useEffect(() => {
    if (!isGuideMode && !clickThrough) {
      window.electron.setIgnoreMouseEvents(false);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const targetElement = event.target as HTMLElement;
      // Re-enable clicks if mouse is over interactive panel, top-bar, or exit guide elements
      if (
        targetElement.closest('.interactive-overlay') || 
        targetElement.closest('.top-bar') || 
        targetElement.closest('.assistant-panel') ||
        targetElement.closest('.clicky-container')
      ) {
        window.electron.setIgnoreMouseEvents(false);
      } else {
        // Otherwise, ignore mouse events so clicks pass through to native applications
        window.electron.setIgnoreMouseEvents(true, { forward: true });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    // Initially ignore mouse events so clicks pass through by default
    window.electron.setIgnoreMouseEvents(true, { forward: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.electron.setIgnoreMouseEvents(false);
    };
  }, [isGuideMode, clickThrough]);

  // Sync full screen and restore normal sizing when entering/exiting Guide Mode
  useEffect(() => {
    if (isGuideMode) {
      window.electron.setFullScreen(true);
    } else {
      window.electron.setFullScreen(false);
      // Re-trigger standard size alignment for current window mode
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
    }
  }, [isGuideMode, windowMode, clickySubMode]);

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

  // --- AUTOMATED WINDOWS ACTIONS ---
  // Generates and runs PowerShell scripts to automate multi-step applications controls
  const handleAutomation = useCallback(async (queryText: string) => {
    setClickyStatus('Generating automation...');
    const actionTimestamp = new Date().toLocaleTimeString();

    try {
      const automationPrompt = `You are an expert Windows OS automation script generator.
The user wants to do: "${queryText}".
Generate a clean and safe Windows PowerShell script to accomplish this task.

Guidelines:
1. Opening applications:
   - For web searches or URLs: Start-Process "chrome.exe" "https://www.google.com/search?q=query_text"
   - For other tools: Start-Process "notepad.exe", Start-Process "calc.exe", Start-Process "explorer.exe", Start-Process "cmd.exe", Start-Process "powershell.exe".
2. Application window interaction:
   - Always add a short delay to let the app load: Start-Sleep -Milliseconds 800
   - Create a Wscript.Shell COM object:
     $wshell = New-Object -ComObject Wscript.Shell
   - Activate the application window by title:
     $wshell.AppActivate('Notepad')
     Start-Sleep -Milliseconds 200
   - Send keys to type text or click shortcuts:
     - For standard text: $wshell.SendKeys('Typed text')
     - For special keys: '{ENTER}' for Enter, '{TAB}' for Tab, etc.
     - For key combinations: '^s' for Ctrl+S (Save), '%{F4}' for Alt+F4.
3. Keep the script completely safe. No destructive commands (like removing files or registry keys).
4. Output ONLY the raw executable PowerShell script code. No explanations, no extra talk, and no markdown blocks other than a standard \`\`\`powershell ... \`\`\` code block.

Write the PowerShell script to accomplish: "${queryText}"`;

      const responseText = await window.electron.gemmaChat(automationPrompt);
      let powerShellScript = responseText.trim();

      // Clean markdown code blocks from the LLM response
      if (powerShellScript.includes('```')) {
        const regexMatch = powerShellScript.match(/```(?:powershell)?([\s\S]*?)```/);
        if (regexMatch) {
          powerShellScript = regexMatch[1];
        }
      }
      powerShellScript = powerShellScript.trim();

      setClickyStatus('Executing action...');
      const executionResult = await window.electron.executePowershellScript(powerShellScript);

      if (executionResult.success) {
        setExecutionLogs((prevLogs) => [
          {
            command: queryText,
            timestamp: actionTimestamp,
            status: 'success',
            details: 'Executed PowerShell automation script successfully.'
          },
          ...prevLogs
        ]);
        speak("Action completed successfully.");
      } else {
        throw new Error(executionResult.error || 'PowerShell execution returned an error.');
      }
    } catch (err) {
      const errorObject = err as Error;
      console.error('Automation failed:', errorObject);
      setExecutionLogs((prevLogs) => [
        {
          command: queryText,
          timestamp: actionTimestamp,
          status: 'failed',
          details: errorObject.message || 'PowerShell script failed.'
        },
        ...prevLogs
      ]);
      speak("Failed to complete the desktop automation.");
    }
  }, [speak]);

  // --- NATIVE INTERFACE VISUAL GUIDANCE ---
  // Hides the Inqora window, captures the desktop, gets target coordinates from Gemini Vision,
  // and displays a pointing arrow overlay on the screen to guide the user visually.
  const handleGuidance = useCallback(async (queryText: string) => {
    setGuideText("Scanning desktop contents...");
    try {
      // captureScreen handles window hiding and restoration automatically in main process
      const screenSnapshotData = await getScreenContext() || (await window.electron.captureScreen()).split(',')[1];

      const visionSearchPrompt = `The user is looking for or wants to click: "${queryText}".
Analyze this desktop screenshot and identify the exact location of the target UI element or text.
Provide your response as a single, friendly instruction sentence guiding them, and include the coordinates of the target element in percentage values [x, y] (from 0 to 100) at the very end of your response.
Example: "The Recycle Bin icon is at the top left. [4, 5]"`;

      const geminiResponse = await window.electron.geminiVision(visionSearchPrompt, screenSnapshotData);

      const coordinateMatch = geminiResponse.match(/\[(\d+),\s*(\d+)\]/);
      if (coordinateMatch) {
        const xPercentCoordinate = parseInt(coordinateMatch[1]);
        const yPercentCoordinate = parseInt(coordinateMatch[2]);

        // Position the arrow overlay relative to the viewport size (which is full-screen in Guide Mode)
        setArrowPos({
          x: (xPercentCoordinate / 100) * window.innerWidth,
          y: (yPercentCoordinate / 100) * window.innerHeight
        });
      } else {
        // Fallback arrow placement if coordinate detection fails
        setArrowPos({ x: window.innerWidth / 2, y: 150 });
      }

      const guidanceDescription = geminiResponse.replace(/\[\d+,\s*\d+\]/, '').trim();
      setGuideText(guidanceDescription);
      speak(guidanceDescription);
    } catch (err) {
      console.error('Screen guidance failed:', err);
      setGuideText("Sorry, I could not scan your screen properly.");
      speak("Sorry, I could not scan your screen properly.");
    }
  }, [getScreenContext, speak]);

  // --- UNIFIED USER QUERY SUBMITTER ---
  // Entry point for all text, speech, and dashboard inputs. Resolves user intent using LLM
  // and routes to Automation, Guidance (visual overlay pointer), or Conversation.
  const handleQuerySubmit = useCallback(async (customPrompt?: string) => {
    const activeQuery = customPrompt || inputValue;
    if (!activeQuery) return;

    setIsAiLoading(true);
    setClickyStatus('Routing query...');
    setInputValue(""); // Clear the input field for a premium experience

    try {
      const intentClassificationPrompt = `Classify this user's desktop assistant request: "${activeQuery}"
Select exactly one category:
- AUTOMATION: The user wants to open/launch an app and do something, search, type text, or run automated desktop keyboard/mouse interactions (e.g., "open chrome and search cat videos", "open notepad and type hello", "run calc and do 5+5").
- GUIDANCE: The user wants to locate, find, click, or see a pointing direction to a visual UI element, button, window, or icon on their current desktop (e.g., "where is the recycle bin", "how do I click settings", "point to the file menu", "where is Chrome").
- CONVERSATION: A general chat question, reflection, help, welcome greeting, or non-automation query (e.g., "what is the capital of France?", "explain photosynthesis", "who are you").

Respond with ONLY one word: AUTOMATION, GUIDANCE, or CONVERSATION. Do not write punctuation, markdown, or any other explanations.`;

      const classificationResult = await window.electron.gemmaChat(intentClassificationPrompt);
      const classifiedIntent = classificationResult.trim().toUpperCase();
      console.log('Query intent classified as:', classifiedIntent);

      if (classifiedIntent.includes('AUTOMATION')) {
        await handleAutomation(activeQuery);
      } else if (classifiedIntent.includes('GUIDANCE')) {
        setIsGuideMode(true);
        await handleGuidance(activeQuery);
      } else {
        await handleAssist(activeQuery);
      }
    } catch (err) {
      console.error('Routing failed, falling back to Assist:', err);
      await handleAssist(activeQuery);
    } finally {
      setIsAiLoading(false);
      setClickyStatus('Idle');
    }
  }, [inputValue, handleAutomation, handleGuidance, handleAssist]);

  // Voice command processor wrapping standard input submitter
  const handleSpeechInput = useCallback((speechText: string) => {
    handleQuerySubmit(speechText);
  }, [handleQuerySubmit]);



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
        handleQuerySubmit();
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
  }, [handleQuerySubmit, clickThrough, contentProtected, capturedScreenshot]);

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
                onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
              />
              <button className="toolbar-send-btn" onClick={() => handleQuerySubmit()}>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
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

                  <button className="play-btn" onClick={() => handleQuerySubmit()}>
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
                    placeholder="Type a command (e.g. open chrome and search maps)..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inputValue) {
                        handleQuerySubmit(inputValue);
                      }
                    }}
                  />
                  <button 
                    className="play-btn" 
                    onClick={() => {
                      if (inputValue) {
                        handleQuerySubmit(inputValue);
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
