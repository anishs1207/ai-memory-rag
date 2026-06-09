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
  Mic
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

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
}

/**
 * AssistantPanel manages the display of AI chat response streams, search template controls,
 * image thumbnails, and bottom input buttons.
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
  handleSmart
}: AssistantPanelProps) {
  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="assistant-panel"
        >
          {/* Header containing title and manual screenshot controls */}
          <div className="panel-header">
            <div className="panel-title">
              {activeTab === 'search' ? <Search size={14} /> : <Sparkles size={14} />}
              <span>
                {activeTab === 'search' ? 'Meeting Search Console' : 'Context Assistant'}
              </span>
            </div>
            <button className="pill-btn" onClick={takeManualScreenshot}>
              <Camera size={12} style={{ marginRight: 4 }} />
              Capture Context
            </button>
          </div>

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
                className={`action-item ${!isGuideMode ? 'active' : ''}`}
                onClick={() => setIsGuideMode(false)}
              >
                <Sparkles size={12} /> Assist
              </div>
              <div className="action-dot" />
              <div
                className={`action-item ${isGuideMode ? 'active' : ''}`}
                onClick={() => setIsGuideMode(true)}
              >
                <Navigation size={12} /> Guide Me
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
