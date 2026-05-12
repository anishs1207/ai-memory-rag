import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Square, 
  ChevronDown,
  BrainCircuit,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Zap,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [isGuideMode, setIsGuideMode] = useState(false);
  const [arrowPos, setArrowPos] = useState({ x: -100, y: -100 });
  const [guideText, setGuideText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [aiResponse, setAiResponse] = useState<string>("Hello! I'm your Inqora AI assistant. Ask me anything about your screen, or toggle Guide Mode to have me show you the way.");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);


  const stopCapture = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  const startCapture = useCallback(async () => {
    if (!selectedSourceId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSourceId,
          }
        }
      } as MediaStreamConstraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCapturing(true);
    } catch (err) {
      console.error("Error starting capture:", err);
    }
  }, [selectedSourceId]);

  const handleGuideSearch = useCallback(async () => {
    if (!inputValue) return;
    setIsAiLoading(true);
    setGuideText("Scanning screen...");
    
    try {
      const screenshot = await window.electron.captureScreen();
      const base64Data = screenshot.split(',')[1];
      
      const prompt = `The user wants to know: "${inputValue}". 
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
    } catch (err) {
      console.error('Guide error:', err);
      setGuideText("Sorry, I couldn't see your screen properly.");
    } finally {
      setIsAiLoading(false);
    }
  }, [inputValue, speak]);

  const handleAssist = useCallback(async () => {
    if (!inputValue && !isCapturing) return;
    setIsAiLoading(true);
    
    try {
      const screenshot = await window.electron.captureScreen();
      const base64Data = screenshot.split(',')[1];
      
      const prompt = inputValue || "Summarize what you see on my screen in a few helpful bullet points.";
      const response = await window.electron.geminiVision(prompt, base64Data);
      setAiResponse(response);
      speak(response);
    } catch (err) {
      console.error('Assist error:', err);
      setAiResponse("Sorry, I had trouble reaching Gemini Vision.");
    } finally {
      setIsAiLoading(false);
    }
  }, [inputValue, isCapturing, speak]);

  useEffect(() => {
    const initSources = async () => {
      try {
        const screenSources = await window.electron.getSources();
        if (screenSources.length > 0) {
          setSelectedSourceId(prev => prev || screenSources[0].id);
        }
      } catch (err) {
        console.error("Failed to get sources:", err);
      }
    };
    initSources();
    
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        setShowPanel(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        stopCapture();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (isGuideMode) handleGuideSearch();
        else handleAssist();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        setIsGuideMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideMode, handleAssist, handleGuideSearch, stopCapture]);

  const handleMouseEnter = () => {
    if (isGuideMode) {
      window.electron.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (isGuideMode) {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  };

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

  return (
    <div className={`app-container ${isGuideMode ? 'guide-active' : ''}`}>
      {/* Guide Mode Arrow */}
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
              {guideText}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="window-wrapper" 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Top Bar */}
        <div className="top-bar">
          <div className="top-bar-icon">
            <BrainCircuit size={14} />
          </div>
          
          <button className="top-bar-btn" onClick={() => setShowPanel(!showPanel)}>
            <ChevronDown size={14} style={{ transform: showPanel ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
            {showPanel ? 'Hide' : 'Show'}
          </button>

          <button className={`top-bar-btn ${isCapturing ? 'active' : ''}`} onClick={isCapturing ? stopCapture : startCapture}>
            {isCapturing ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
          </button>

          <div className="toolbar-separator" style={{ height: 16, margin: '0 4px' }} />

          <button 
            className={`top-bar-btn ${isGuideMode ? 'active' : ''}`} 
            onClick={() => setIsGuideMode(!isGuideMode)}
            style={{ color: isGuideMode ? '#3b82f6' : '#fff' }}
          >
            <Navigation size={14} />
            Guide
          </button>
        </div>

        {/* Main Panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="assistant-panel"
            >
              <div className="panel-header">
                <button className="pill-btn">What should I say?</button>
              </div>

              <div className="content-block">
                {isAiLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
                    <div className="ai-cursor" /> {isGuideMode ? "Locating..." : "Thinking..."}
                  </div>
                ) : (
                  <p style={{ margin: 0 }}>“{isGuideMode ? "Guide Mode Active. Ask me how to do anything." : aiResponse}”</p>
                )}
              </div>

              <div className="action-row">
                <div className={`action-item ${!isGuideMode ? 'active' : ''}`} onClick={() => setIsGuideMode(false)}>
                  <Sparkles size={14} /> Assist
                </div>
                <div className="action-dot" />
                <div className={`action-item ${isGuideMode ? 'active' : ''}`} onClick={() => setIsGuideMode(true)}>
                  <Navigation size={14} /> Guide Me
                </div>
                <div className="action-dot" />
                <div className="action-item">
                  <MessageSquare size={14} /> Questions
                </div>
                <div className="action-dot" />
                <div className="action-item">
                  <RefreshCw size={14} /> Recap
                </div>
              </div>

              <div className="input-container">
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={isGuideMode ? "How do I..." : "Ask about your screen..."}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (isGuideMode ? handleGuideSearch() : handleAssist())}
                />
                
                <button className="smart-btn" onClick={handleSmart}>
                  <Zap size={14} /> Smart
                </button>
                
                <button className="play-btn" onClick={isGuideMode ? handleGuideSearch : handleAssist}>
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
    </div>
  );
}



export default App;
