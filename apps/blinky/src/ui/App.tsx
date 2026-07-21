import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GuideArrow, type GuideStep } from './components/GuideArrow';
import { TopControlBar } from './components/TopControlBar';
import { AssistantPanel } from './components/AssistantPanel';
import { AIHereBrowser, type BrowserStep } from './components/AIHereBrowser';
import { LogoBar } from './components/LogoBar';
import type { ExecutionLog } from './components/VoiceActionPanel';
import type { HistoryItem } from './types';

/**
 * App is the root container of Inqora's blinky client application.
 * It manages central states (window sizing, transparency, Electron layout modes,
 * speech engines, and screenshot caches) and orchestrates the user query sub-router.
 */
function App() {
  // --- STATE DECLARATIONS ---
  const [showPanel, setShowPanel] = useState(true);
  const [isGuideMode, setIsGuideMode] = useState(false);
  const [arrowPos, setArrowPos] = useState({ x: -100, y: -100 });
  const [guideText, setGuideText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [aiResponse, setAiResponse] = useState<string>("Hello! I'm your Inqora AI assistant. Ask me anything about your screen, or toggle Guide Mode to have me show you the way.");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- CLICKY GUIDE & REGION SELECTION STATES ---
  const [cursorColor, setCursorColor] = useState<'cyan' | 'purple' | 'green' | 'orange' | 'gold'>('cyan');
  const [isRegionSelecting, setIsRegionSelecting] = useState<boolean>(false);
  const [guideSteps, setGuideSteps] = useState<GuideStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // --- NEW FEATURES STATES ---
  // Window layouts: 'toolbar' (compact bar), 'panel' (main dashboard), 'stealth' (overlay text), 'aihere' (agent browser), 'logo' (minimal pill)
  const [windowMode, setWindowMode] = useState<'toolbar' | 'panel' | 'stealth' | 'aihere' | 'logo'>('panel');
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
  // Embedded AI Here browser loading state
  const [webviewLoading, setWebviewLoading] = useState<boolean>(true);

  // Browser navigation state for AI Here webview
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>("https://www.google.com/");

  // State for recording system application execution outcomes
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [browserSteps, setBrowserSteps] = useState<BrowserStep[]>([]);
  const [aiHerePrompt, setAiHerePrompt] = useState<string>("");
  const [aiHereStatus, setAiHereStatus] = useState<string>("Tell me what to search or browse.");
  // Status state of voice overlay ("Idle", "Listening...", "Executing...", etc.)
  const [clickyStatus, setClickyStatus] = useState<string>("Idle");

  // Voice Synthesis States: Mute toggle & speaking state tracking
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

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
  // Apply transparency variable to stylesheet dynamically
  useEffect(() => {
    document.documentElement.style.setProperty('--bg-opacity', bgOpacity.toString());
  }, [bgOpacity]);

  // --- LOCAL CHAT HISTORY PERSISTENCE STATE & HANDLERS ---
  const [chatHistory, setChatHistory] = useState<HistoryItem[]>([]);

  // Auto-load saved local history on app launch
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron?.loadChatHistory) {
      window.electron.loadChatHistory().then((loadedItems) => {
        if (Array.isArray(loadedItems)) {
          setChatHistory(loadedItems);
        }
      }).catch((err) => {
        console.error("Failed loading chat history:", err);
      });
    }
  }, []);

  const saveHistoryEntry = useCallback(async (
    prompt: string,
    response: string,
    screenshotDataUrl?: string | null
  ) => {
    const newItem: HistoryItem = {
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      prompt: prompt || (screenshotDataUrl ? "Screen Context Analysis" : "Chat"),
      response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoiceMuted,
      hasScreenshot: !!screenshotDataUrl,
      base64Screenshot: screenshotDataUrl || undefined,
    };

    setChatHistory((prev) => {
      const updated = [newItem, ...prev];
      if (typeof window !== 'undefined' && window.electron?.saveChatHistory) {
        window.electron.saveChatHistory(updated).catch((err) => {
          console.error("Failed saving chat history to disk:", err);
        });
      }
      return updated;
    });
  }, [isVoiceMuted]);

  const clearHistory = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron?.clearChatHistory) {
      await window.electron.clearChatHistory();
    }
    setChatHistory([]);
  }, []);

  const loadHistoryItem = useCallback((item: HistoryItem) => {
    if (item.prompt) setInputValue(item.prompt);
    if (item.response) setAiResponse(item.response);
    if (item.base64Screenshot) {
      setCapturedScreenshot(item.base64Screenshot);
    }
  }, []);

  // Sync window size on mode changes through Electron ipcRenderer
  useEffect(() => {
    if (isFocusMode) {
      window.electron.setWindowSize(780, 85);
    } else if (windowMode === 'toolbar') {
      window.electron.setWindowSize(800, 65);
    } else if (windowMode === 'logo') {
      window.electron.setWindowSize(220, 50);
    } else if (windowMode === 'stealth') {
      window.electron.setWindowSize(460, 300);
    } else if (windowMode === 'panel') {
      window.electron.setWindowSize(800, 520);
    } else if (windowMode === 'aihere') {
      window.electron.setWindowSize(1000, 750);
    }
  }, [windowMode, isFocusMode]);

  // Sync content protection to native Electron layer
  useEffect(() => {
    window.electron.setContentProtection(contentProtected);
  }, [contentProtected]);

  // Sync mixed click-through pointer events on overlay windows to ignore clicks
  useEffect(() => {
    if (!isGuideMode && !clickThrough) {
      window.electron.setIgnoreMouseEvents(false);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const targetElement = event.target as HTMLElement;
      // Re-enable clicks if mouse is over interactive panel, top-bar, step navigation, or exit guide elements
      if (
        targetElement.closest('.interactive-overlay') ||
        targetElement.closest('.top-bar') ||
        targetElement.closest('.assistant-panel') ||
        targetElement.closest('.clicky-container') ||
        targetElement.closest('.step-navigation-bar') ||
        targetElement.closest('.step-nav-btn') ||
        targetElement.closest('.exit-guide-btn') ||
        targetElement.closest('.guide-voice-bubble') ||
        targetElement.closest('.logo-bar-container')
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
      } else if (windowMode === 'aihere') {
        window.electron.setWindowSize(1000, 750);
      }
    }
  }, [isGuideMode, windowMode]);

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

  const loadAiHereUrl = useCallback((targetUrl: string) => {
    setCurrentUrl(targetUrl);
    setWebviewLoading(true);
    setWindowMode('aihere');

    if (webviewRef.current) {
      try {
        webviewRef.current.loadURL(targetUrl);
      } catch (err) {
        console.error("AI Here browser load error:", err);
      }
    }
  }, []);

  // Stop current speech synthesis midway
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Sync mute toggle to immediately halt ongoing speech
  useEffect(() => {
    if (isVoiceMuted) {
      stopSpeaking();
    }
  }, [isVoiceMuted, stopSpeaking]);

  // --- AUDIO SYNTHESIS ---
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel any previous speech output before speaking new response
    window.speechSynthesis.cancel();

    // Do not speak if voice response is muted
    if (isVoiceMuted || !text.trim()) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isVoiceMuted]);

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

  // --- REGION CIRCLING & CROP HANDLERS ---
  const startRegionSelection = useCallback(() => {
    setIsRegionSelecting(true);
    setIsGuideMode(true);
  }, []);

  const handleRegionSelected = useCallback((cropRect: { x: number; y: number; width: number; height: number }) => {
    window.electron.captureScreen().then((fullScreenBase64) => {
      if (!fullScreenBase64) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = cropRect.width;
        canvas.height = cropRect.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            cropRect.x,
            cropRect.y,
            cropRect.width,
            cropRect.height,
            0,
            0,
            cropRect.width,
            cropRect.height
          );
          const croppedDataUrl = canvas.toDataURL('image/jpeg');
          setCapturedScreenshot(croppedDataUrl);
          setAiResponse("Circled region captured! Type your question or click Assist.");
          speak("Circled region captured. What would you like to know about it?");
        }
      };
      img.src = fullScreenBase64;
    }).catch((err) => {
      console.error("Failed region capture:", err);
    });
  }, [speak]);

  // --- AI INTERACTION HANDLERS ---
  const handleAssist = useCallback(async (customPrompt?: string) => {
    const query = customPrompt || inputValue;
    if (!query && !capturedScreenshot && !autoAttachScreenshot) return;
    setIsAiLoading(true);

    try {
      const base64Data = await getScreenContext();
      let response = "";

      if (base64Data) {
        let prompt = query || "Summarize what you see on my screen in a few helpful bullet points.";
        if (isGuideMode) {
          prompt += '\nProvide step-by-step guidance. Include JSON block at end: ```json\n[{"stepNumber":1,"x":300,"y":200,"label":"Step 1","description":"Click here","annotationType":"circle"}]\n```';
        }
        response = await window.electron.geminiVision(prompt, base64Data);
      } else {
        if (!query) return;
        response = await window.electron.geminiChat(query);
      }

      // Parse multi-step guidance JSON if present
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsedSteps = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsedSteps) && parsedSteps.length > 0) {
            setGuideSteps(parsedSteps);
            setCurrentStepIndex(0);
            setArrowPos({ x: parsedSteps[0].x, y: parsedSteps[0].y });
            setGuideText(parsedSteps[0].description);
            setIsGuideMode(true);
          }
        } catch (jsonErr) {
          console.error("Failed to parse guide steps JSON:", jsonErr);
        }
      }

      setAiResponse(response);
      speak(response);
      saveHistoryEntry(query, response, capturedScreenshot || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null));
      setCapturedScreenshot(null);
    } catch (err) {
      console.error('Assist error:', err);
      setAiResponse("Sorry, I had trouble reaching the AI service.");
    } finally {
      setIsAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, capturedScreenshot, autoAttachScreenshot, speak, saveHistoryEntry, isGuideMode]);

  const handleSmart = async () => {
    if (!inputValue) return;
    setIsAiLoading(true);
    try {
      const response = await window.electron.gemmaChat(inputValue);
      setAiResponse(response);
      speak(response);
      saveHistoryEntry(inputValue, response, null);
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

  const handleAiHereBrowse = useCallback(async (queryText: string) => {
    const browserQuery = queryText.trim();
    if (!browserQuery) return;

    const actionTimestamp = new Date().toLocaleTimeString();
    setWindowMode('aihere');
    setAiHereStatus('Planning an in-app browser path...');
    setIsAiLoading(true);

    try {
      const browserPrompt = `You are choosing the first page for an embedded browser agent.
User request: "${browserQuery}"

Return only compact JSON with these keys:
{
  "url": "a safe https URL to open first",
  "summary": "one short sentence explaining what the browser will do"
}

Rules:
- If the user gives a full URL, use it.
- If the user asks to search, research, browse, or find something online, use a Google search URL.
- Encode query parameters correctly.
- Do not open external desktop browsers.`;

      const responseText = await window.electron.gemmaChat(browserPrompt);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      let targetUrl = `https://www.google.com/search?q=${encodeURIComponent(browserQuery)}`;
      let summary = `Searching the web for "${browserQuery}".`;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { url?: string; summary?: string };
        if (parsed.url && /^https:\/\//i.test(parsed.url)) {
          targetUrl = parsed.url;
        }
        if (parsed.summary) {
          summary = parsed.summary;
        }
      }

      loadAiHereUrl(targetUrl);
      setAiHereStatus(summary);
      setBrowserSteps((prevSteps) => [
        {
          query: browserQuery,
          timestamp: actionTimestamp,
          targetUrl,
          summary
        },
        ...prevSteps
      ]);
    } catch (err) {
      console.error('AI Here browse planning failed:', err);
      const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(browserQuery)}`;
      loadAiHereUrl(fallbackUrl);
      setAiHereStatus(`Searching the web for "${browserQuery}".`);
      setBrowserSteps((prevSteps) => [
        {
          query: browserQuery,
          timestamp: actionTimestamp,
          targetUrl: fallbackUrl,
          summary: 'Loaded a fallback web search.'
        },
        ...prevSteps
      ]);
    } finally {
      setIsAiLoading(false);
    }
  }, [loadAiHereUrl]);

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
   - For other tools: Start-Process "notepad.exe", Start-Process "calc.exe", Start-Process "explorer.exe", Start-Process "cmd.exe", Start-Process "powershell.exe".
   - Do not open websites, Chrome, Edge, or external desktop browsers for web searches. Those are handled by Inqora AI Here inside the app.
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
- BROWSER: The user wants to search, research, browse, open a URL, create a browser, find online results, or use the web (e.g., "open a browser and search cat videos", "search web for GST updates", "go to https://example.com").
- AUTOMATION: The user wants to open/launch a local desktop app and do something, type text, or run automated desktop keyboard/mouse interactions (e.g., "open notepad and type hello", "run calc and do 5+5").
- GUIDANCE: The user wants to locate, find, click, or see a pointing direction to a visual UI element, button, window, or icon on their current desktop (e.g., "where is the recycle bin", "how do I click settings", "point to the file menu", "where is Chrome").
- CONVERSATION: A general chat question, reflection, help, welcome greeting, or non-automation query (e.g., "what is the capital of France?", "explain photosynthesis", "who are you").

Respond with ONLY one word: BROWSER, AUTOMATION, GUIDANCE, or CONVERSATION. Do not write punctuation, markdown, or any other explanations.`;

      const classificationResult = await window.electron.gemmaChat(intentClassificationPrompt);
      const classifiedIntent = classificationResult.trim().toUpperCase();
      console.log('Query intent classified as:', classifiedIntent);

      if (classifiedIntent.includes('BROWSER')) {
        await handleAiHereBrowse(activeQuery);
      } else if (classifiedIntent.includes('AUTOMATION')) {
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
  }, [inputValue, handleAiHereBrowse, handleAutomation, handleGuidance, handleAssist]);

  // Voice command processor wrapping standard input submitter
  const handleSpeechInput = useCallback((speechText: string) => {
    handleQuerySubmit(speechText);
  }, [handleQuerySubmit]);

  // MediaRecorder Ref for fallback audio stream recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Speech Recognition Web API configuration
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
          if (windowMode === 'aihere') {
            setClickyStatus('Listening...');
          }
        };

        rec.onend = () => {
          setIsListening(false);
          if (windowMode === 'aihere') {
            setClickyStatus('Idle');
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onerror = (event: any) => {
          console.warn('Speech recognition warning (using MediaRecorder fallback):', event.error);
          setIsListening(false);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            handleSpeechInput(transcript);
          }
        };

        recognitionRef.current = rec;
      } catch (err) {
        console.warn('SpeechRecognition initialization skipped:', err);
      }
    }
  }, [windowMode, handleSpeechInput]);

  const toggleListening = async () => {
    if (isListening) {
      // Stop Web Speech API if active
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
      }
      // Stop native MediaRecorder stream if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) { /* ignore */ }
      }
      setIsListening(false);
      setClickyStatus('Idle');
    } else {
      setIsListening(true);
      setClickyStatus('Listening...');

      // 1. Try native getUserMedia & MediaRecorder audio recording
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            setIsListening(false);
            setClickyStatus('Idle');
          };

          mediaRecorder.start();
          mediaRecorderRef.current = mediaRecorder;
        }
      } catch (micErr) {
        console.warn("MediaRecorder mic access error:", micErr);
      }

      // 2. Try Web Speech API recognition asynchronously without crashing
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (speechErr) {
          console.warn("Web Speech start warning:", speechErr);
        }
      }
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const greeting = await window.electron.geminiChat("Write a very short, friendly 1-sentence welcome message for a desktop AI assistant called Blinky.");
        setAiResponse(greeting);
      } catch (err) {
        console.error('Failed to fetch initial greeting:', err);
        setAiResponse("Hello! I'm Blinky, your AI desktop assistant. Ask me anything or toggle Guide Mode.");
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
      {/* Guide Mode Arrow & Target Reticle Overlay */}
      <GuideArrow
        isGuideMode={isGuideMode}
        arrowPos={arrowPos}
        guideText={guideText}
        setIsGuideMode={setIsGuideMode}
        setArrowPos={setArrowPos}
        cursorColor={cursorColor}
        guideSteps={guideSteps}
        currentStepIndex={currentStepIndex}
        setCurrentStepIndex={setCurrentStepIndex}
        speakStep={speak}
        isRegionSelecting={isRegionSelecting}
        setIsRegionSelecting={setIsRegionSelecting}
        onRegionSelected={handleRegionSelected}
      />

      <div
        className="window-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: isGuideMode ? 'none' : 'flex' }}
      >
        {/* Top Control Bar */}
        <TopControlBar
          windowMode={windowMode}
          setWindowMode={setWindowMode}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          clickThrough={clickThrough}
          setClickThrough={setClickThrough}
          contentProtected={contentProtected}
          setContentProtected={setContentProtected}
          bgOpacity={bgOpacity}
          setBgOpacity={setBgOpacity}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleQuerySubmit={handleQuerySubmit}
          showPanel={showPanel}
          setShowPanel={setShowPanel}
          isVoiceMuted={isVoiceMuted}
          setIsVoiceMuted={setIsVoiceMuted}
          cursorColor={cursorColor}
          setCursorColor={setCursorColor}
          startRegionSelection={startRegionSelection}
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
        />

        {/* 1. Minimal Logo Mode Pill */}
        {windowMode === 'logo' && (
          <LogoBar setWindowMode={setWindowMode} />
        )}

        {/* 2. Main Assistant & Search Panels */}
        {windowMode !== 'toolbar' && windowMode !== 'aihere' && windowMode !== 'logo' && (
          <AssistantPanel
            showPanel={showPanel}
            activeTab={activeTab}
            takeManualScreenshot={takeManualScreenshot}
            isAiLoading={isAiLoading}
            isGuideMode={isGuideMode}
            aiResponse={aiResponse}
            setIsGuideMode={setIsGuideMode}
            handleTemplateClick={handleTemplateClick}
            capturedScreenshot={capturedScreenshot}
            clearScreenshot={clearScreenshot}
            speechSupported={speechSupported}
            isListening={isListening}
            toggleListening={toggleListening}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleQuerySubmit={handleQuerySubmit}
            autoAttachScreenshot={autoAttachScreenshot}
            setAutoAttachScreenshot={setAutoAttachScreenshot}
            handleSmart={handleSmart}
            isVoiceMuted={isVoiceMuted}
            setIsVoiceMuted={setIsVoiceMuted}
            isSpeaking={isSpeaking}
            stopSpeaking={stopSpeaking}
            chatHistory={chatHistory}
            clearHistory={clearHistory}
            loadHistoryItem={loadHistoryItem}
            isFocusMode={isFocusMode}
            setIsFocusMode={setIsFocusMode}
          />
        )}

        {/* 2. Embedded AI Here browser and voice companion overlay */}
        {windowMode === 'aihere' && (
          <AIHereBrowser
            webviewRef={webviewRef}
            currentUrl={currentUrl}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            handleWebviewBack={handleWebviewBack}
            handleWebviewForward={handleWebviewForward}
            handleWebviewReload={handleWebviewReload}
            aiHerePrompt={aiHerePrompt}
            setAiHerePrompt={setAiHerePrompt}
            handleAiHereBrowse={handleAiHereBrowse}
            speechSupported={speechSupported}
            isListening={isListening}
            toggleListening={toggleListening}
            webviewLoading={webviewLoading}
            aiHereStatus={aiHereStatus}
            browserSteps={browserSteps}
            executionLogs={executionLogs}
            clickyStatus={clickyStatus}
          />
        )}
      </div>
    </div>
  );
}

export default App;
