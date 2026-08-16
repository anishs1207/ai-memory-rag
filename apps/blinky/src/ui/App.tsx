import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GuideArrow, type GuideStep } from './components/GuideArrow';
import { TopControlBar } from './components/TopControlBar';
import { AssistantPanel } from './components/AssistantPanel';
import { AIHereBrowser, type BrowserStep } from './components/AIHereBrowser';
import { LogoBar } from './components/LogoBar';
import type { ExecutionLog } from './components/VoiceActionPanel';
import type { HistoryItem, ChatMessage } from './types';
import { parseScreenAnnotationPlan, type ScreenAnnotation } from './screenAnnotations';

function getScreenshotDimensions(base64Image: string): Promise<{ width: number; height: number }> {
  const mediaType = base64Image.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read screenshot dimensions.'));
    image.src = `data:${mediaType};base64,${base64Image}`;
  });
}

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

  // --- BLINKY GUIDE & REGION SELECTION STATES ---
  const [cursorColor, setCursorColor] = useState<'cyan' | 'purple' | 'green' | 'orange' | 'gold'>('cyan');
  const [isRegionSelecting, setIsRegionSelecting] = useState<boolean>(false);
  const [guideSteps, setGuideSteps] = useState<GuideStep[]>([]);
  const [screenAnnotations, setScreenAnnotations] = useState<ScreenAnnotation[]>([]);
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
  const [voiceInputStatus, setVoiceInputStatus] = useState<string>('');
  const [isVoiceTypingFallback, setIsVoiceTypingFallback] = useState(false);
  const [speechSupported] = useState<boolean>(() => {
    if (window.electron?.platform === 'win32') return true;
    if (typeof window === 'undefined') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });

  // --- REFS ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // --- EFFECTS ---
  // Apply transparency variable to stylesheet dynamically
  useEffect(() => {
    document.documentElement.style.setProperty('--bg-opacity', bgOpacity.toString());
  }, [bgOpacity]);

  useEffect(() => {
    if (!isGuideMode) {
      setScreenAnnotations([]);
    }
  }, [isGuideMode]);

  // --- LOCAL CHAT HISTORY PERSISTENCE STATE & HANDLERS ---
  const [chatHistory, setChatHistory] = useState<HistoryItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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
    // Cropping is an interactive full-screen operation. It must take precedence
    // over Guide Mode and user-configured click-through until the drag completes.
    if (isRegionSelecting) {
      window.electron.setIgnoreMouseEvents(false);
      return;
    }

    // Embedded webviews run in a guest process, so renderer hover events cannot
    // reliably recover a click-through window. AI Here must stay interactive.
    if (windowMode === 'aihere') {
      window.electron.setIgnoreMouseEvents(false);
      return;
    }

    // Normal Dashboard Mode: keep window 100% interactive for all clicks, inputs, and tab switches
    if (!isGuideMode && !clickThrough) {
      window.electron.setIgnoreMouseEvents(false);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const targetElement = event.target as HTMLElement;
      // Re-enable clicks if mouse is over interactive panel, top-bar, step navigation, or any button/input
      if (
        targetElement && (
          targetElement.closest('.interactive-overlay') ||
          targetElement.closest('.top-bar') ||
          targetElement.closest('.assistant-panel') ||
          targetElement.closest('.logo-bar-container') ||
          targetElement.closest('.clicky-container') ||
          targetElement.closest('.step-navigation-bar') ||
          targetElement.closest('.step-nav-btn') ||
          targetElement.closest('.exit-guide-btn') ||
          targetElement.closest('.guide-voice-bubble') ||
          targetElement.closest('button') ||
          targetElement.closest('input') ||
          targetElement.closest('[role="button"]')
        )
      ) {
        window.electron.setIgnoreMouseEvents(false);
      } else {
        // Otherwise, ignore mouse events so clicks pass through to native applications
        window.electron.setIgnoreMouseEvents(true, { forward: true });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    // Initially set pass-through only when click-through or guide mode is actively enabled
    window.electron.setIgnoreMouseEvents(true, { forward: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.electron.setIgnoreMouseEvents(false);
    };
  }, [isGuideMode, clickThrough, isRegionSelecting, windowMode]);

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

  const loadAiHereUrl = useCallback((targetUrl: string) => {
    setCurrentUrl(targetUrl);
    setWindowMode('aihere');
  }, []);

  /**
   * Strips markdown code blocks, formatting characters, and links
   * so SpeechSynthesis produces natural spoken output without reading syntax symbols.
   */
  const cleanMarkdownForSpeech = (markdownText: string): string => {
    if (!markdownText) return '';
    return markdownText
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~#]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  // Stop current speech synthesis midway and immediately reset state
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
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

    // Do not speak if voice response is muted or string is empty
    if (isVoiceMuted || !text.trim()) {
      setIsSpeaking(false);
      return;
    }

    const cleanSpokenText = cleanMarkdownForSpeech(text);
    if (!cleanSpokenText) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.warn("Speech synthesis notice:", event);
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
  const getScreenContext = useCallback(async (): Promise<string | null> => {
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
  }, [autoAttachScreenshot, capturedScreenshot]);

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
        // Calculate resolution scaling ratio between full-screen snapshot and browser viewport
        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        const cropX = cropRect.x * scaleX;
        const cropY = cropRect.y * scaleY;
        const cropW = cropRect.width * scaleX;
        const cropH = cropRect.height * scaleY;

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            cropW,
            cropH
          );
          const croppedDataUrl = canvas.toDataURL('image/jpeg');
          setCapturedScreenshot(croppedDataUrl);
          setIsGuideMode(false);
          setAiResponse("Circled region captured! Ask a question or click Assist.");
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

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentCapturedScreen = capturedScreenshot;

    try {
      const base64Data = await getScreenContext();
      let response = "";

      // Append user's query bubble to chat thread
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: query || (currentCapturedScreen || base64Data ? "Screen Context Analysis" : "Screen Query"),
        timestamp: timestampStr,
        base64Screenshot: currentCapturedScreen || (base64Data ? `data:image/jpeg;base64,${base64Data}` : undefined),
      };
      setChatMessages((prev) => [...prev, userMsg]);

      if (base64Data) {
        let prompt = query || "Summarize what you see on my screen in a few helpful bullet points.";
        if (isGuideMode) {
          prompt += '\nProvide step-by-step guidance. Include JSON block at end: ```json\n[{"stepNumber":1,"x":300,"y":200,"label":"Step 1","description":"Click here","annotationType":"circle"}]\n```';
        }
        response = await window.electron.claudeVision(prompt, base64Data);
      } else {
        if (!query) return;
        response = await window.electron.claudeChat(query);
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

      // Append assistant's response bubble to chat thread
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response,
        timestamp: timestampStr,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      saveHistoryEntry(query, response, currentCapturedScreen || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null));
      setCapturedScreenshot(null);
    } catch (err) {
      console.error('Assist error:', err);
      const is503 = String(err).includes('503') || String(err).includes('Service Unavailable');
      const errText = is503
        ? "Claude API is currently experiencing high demand (503 Service Unavailable). Please click Retry below."
        : "Sorry, I had trouble reaching the AI service. Please check your connection.";

      setAiResponse(errText);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: errText,
        timestamp: timestampStr,
        isError: true,
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, capturedScreenshot, autoAttachScreenshot, speak, saveHistoryEntry, isGuideMode]);

  const handleSmart = async () => {
    if (!inputValue) return;
    setIsAiLoading(true);
    try {
      const response = await window.electron.claudeChat(inputValue);
      setAiResponse(response);
      speak(response);
      saveHistoryEntry(inputValue, response, null);
    } catch (err) {
      console.error('Smart error:', err);
      setAiResponse("Sorry, I had trouble reaching Claude.");
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
    const explicitUrl = /^https?:\/\/\S+$/i.test(browserQuery);
    const domainOnly = /^[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(browserQuery);
    if (explicitUrl || domainOnly) {
      const targetUrl = explicitUrl ? browserQuery : `https://${browserQuery}`;
      const summary = `Opening ${targetUrl}.`;
      loadAiHereUrl(targetUrl);
      setAiHereStatus(summary);
      setBrowserSteps((prevSteps) => [{ query: browserQuery, timestamp: actionTimestamp, targetUrl, summary }, ...prevSteps]);
      return;
    }

    setWindowMode('aihere');
    setClickyStatus('Researching the web...');
    setAiHereStatus(`Understanding your goal and researching: “${browserQuery}”`);

    let runtimeTaskId = '';
    try {
      setAiHereStatus('Planning parallel browser workers...');
      const planResponse = await window.electron.claudeWebPlan(browserQuery);
      if (planResponse.success === false) throw new Error(planResponse.error);
      const plannedTracks = planResponse.tracks.slice(0, 4);
      const provisionalTaskSteps: BrowserStep[] = plannedTracks.map((track, index) => ({
        query: track,
        timestamp: actionTimestamp,
        targetUrl: `https://www.google.com/search?q=${encodeURIComponent(track)}`,
        summary: `Worker ${index + 1} is researching this track...`,
        kind: 'task' as const,
      }));
      setBrowserSteps((prevSteps) => [...provisionalTaskSteps, ...prevSteps]);
      setAiHereStatus(`${plannedTracks.length} browser workers are researching in parallel...`);
      const plannedRuntime = await window.electron.dispatchTaskCommand({
        type: 'create',
        goal: browserQuery,
        workerGoals: plannedTracks,
      });
      runtimeTaskId = plannedRuntime.tasks[0]?.id || '';
      if (runtimeTaskId) {
        await window.electron.dispatchTaskCommand({ type: 'status', taskId: runtimeTaskId, status: 'running', message: 'Parallel browser workers are researching' });
      }
      const response = await window.electron.claudeWebResearch(browserQuery, plannedTracks);
      if (response.success === false) throw new Error(response.error);

      loadAiHereUrl(response.result.targetUrl);
      setAiHereStatus(response.result.answer);
      if (runtimeTaskId) {
        for (const source of response.result.sources.slice(0, 12)) {
          await window.electron.dispatchTaskCommand({ type: 'evidence', taskId: runtimeTaskId, evidence: { title: source.title, url: source.url, confidence: 0.8 } });
        }
        await window.electron.dispatchTaskCommand({ type: 'status', taskId: runtimeTaskId, status: 'completed', message: `${response.result.tracks.length} workers completed; ${response.result.sources.length} sources collected` });
      }
      setBrowserSteps((prevSteps) => {
        const taskSteps = response.result.tracks.map((track) => ({
          query: track.task,
          timestamp: actionTimestamp,
          targetUrl: track.targetUrl,
          summary: track.answer,
          kind: 'task' as const,
        }));
        const sourceSteps = response.result.sources.map((source) => ({
          query: source.title,
          timestamp: actionTimestamp,
          targetUrl: source.url,
          summary: `Source: ${source.url}`,
          kind: 'source' as const,
        }));
        return [
          {
            query: browserQuery,
            timestamp: actionTimestamp,
            targetUrl: response.result.targetUrl,
            summary: `Research completed using ${response.result.sources.length} source${response.result.sources.length === 1 ? '' : 's'}.`,
            kind: 'summary' as const,
          },
          ...taskSteps,
          ...sourceSteps,
          ...prevSteps.filter((step) => !(step.kind === 'task' && step.timestamp === actionTimestamp)),
        ];
      });
      speak(response.result.answer);
    } catch (err) {
      if (runtimeTaskId) {
        await window.electron.dispatchTaskCommand({ type: 'status', taskId: runtimeTaskId, status: 'failed', message: (err as Error).message });
      }
      const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(browserQuery)}`;
      loadAiHereUrl(fallbackUrl);
      setAiHereStatus(`The research agent could not finish: ${(err as Error).message}. Opened search results instead.`);
    } finally {
      setClickyStatus('Idle');
    }
  }, [loadAiHereUrl, speak]);

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

      const responseText = await window.electron.claudeChat(automationPrompt);
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
  // Hides the Inqora window, captures the desktop, gets target coordinates from Claude Vision,
  // and displays a pointing arrow overlay on the screen to guide the user visually.
  const handleGuidance = useCallback(async (queryText: string) => {
    setGuideSteps([]);
    setScreenAnnotations([]);
    setCurrentStepIndex(0);
    setGuideText("Scanning desktop contents...");
    const guideScreenWidth = window.screen.width || window.innerWidth;
    const guideScreenHeight = window.screen.height || window.innerHeight;
    setArrowPos({
      x: Math.round(guideScreenWidth * 0.14),
      y: Math.round(guideScreenHeight * 0.72)
    });
    try {
      // captureScreen handles window hiding and restoration automatically in main process
      const screenSnapshotData = await getScreenContext() || (await window.electron.captureScreen()).split(',')[1];
      const screenshotDimensions = await getScreenshotDimensions(screenSnapshotData);

      const visionSearchPrompt = `You are Blinky Guide, a visual teacher drawing over the user's current screen.
The user's request is: "${queryText}".

Analyze the screenshot. If this is a concept, diagram, slide, article, or video frame, explain it by connecting your explanation to the visible parts. If this is a simple locate/click request, highlight the exact target.

The screenshot is exactly ${screenshotDimensions.width} pixels wide by ${screenshotDimensions.height} pixels high. Locate visible edges and centers at native image resolution. Return integer pixel coordinates, not percentages and not values rounded to tens.

Return 2-4 friendly explanatory sentences followed by exactly one JSON block:
\`\`\`json
{
  "summary": "Short spoken explanation",
  "coordinateSpace": {"unit":"pixels","width":${screenshotDimensions.width},"height":${screenshotDimensions.height}},
  "annotations": [
    {"id":"a1","type":"arrow","x1":192,"y1":216,"x2":672,"y2":432,"label":"What this arrow explains"},
    {"id":"a2","type":"circle","x":1056,"y":486,"width":269,"height":130,"label":"Important visible area"}
  ]
}
\`\`\`

All coordinates and sizes must be image pixels within the declared coordinateSpace. Available types:
- arrow or line: x1, y1, x2, y2, label
- circle or box: x, y, width, height, label
- label: x, y, label

Use 2-6 annotations for explanations and 1-2 for simple pointing. Keep annotations away from the bottom 15% where the Blinky Guide controls appear. Only annotate things actually visible in the screenshot. For UI targets, put arrow endpoints at the exact visual center of the icon, text, or control and fit circles/boxes tightly to its visible edges.`;

      const claudeResponse = await window.electron.claudeVision(visionSearchPrompt, screenSnapshotData);
      let annotationPlan = parseScreenAnnotationPlan(
        claudeResponse,
        screenshotDimensions.width,
        screenshotDimensions.height
      );

      if (annotationPlan) {
        setGuideText('Verifying annotation alignment...');
        const proposedPlan = claudeResponse.match(/```json\s*([\s\S]*?)\s*```/i)?.[1]
          || JSON.stringify(annotationPlan);
        const verificationPrompt = `You are a strict screen-annotation geometry verifier.
The screenshot is ${screenshotDimensions.width} x ${screenshotDimensions.height} pixels.
The proposed annotation plan is:
${proposedPlan}

Inspect the screenshot again and return ONLY a corrected JSON object using the same schema and pixel coordinateSpace.
- Move every arrow endpoint to the exact center of the visible item it names.
- Fit boxes tightly to visible edges with 4-10 pixels of padding.
- Circles must surround a compact object; convert long line-shaped circles into arrows or tight boxes.
- Remove any annotation whose claimed target is not clearly visible.
- Do not start shapes in unrelated video margins, logos, subtitles, or empty space.
- Keep labels short; label placement is handled by the renderer.
- Preserve the explanation summary.`;
        const verificationResponse = await window.electron.claudeVision(verificationPrompt, screenSnapshotData);
        const verifiedPlan = parseScreenAnnotationPlan(
          verificationResponse,
          screenshotDimensions.width,
          screenshotDimensions.height
        );
        if (verifiedPlan) {
          annotationPlan = {
            summary: verifiedPlan.summary || annotationPlan.summary,
            annotations: verifiedPlan.annotations,
          };
        }
      }

      if (annotationPlan) {
        setScreenAnnotations(annotationPlan.annotations);
        const firstAnnotation = annotationPlan.annotations[0];
        const firstTargetX = firstAnnotation.type === 'arrow' || firstAnnotation.type === 'line'
          ? firstAnnotation.x2
          : firstAnnotation.x;
        const firstTargetY = firstAnnotation.type === 'arrow' || firstAnnotation.type === 'line'
          ? firstAnnotation.y2
          : firstAnnotation.y;
        setArrowPos({
          x: ((firstTargetX ?? 50) / 100) * window.screen.width,
          y: ((firstTargetY ?? 40) / 100) * window.screen.height
        });
        const explanation = annotationPlan.summary || claudeResponse.replace(/```json[\s\S]*?```/i, '').trim();
        setGuideText(explanation);
        speak(explanation);
        return;
      }

      const coordinateMatch = claudeResponse.match(/\[(\d+),\s*(\d+)\]/);
      if (coordinateMatch) {
        const xPercentCoordinate = parseInt(coordinateMatch[1]);
        const yPercentCoordinate = parseInt(coordinateMatch[2]);

        // Position the arrow overlay relative to the viewport size (which is full-screen in Guide Mode)
        setArrowPos({
          x: (xPercentCoordinate / 100) * window.screen.width,
          y: (yPercentCoordinate / 100) * window.screen.height
        });
      } else {
        // Fallback arrow placement if coordinate detection fails
        setArrowPos({ x: window.screen.width / 2, y: 150 });
      }

      const guidanceDescription = claudeResponse.replace(/\[\d+,\s*\d+\]/, '').trim();
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
- GUIDANCE also includes visual teaching requests about current on-screen study material, diagrams, slides, articles, or videos (e.g., "annotate this diagram", "explain this YouTube frame on screen", "draw arrows to show this concept", "show how these parts connect").
- CONVERSATION: A general chat question, reflection, help, welcome greeting, or non-automation query (e.g., "what is the capital of France?", "explain photosynthesis", "who are you").

Respond with ONLY one word: BROWSER, AUTOMATION, GUIDANCE, or CONVERSATION. Do not write punctuation, markdown, or any other explanations.`;

      const classificationResult = await window.electron.claudeChat(intentClassificationPrompt);
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

  useEffect(() => {
    if (!isVoiceTypingFallback || !inputValue.trim()) return;
    setVoiceInputStatus(`Heard: "${inputValue}" - waiting for you to finish...`);
    const pauseTimer = window.setTimeout(() => {
      const transcript = inputValue.trim();
      setIsVoiceTypingFallback(false);
      setIsListening(false);
      setVoiceInputStatus(`Heard: "${transcript}" - processing...`);
      handleSpeechInput(transcript);
    }, 2500);
    return () => window.clearTimeout(pauseTimer);
  }, [inputValue, isVoiceTypingFallback, handleSpeechInput]);

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
          console.warn('Browser speech recognition warning:', event.error);
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
      window.electron.cancelSpeechRecognition();
      setIsVoiceTypingFallback(false);
      // Stop Web Speech API if active
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      setIsListening(false);
      setVoiceInputStatus('Listening cancelled.');
      setClickyStatus('Idle');
    } else {
      setIsListening(true);
      setVoiceInputStatus('Listening… Speak now, then pause.');
      setClickyStatus('Listening...');

      if (window.electron.platform === 'win32') {
        let usingVoiceTyping = false;
        try {
          const result = await window.electron.transcribeSpeech();
          if (result.success) {
            setInputValue(result.text);
            setVoiceInputStatus(`Heard: “${result.text}” — processing…`);
            setClickyStatus('Understanding...');
            handleSpeechInput(result.text);
          } else if ('error' in result) {
            setInputValue('');
            setVoiceInputStatus('Opening Windows Voice Typing...');
            document.querySelector<HTMLInputElement>('[data-testid="chat-composer"] input')?.focus();
            const fallback = await window.electron.startWindowsVoiceTyping();
            if (fallback.success) {
              usingVoiceTyping = true;
              setIsVoiceTypingFallback(true);
              setVoiceInputStatus('Listening with Windows Voice Typing...');
            } else {
              const fallbackError = fallback.error || result.error;
              setVoiceInputStatus(fallbackError);
              setClickyStatus(fallbackError);
              setIsListening(false);
            }
          }
        } catch (speechError) {
          console.error('Windows speech recognition failed:', speechError);
          setVoiceInputStatus('Speech recognition failed. Restart Blinky and try again.');
          setClickyStatus('Speech recognition failed. Please try again.');
        } finally {
          if (!usingVoiceTyping) setIsListening(false);
        }
        return;
      }

      // Use the browser speech API on non-Windows platforms.
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (speechErr) {
          console.warn("Web Speech start warning:", speechErr);
          setIsListening(false);
          setVoiceInputStatus('Speech recognition is unavailable.');
          setClickyStatus('Speech recognition is unavailable.');
        }
      } else {
        setIsListening(false);
        setVoiceInputStatus('Speech recognition is unavailable.');
        setClickyStatus('Speech recognition is unavailable.');
      }
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const greeting = await window.electron.claudeChat("Write a very short, friendly 1-sentence welcome message for a desktop AI assistant called Blinky.");
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
    window.electron.setIgnoreMouseEvents(false);
  };

  const handleMouseLeave = () => {
    if (windowMode === 'aihere' || isRegionSelecting) {
      window.electron.setIgnoreMouseEvents(false);
    } else if (isGuideMode || clickThrough) {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    } else {
      window.electron.setIgnoreMouseEvents(false);
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
        speechSupported={speechSupported}
        isListening={isListening}
        toggleListening={toggleListening}
        guideInput={inputValue}
        setGuideInput={setInputValue}
        handleGuideQuerySubmit={handleQuerySubmit}
        screenAnnotations={screenAnnotations}
      />

      <div
        className="window-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: isGuideMode ? 'none' : 'flex' }}
      >
        {/* Top Control Bar (Hidden in Minimal Logo Mode) */}
        {windowMode !== 'logo' && (
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
            isListening={isListening}
            toggleListening={toggleListening}
          />
        )}

        {/* 1. Minimal Logo Mode Pill */}
        {windowMode === 'logo' && (
          <LogoBar setWindowMode={setWindowMode} />
        )}

        {/* 2. Main Assistant & Search Panels */}
        {windowMode !== 'toolbar' && windowMode !== 'aihere' && windowMode !== 'logo' && (
          <AssistantPanel
            showPanel={showPanel}
            onQuit={() => {
              // The preload bridge is loaded only when Electron starts. Keep a native
              // window-close fallback so this still works after renderer hot reloads
              // or when an older packaged preload is running.
              window.electron?.quitApp?.();
              window.setTimeout(() => window.close(), 100);
            }}
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
            voiceInputStatus={voiceInputStatus}
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
            bgOpacity={bgOpacity}
            chatMessages={chatMessages}
          />
        )}

        {/* 2. Embedded AI Here browser and voice companion overlay */}
        {windowMode === 'aihere' && (
          <AIHereBrowser
            currentUrl={currentUrl}
            aiHerePrompt={aiHerePrompt}
            setAiHerePrompt={setAiHerePrompt}
            handleAiHereBrowse={handleAiHereBrowse}
            openUrl={loadAiHereUrl}
            speechSupported={speechSupported}
            isListening={isListening}
            toggleListening={toggleListening}
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
