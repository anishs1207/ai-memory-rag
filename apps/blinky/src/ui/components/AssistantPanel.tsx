import { useState } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { HistoryItem } from '../types';

interface AssistantPanelProps {
  showPanel: boolean;
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
}

/**
 * AssistantPanel manages the display of AI chat response streams, search template controls,
 * image thumbnails, local history logs, and bottom input buttons.
 */
export function AssistantPanel({
  showPanel,
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
  setIsFocusMode
}: AssistantPanelProps) {
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Render Focus Bar View when in Pure Speakable / Typeable Mode
  if (isFocusMode) {
    return (
      <div className="assistant-panel focus-bar-mode" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`action-btn-secondary ${isListening ? 'listening-pulse' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Listening... Click to stop" : "Speak to Blinky"}
            style={{ borderRadius: '50%', width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Mic size={15} color={isListening ? '#ef4444' : 'var(--accent-cyan)'} />
          </button>

          <input
            type="text"
            className="chat-input-field"
            placeholder={isListening ? "Listening to your voice..." : "Type or speak to Blinky..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
            style={{ flex: 1, margin: 0, height: 34 }}
          />

          <button
            className={`pill-btn ${isVoiceMuted ? 'muted' : ''}`}
            onClick={() => setIsVoiceMuted(!isVoiceMuted)}
            title={isVoiceMuted ? "Unmute Voice" : "Mute Voice"}
            style={{ padding: '6px 10px' }}
          >
            {isVoiceMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          <button
            className="action-btn-primary"
            onClick={handleQuerySubmit}
            disabled={isAiLoading || (!inputValue && !capturedScreenshot)}
            style={{ height: 34, padding: '0 12px', fontSize: '12px' }}
          >
            {isAiLoading ? <Loader size={13} className="spin" /> : "Ask"}
          </button>

          {setIsFocusMode && (
            <button
              className="action-btn-secondary"
              onClick={() => setIsFocusMode(false)}
              title="Expand Full Panel"
              style={{ padding: '6px 10px', fontSize: '11px' }}
            >
              Expand
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="assistant-panel"
        >
          {/* Header containing title, voice mute, and manual screenshot controls */}
          <div className="panel-header">
            <div className="panel-title">
              {activeTab === 'search' ? <Search size={14} /> : <Sparkles size={14} />}
              <span>
                {activeTab === 'search' ? 'Meeting Search Console' : 'Context Assistant'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className={`pill-btn ${isVoiceMuted ? 'muted' : ''}`}
                onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                title={isVoiceMuted ? "Unmute Voice Response" : "Mute Voice Response"}
              >
                {isVoiceMuted ? (
                  <VolumeX size={12} style={{ marginRight: 4 }} />
                ) : (
                  <Volume2 size={12} style={{ marginRight: 4 }} />
                )}
                {isVoiceMuted ? "Voice Off" : "Voice On"}
              </button>
              <button className="pill-btn" onClick={takeManualScreenshot}>
                <Camera size={12} style={{ marginRight: 4 }} />
                Capture Context
              </button>
            </div>
          </div>

          {/* Active Speaking Indicator Banner */}
          {isSpeaking && (
            <div className="speaking-banner">
              <div className="speaking-indicator">
                <span className="audio-wave-bar" />
                <span className="audio-wave-bar" />
                <span className="audio-wave-bar" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  Speaking response...
                </span>
              </div>
              <button
                className="stop-speaking-btn"
                onClick={stopSpeaking}
                title="Stop voice output midway"
              >
                <Square size={10} fill="currentColor" style={{ marginRight: 4 }} />
                Stop Speaking
              </button>
            </div>
          )}

          {/* AI output text block */}
          <div className="content-block">
            {isAiLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                <Loader className="spinner" size={14} />
                <div className="ai-cursor" />{" "}
                {isGuideMode ? "Locating elements..." : "Thinking..."}
              </div>
            ) : isGuideMode ? (
              <p style={{ margin: 0 }}>
                “Guide Mode Active. Ask me how to do anything on screen.”
              </p>
            ) : (
              <MarkdownRenderer content={aiResponse} />
            )}
          </div>

          {/* Quick tabs switching mode under Assist tab */}
          {activeTab === 'assist' && (
            <div className="action-row">
              <div
                className={`action-item ${!isGuideMode && !showHistoryDrawer ? 'active' : ''}`}
                onClick={() => {
                  setIsGuideMode(false);
                  setShowHistoryDrawer(false);
                }}
              >
                <Sparkles size={12} /> Assist
              </div>
              <div className="action-dot" />
              <div
                className={`action-item ${isGuideMode ? 'active' : ''}`}
                onClick={() => {
                  setIsGuideMode(true);
                  setShowHistoryDrawer(false);
                }}
              >
                <Navigation size={12} /> Guide Me
              </div>
              <div className="action-dot" />
              <div
                className={`action-item ${showHistoryDrawer ? 'active' : ''}`}
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              >
                <History size={12} /> History ({chatHistory?.length || 0})
              </div>
              <div className="action-dot" />
              <div
                className="action-item"
                onClick={() => handleTemplateClick("Suggest 3 followup questions I can ask.")}
              >
                <MessageSquare size={12} /> Followups
              </div>
            </div>
          )}

          {/* Local History Drawer Display */}
          {showHistoryDrawer && (
            <div className="history-drawer-container">
              <div className="history-drawer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color="var(--accent-purple)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Saved Local Memory ({chatHistory.length})
                  </span>
                </div>
                {chatHistory.length > 0 && (
                  <button className="clear-history-btn" onClick={clearHistory} title="Clear saved history logs">
                    <Trash2 size={10} style={{ marginRight: 3 }} /> Clear All
                  </button>
                )}
              </div>
              {chatHistory.length === 0 ? (
                <p className="history-empty-text">No saved chat sessions yet. Ask a query to start logging.</p>
              ) : (
                <div className="history-list">
                  {chatHistory.map((item) => (
                    <div
                      key={item.id}
                      className="history-item-card"
                      onClick={() => {
                        loadHistoryItem(item);
                        setShowHistoryDrawer(false);
                      }}
                      title="Click to reload this chat session"
                    >
                      <div className="history-item-top">
                        <span className="history-item-prompt">
                          {item.prompt || "Screen Context Analysis"}
                        </span>
                        <span className="history-item-time">{item.timestamp}</span>
                      </div>
                      {item.base64Screenshot && (
                        <div className="history-item-screenshot-badge">
                          <ImageIcon size={10} style={{ marginRight: 3 }} /> Screen Capture Saved
                        </div>
                      )}
                      <p className="history-item-response-preview">
                        {item.response.length > 100 ? item.response.slice(0, 100) + '...' : item.response}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick search templates under Search tab */}
          {activeTab === 'search' && (
            <div className="search-tab-content">
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-dim)',
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: 6
                }}
              >
                SALES & MEETING TEMPLATES
              </span>
              <div className="search-templates">
                <button
                  className="template-chip"
                  onClick={() => handleTemplateClick("Explain the key term or metric on my screen.")}
                >
                  <Zap size={10} color="var(--accent-purple)" /> Explain Metric
                </button>
                <button
                  className="template-chip"
                  onClick={() =>
                    handleTemplateClick(
                      "Give me a professional objection handler for what is visible on my screen."
                    )
                  }
                >
                  <MessageSquare size={10} color="var(--accent-orange)" /> Objection Handler
                </button>
                <button
                  className="template-chip"
                  onClick={() =>
                    handleTemplateClick("Verify the claims and fact check what is on my screen.")
                  }
                >
                  <ShieldCheck size={10} color="var(--accent-green)" /> Fact Checker
                </button>
                <button
                  className="template-chip"
                  onClick={() => handleTemplateClick("List the visible action items and next steps.")}
                >
                  <Play size={10} color="var(--accent-blue)" /> Extract Todo
                </button>
              </div>
            </div>
          )}

          {/* Screen capture preview block with delete/retake capabilities */}
          {capturedScreenshot && (
            <div className="screenshot-preview-container">
              <img
                src={capturedScreenshot}
                className="screenshot-thumbnail"
                alt="Capture Preview"
              />
              <div className="screenshot-info">
                <span className="screenshot-title">
                  <Camera size={10} /> Active Screen Context
                </span>
                <span className="screenshot-desc">
                  This snapshot will be passed to Gemini for screen awareness.
                </span>
              </div>
              <div className="screenshot-actions">
                <button
                  className="screenshot-btn"
                  onClick={takeManualScreenshot}
                  title="Retake Screenshot"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  className="screenshot-btn danger"
                  onClick={clearScreenshot}
                  title="Remove Screen Context"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Text and voice input submission controllers */}
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

            {/* Checkbox syncing automatic screen capture on query submits */}
            <label
              className="auto-attach-label"
              title="Automatically capture screen when sending query"
            >
              <input
                type="checkbox"
                className="auto-attach-checkbox"
                checked={autoAttachScreenshot}
                onChange={(e) => setAutoAttachScreenshot(e.target.checked)}
              />
              <span>Auto-Screen</span>
            </label>

            <button
              className="smart-btn"
              onClick={handleSmart}
              title="Queries Gemini Text Only"
            >
              <Zap size={12} style={{ marginRight: 2 }} /> Smart
            </button>

            <button className="play-btn" onClick={() => handleQuerySubmit()}>
              <Play size={12} fill="currentColor" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
