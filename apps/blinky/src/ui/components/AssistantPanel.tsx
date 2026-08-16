import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Camera,
  Loader,
  Navigation,
  MessageSquare,
  Zap,
  ShieldCheck,
  Play,
  RefreshCw,
  Trash2,
  Mic,
  Volume2,
  VolumeX,
  Square,
  History,
  Clock,
  Image as ImageIcon,
  Bot,
  User,
  AlertCircle,
  X
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { HistoryItem, ChatMessage } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface AssistantPanelProps {
  showPanel: boolean;
  onQuit: () => void;
  activeTab: 'assist' | 'search';
  takeManualScreenshot: () => void;
  isAiLoading: boolean;
  isGuideMode: boolean;
  aiResponse: string;
  setIsGuideMode: (mode: boolean) => void;
  handleTemplateClick: (text: string) => void;
  capturedScreenshot: string | null;
  clearScreenshot: () => void;
  speechSupported: boolean;
  isListening: boolean;
  toggleListening: () => void;
  voiceInputStatus: string;
  inputValue: string;
  setInputValue: (val: string) => void;
  handleQuerySubmit: () => void;
  autoAttachScreenshot: boolean;
  setAutoAttachScreenshot: (val: boolean) => void;
  handleSmart: () => void;
  isVoiceMuted: boolean;
  setIsVoiceMuted: (val: boolean) => void;
  isSpeaking: boolean;
  stopSpeaking: () => void;
  chatHistory: HistoryItem[];
  clearHistory: () => void;
  loadHistoryItem: (item: HistoryItem) => void;
  isFocusMode?: boolean;
  setIsFocusMode?: (val: boolean) => void;
  bgOpacity?: number;
  chatMessages?: ChatMessage[];
}

/**
 * AssistantPanel manages the display of AI chat response streams, search template controls,
 * image thumbnails, local history logs, and bottom input buttons.
 */
