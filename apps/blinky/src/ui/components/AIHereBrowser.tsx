import { ArrowLeft, ArrowRight, RefreshCw, Globe, Mic, Play, Loader, Sparkles } from 'lucide-react';
import { VoiceActionPanel, type ExecutionLog } from './VoiceActionPanel';

export interface BrowserStep {
  query: string;
  timestamp: string;
  targetUrl: string;
  summary: string;
}

interface AIHereBrowserProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webviewRef: React.RefObject<any>;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  handleWebviewBack: () => void;
  handleWebviewForward: () => void;
  handleWebviewReload: () => void;
  aiHerePrompt: string;
  setAiHerePrompt: (val: string) => void;
  handleAiHereBrowse: (queryText: string) => void;
  speechSupported: boolean;
  isListening: boolean;
  toggleListening: () => void;
  webviewLoading: boolean;
  aiHereStatus: string;
  browserSteps: BrowserStep[];
  executionLogs: ExecutionLog[];
  clickyStatus: string;
}

/**
 * AIHereBrowser component renders the customized browser window wrapper
 * that displays web search findings and integrates the voice activity log panel.
 */
export function AIHereBrowser({
  webviewRef,
  currentUrl,
  canGoBack,
  canGoForward,
  handleWebviewBack,
  handleWebviewForward,
  handleWebviewReload,
  aiHerePrompt,
  setAiHerePrompt,
  handleAiHereBrowse,
  speechSupported,
  isListening,
  toggleListening,
  webviewLoading,
  aiHereStatus,
  browserSteps,
  executionLogs,
  clickyStatus
}: AIHereBrowserProps) {
  return (
    <div className="clicky-container aihere-container">
      {/* Top Address & Navigation bar */}
      <div className="clicky-nav-bar">
        <button
          className="clicky-nav-btn"
          onClick={handleWebviewBack}
          disabled={!canGoBack}
          title="Go back"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          className="clicky-nav-btn"
          onClick={handleWebviewForward}
          disabled={!canGoForward}
          title="Go forward"
        >
          <ArrowRight size={14} />
        </button>
        <button
          className="clicky-nav-btn"
          onClick={handleWebviewReload}
          title="Reload page"
        >
          <RefreshCw size={13} />
        </button>

        <div className="clicky-address-bar">{currentUrl}</div>

        <div className="aihere-status-pill">
          <Globe size={13} />
          AI Here
        </div>
      </div>

      {/* Address action input bar */}
      <div className="aihere-command-bar">
        <input
          type="text"
          className="input-field"
          placeholder="Tell AI Here what to search or browse..."
          value={aiHerePrompt}
          onChange={(e) => setAiHerePrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && aiHerePrompt.trim()) {
              handleAiHereBrowse(aiHerePrompt);
              setAiHerePrompt("");
            }
          }}
        />
        {speechSupported && (
          <button
            className={`chat-mic-btn ${isListening ? 'active' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Listening... Click to stop" : "Speak to AI Here"}
            type="button"
          >
            <Mic size={14} />
          </button>
        )}
        <button
          className="play-btn"
          onClick={() => {
            if (aiHerePrompt.trim()) {
              handleAiHereBrowse(aiHerePrompt);
              setAiHerePrompt("");
            }
          }}
        >
          <Play size={12} fill="currentColor" />
        </button>
      </div>

      {/* Embedded webview frame along with the side log console */}
      <div className="aihere-workspace">
        <div className="aihere-browser-panel">
          <div className="clicky-webview-wrapper">
            {/* Custom Electron webview tag for secure external site rendering */}
            <webview
              ref={webviewRef}
              src={currentUrl}
              className="clicky-webview"
            />

            {webviewLoading && (
              <div className="webview-loader">
                <Loader className="spinner" size={24} />
                <span>Loading AI Here browser...</span>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel listing navigation status and history steps */}
        <div className="aihere-side-panel">
          <div className="aihere-side-header">
            <Sparkles size={13} />
            Browser Agent
          </div>
          <div className="aihere-status-text">{aiHereStatus}</div>

          <div className="aihere-step-list">
            {browserSteps.length === 0 ? (
              <div className="cly-log-empty">
                Ask for a web search and the agent will open it here.
              </div>
            ) : (
              browserSteps.map((step, idx) => (
                <div className="aihere-step" key={`${step.timestamp}-${idx}`}>
                  <span className="cly-log-timestamp">{step.timestamp}</span>
                  <strong>{step.query}</strong>
                  <span>{step.summary}</span>
                </div>
              ))
            )}
          </div>

          {/* Integrates VoiceActionPanel */}
          <VoiceActionPanel
            isListening={isListening}
            clickyStatus={clickyStatus}
            toggleListening={toggleListening}
            executionLogs={executionLogs}
          />
        </div>
      </div>
    </div>
  );
}
