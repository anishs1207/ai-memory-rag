import {
  BrainCircuit,
  MessageSquare,
  Search,
  Globe,
  Minimize2,
  EyeOff,
  Maximize2,
  MousePointer,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Play,
  ChevronDown
} from 'lucide-react';

interface TopControlBarProps {
  windowMode: 'toolbar' | 'panel' | 'stealth' | 'aihere';
  setWindowMode: (mode: 'toolbar' | 'panel' | 'stealth' | 'aihere') => void;
  activeTab: 'assist' | 'search';
  setActiveTab: (tab: 'assist' | 'search') => void;
  clickThrough: boolean;
  setClickThrough: (val: boolean) => void;
  contentProtected: boolean;
  setContentProtected: (val: boolean) => void;
  bgOpacity: number;
  setBgOpacity: (val: number) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  handleQuerySubmit: () => void;
  showPanel: boolean;
  setShowPanel: (val: boolean) => void;
}

/**
 * TopControlBar is the top header containing layout toggles, tab controls, opacity adjustment,
 * screen protection tools, and context options.
 */
export function TopControlBar({
  windowMode,
  setWindowMode,
  activeTab,
  setActiveTab,
  clickThrough,
  setClickThrough,
  contentProtected,
  setContentProtected,
  bgOpacity,
  setBgOpacity,
  inputValue,
  setInputValue,
  handleQuerySubmit,
  showPanel,
  setShowPanel
}: TopControlBarProps) {
  return (
    <div className="top-bar">
      {/* Brand logo display */}
      <div className="top-bar-logo">
        <BrainCircuit size={15} />
        {windowMode !== 'stealth' && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            INQORA
          </span>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Tabs directing layout and operation modes */}
      <div className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'assist' && windowMode !== 'aihere' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('assist');
            setWindowMode('panel');
          }}
          title="Assistant Panel"
        >
          <MessageSquare size={13} />
          {windowMode !== 'stealth' && <span>Assist</span>}
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'search' && windowMode !== 'aihere' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('search');
            setWindowMode('panel');
          }}
          title="Meeting Search Console"
        >
          <Search size={13} />
          {windowMode !== 'stealth' && <span>Search</span>}
        </button>
        <button
          className={`nav-tab-btn ${windowMode === 'aihere' ? 'active' : ''}`}
          onClick={() => setWindowMode('aihere')}
          title="AI Here Browser"
        >
          <Globe size={13} />
          {windowMode !== 'stealth' && <span>AI Here</span>}
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Buttons switching visual window size/layouts */}
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

      {/* Toggle options for click events through the overlay and transparency settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Click-Through Toggle */}
        <button
          className={`control-icon-btn ${clickThrough ? 'active warning' : ''}`}
          onClick={() => setClickThrough(!clickThrough)}
          title={clickThrough ? "Click-Through Enabled (Clicks pass through outside header)" : "Enable Click-Through"}
        >
          <MousePointer size={13} />
        </button>

        {/* Content Protection Toggle (screen-sharing masking) */}
        <button
          className={`control-icon-btn ${contentProtected ? 'active success' : ''}`}
          onClick={() => setContentProtected(!contentProtected)}
          title={contentProtected ? "Hidden from Screen Share (Invisible overlay active)" : "Hide from Screen Share"}
        >
          {contentProtected ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
        </button>

        {/* Dynamic Opacity input range */}
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

      {/* Compact input query bar visible in minimal Toolbar mode */}
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

      {/* Collapse/Expand toggle button */}
      {windowMode !== 'toolbar' && windowMode !== 'aihere' && (
        <button className="top-bar-btn" onClick={() => setShowPanel(!showPanel)}>
          <ChevronDown
            size={12}
            style={{
              transform: showPanel ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s'
            }}
          />
          {showPanel ? 'Hide' : 'Show'}
        </button>
      )}
    </div>
  );
}