export function AssistantPanel({
  showPanel,
  onQuit,
  activeTab,
  takeManualScreenshot,
  isAiLoading,
  isGuideMode,
  aiResponse,
  setIsGuideMode,
  handleTemplateClick,
  capturedScreenshot,
  clearScreenshot,
  speechSupported,
  isListening,
  toggleListening,
  voiceInputStatus,
  inputValue,
  setInputValue,
  handleQuerySubmit,
  autoAttachScreenshot,
  setAutoAttachScreenshot,
  handleSmart,
  isVoiceMuted,
  setIsVoiceMuted,
  isSpeaking,
  stopSpeaking,
  chatHistory,
  clearHistory,
  loadHistoryItem,
  isFocusMode,
  setIsFocusMode,
  bgOpacity = 0.75,
  chatMessages = []
}: AssistantPanelProps) {
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat thread to bottom when new messages arrive or loading changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, aiResponse, isAiLoading]);

  // Render Focus Bar View when in Pure Speakable / Typeable Mode
  if (isFocusMode) {
    return (
      <Card
        className="w-full backdrop-blur-2xl border-white/20 p-2 shadow-2xl transition-all duration-300"
        style={{ backgroundColor: `rgba(10, 10, 18, ${bgOpacity})` }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant={isListening ? "destructive" : "cyan"}
            size="icon"
            className={`h-8 w-8 rounded-full ${isListening ? 'animate-pulse' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Listening... Click to stop" : "Speak to Blinky"}
          >
            <Mic size={15} />
          </Button>

          <Input
            type="text"
            className="flex-1 h-8 text-xs bg-white/5 border-white/15"
            placeholder={isListening ? "Listening to your voice..." : "Type or speak to Blinky..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
          />

          <Button
            variant={isVoiceMuted ? "destructive" : "secondary"}
            size="xs"
            className="h-8 px-2"
            onClick={() => setIsVoiceMuted(!isVoiceMuted)}
            title={isVoiceMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isVoiceMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </Button>

          <Button
            variant="accent"
            size="xs"
            className="h-8 px-3"
            onClick={handleQuerySubmit}
            disabled={isAiLoading || (!inputValue && !capturedScreenshot)}
          >
            {isAiLoading ? <Loader size={13} className="animate-spin" /> : "Ask"}
          </Button>

          {setIsFocusMode && (
            <Button
              variant="outline"
              size="xs"
              className="h-8 px-2 text-[11px]"
              onClick={() => setIsFocusMode(false)}
              title="Expand Full Panel"
            >
              Expand
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="assistant-panel w-full max-w-3xl max-h-[calc(100vh-84px)] min-h-0 flex-1 pointer-events-auto"
        >
          <Card
            className="h-full min-h-0 flex flex-col backdrop-blur-2xl border-white/15 shadow-2xl shadow-black overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: `rgba(10, 10, 18, ${bgOpacity})` }}
          >
            {/* Header containing title, voice mute, and manual screenshot controls */}
            <CardHeader className="shrink-0 flex flex-row items-center justify-between p-3.5 pb-3 border-b border-white/10">
              <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                {activeTab === 'search' ? <Search size={14} className="text-purple-400" /> : <Sparkles size={14} className="text-cyan-400" />}
                <span>
                  {activeTab === 'search' ? 'Meeting Search Console' : 'Context Assistant'}
                </span>
              </CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  variant={isVoiceMuted ? "destructive" : "secondary"}
                  size="xs"
                  className="h-7 px-2.5 gap-1.5"
                  onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                  title={isVoiceMuted ? "Unmute Voice Response" : "Mute Voice Response"}
                >
                  {isVoiceMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{isVoiceMuted ? "Voice Off" : "Voice On"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 px-2.5 gap-1.5 bg-white/5 hover:bg-white/15"
                  onClick={takeManualScreenshot}
                >
                  <Camera size={12} className="text-cyan-400" />
                  <span>Capture Context</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/60 hover:bg-red-500/15 hover:text-red-300"
                  onClick={onQuit}
                  title="Quit Blinky"
                  aria-label="Quit Blinky"
                >
                  <X size={14} />
                </Button>
              </div>
            </CardHeader>

            {/* Active Speaking Indicator Banner */}
            {isSpeaking && (
              <div className="flex items-center justify-between bg-blue-600/20 border-b border-blue-500/30 px-4 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-3 bg-cyan-400 rounded animate-bounce" />
                    <span className="w-1 h-3 bg-cyan-400 rounded animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-3 bg-cyan-400 rounded animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs font-semibold text-cyan-300">
                    Speaking response...
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="xs"
                  className="h-6 px-2 text-[10px] gap-1 font-bold"
                  onClick={stopSpeaking}
                  title="Stop voice output midway"
                >
                  <Square size={9} fill="currentColor" /> Stop Speaking
                </Button>
              </div>
            )}

            <CardContent className="flex flex-1 min-h-0 flex-col gap-4 p-4">
              {/* Scrollable conversation and contextual controls */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4 scrollbar-thin"
              >
              {/* Chat Thread Container */}
              <div className="min-h-[120px] space-y-3">
                {isGuideMode ? (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-200 flex items-center gap-2">
                    <Navigation size={14} className="text-purple-400" />
                    <span>“Guide Mode Active. Speak or ask me how to do anything on your screen.”</span>
                  </div>
                ) : chatMessages.length === 0 ? (
                  /* Initial Greeting Message Bubble */
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Bot size={14} className="text-cyan-400" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-3 max-w-[85%] text-xs text-white/90">
                      <MarkdownRenderer content={aiResponse} />
                    </div>
                  </div>
                ) : (
                  /* Multi-turn Conversational Chat Bubbles */
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={14} className="text-cyan-400" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-gradient-to-r from-cyan-600/30 to-purple-600/30 border border-cyan-400/40 text-cyan-50 rounded-tr-none shadow-md shadow-cyan-950/40'
                            : msg.isError
                            ? 'bg-red-500/15 border border-red-500/40 text-red-200 rounded-tl-none'
                            : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none'
                        }`}
                      >
                        {msg.sender === 'user' && (
                          <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold mb-1 border-b border-cyan-500/20 pb-1">
                            <span className="flex items-center gap-1"><User size={10} /> You</span>
                            <span className="text-white/40">{msg.timestamp}</span>
                          </div>
                        )}

                        {msg.base64Screenshot && (
                          <div className="mb-2">
                            <img
                              src={msg.base64Screenshot}
                              alt="Attached Screen Context"
                              className="w-32 h-20 object-cover rounded-lg border border-cyan-400/30 shadow-md"
                            />
                            <Badge variant="cyan" className="mt-1 text-[9px] px-1 py-0">
                              <ImageIcon size={9} className="mr-1" /> Screen Context Attached
                            </Badge>
                          </div>
                        )}

                        {msg.isError ? (
                          <div className="flex items-start gap-2">
                            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="m-0 font-semibold">{msg.text}</p>
                              <Button
                                variant="destructive"
                                size="xs"
                                className="mt-2 h-6 px-2 text-[10px]"
                                onClick={() => handleQuerySubmit()}
                              >
                                <RefreshCw size={10} className="mr-1" /> Retry Query
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <MarkdownRenderer content={msg.text} />
                        )}
                      </div>

                      {msg.sender === 'user' && (
                        <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={14} className="text-purple-300" />
                        </div>
                      )}
                    </div>
                  ))
                )}

                {isAiLoading && (
                  <div className="flex items-center gap-2 text-white/70 py-2 pl-9">
                    <Loader className="animate-spin text-cyan-400" size={14} />
                    <span className="text-xs">{isGuideMode ? "Locating UI elements..." : "Analyzing screen context..."}</span>
                  </div>
                )}
              </div>

              {/* Quick tabs switching mode under Assist tab */}
              {activeTab === 'assist' && (
                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <Button
                    variant={!isGuideMode && !showHistoryDrawer ? "cyan" : "ghost"}
                    size="xs"
                    className="h-7 px-3 gap-1.5"
                    onClick={() => {
                      setIsGuideMode(false);
                      setShowHistoryDrawer(false);
                    }}
                  >
                    <Sparkles size={12} /> Assist
                  </Button>
                  <Button
                    variant={isGuideMode ? "purple" : "ghost"}
                    size="xs"
                    className="h-7 px-3 gap-1.5"
                    onClick={() => {
                      setIsGuideMode(true);
                      setShowHistoryDrawer(false);
                    }}
                  >
                    <Navigation size={12} /> Guide Me
                  </Button>
                  <Button
                    variant={showHistoryDrawer ? "default" : "ghost"}
                    size="xs"
                    className="h-7 px-3 gap-1.5"
                    onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                  >
                    <History size={12} /> History ({chatHistory?.length || 0})
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 px-3 gap-1.5 text-white/70 hover:text-white"
                    onClick={() => handleTemplateClick("Suggest 3 followup questions I can ask.")}
                  >
                    <MessageSquare size={12} /> Followups
                  </Button>
                </div>
              )}

              {/* Local History Drawer Display */}
              {showHistoryDrawer && (
                <div className="bg-black/60 border border-white/10 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                      <Clock size={13} className="text-purple-400" />
                      <span>Saved Local Memory ({chatHistory.length})</span>
                    </div>
                    {chatHistory.length > 0 && (
                      <Button variant="destructive" size="xs" className="h-6 px-2 text-[10px]" onClick={clearHistory}>
                        <Trash2 size={10} className="mr-1" /> Clear All
                      </Button>
                    )}
                  </div>

                  {chatHistory.length === 0 ? (
                    <p className="text-xs text-white/50 py-2">No saved chat sessions yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {chatHistory.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 cursor-pointer transition-colors"
                          onClick={() => {
                            loadHistoryItem(item);
                            setShowHistoryDrawer(false);
                          }}
                        >
                          <div className="flex justify-between text-[11px] font-semibold text-cyan-300">
                            <span className="truncate">{item.prompt || "Screen Context Analysis"}</span>
                            <span className="text-white/40 text-[10px]">{item.timestamp}</span>
                          </div>
                          {item.base64Screenshot && (
                            <Badge variant="cyan" className="mt-1 text-[9px] px-1 py-0">
                              <ImageIcon size={9} className="mr-1" /> Screenshot Saved
                            </Badge>
                          )}
                          <p className="text-[11px] text-white/70 line-clamp-2 mt-1">
                            {item.response}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick search templates under Search tab */}
              {activeTab === 'search' && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[10px] font-extrabold tracking-wider text-white/50 uppercase">
                    SALES & MEETING TEMPLATES
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-7 gap-1.5 text-[11px] bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300"
                      onClick={() => handleTemplateClick("Explain the key term or metric on my screen.")}
                    >
                      <Zap size={11} /> Explain Metric
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-7 gap-1.5 text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300"
                      onClick={() => handleTemplateClick("Give me a professional objection handler for what is visible on screen.")}
                    >
                      <MessageSquare size={11} /> Objection Handler
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-7 gap-1.5 text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                      onClick={() => handleTemplateClick("Verify claims and fact check what is on screen.")}
                    >
                      <ShieldCheck size={11} /> Fact Checker
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-7 gap-1.5 text-[11px] bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-300"
                      onClick={() => handleTemplateClick("List visible action items and next steps.")}
                    >
                      <Play size={11} /> Extract Todo
                    </Button>
                  </div>
                </div>
              )}

              {/* Screen capture preview block */}
              {capturedScreenshot && (
                <div className="flex items-center gap-3 bg-white/5 border border-white/15 rounded-xl p-2">
                  <img
                    src={capturedScreenshot}
                    className="w-16 h-12 object-cover rounded-lg border border-white/20"
                    alt="Capture Preview"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <Camera size={11} className="text-cyan-400" /> Active Screen Context
                    </div>
                    <div className="text-[10px] text-white/60 truncate">
                      Captured snapshot will be attached with your query.
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={takeManualScreenshot} title="Retake">
                      <RefreshCw size={12} />
                    </Button>
                    <Button variant="destructive" size="icon" className="h-7 w-7" onClick={clearScreenshot} title="Remove">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              )}
              </div>

              {voiceInputStatus && (
                <div
                  className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] ${
                    isListening
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200 animate-pulse'
                      : 'border-white/10 bg-white/5 text-white/70'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {voiceInputStatus}
                </div>
              )}

              {/* Text and voice input submission controllers */}
              <div data-testid="chat-composer" className="shrink-0 flex items-center gap-2 pt-2 border-t border-white/10">
                {speechSupported && (
                  <Button
                    variant={isListening ? "destructive" : "cyan"}
                    size="icon"
                    className={`h-9 w-9 rounded-xl ${isListening ? 'animate-pulse ring-2 ring-red-500' : ''}`}
                    onClick={toggleListening}
                    title={isListening ? "Listening... Click to stop" : "Speak to Blinky"}
                    type="button"
                  >
                    <Mic size={15} />
                  </Button>
                )}

                <Input
                  type="text"
                  className="flex-1 h-9 text-xs"
                  placeholder={isGuideMode ? "How do I click..." : "Ask about your screen..."}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
                />

                <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded accent-cyan-400 cursor-pointer"
                    checked={autoAttachScreenshot}
                    onChange={(e) => setAutoAttachScreenshot(e.target.checked)}
                  />
                  <span>Auto-Screen</span>
                </label>

                <Button
                  variant="purple"
                  size="xs"
                  className="h-9 px-3 gap-1"
                  onClick={handleSmart}
                  title="Query text model only"
                >
                  <Zap size={12} /> Smart
                </Button>

                <Button
                  variant="accent"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => handleQuerySubmit()}
                >
                  <Play size={12} fill="currentColor" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
