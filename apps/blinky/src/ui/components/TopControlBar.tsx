import { useState } from 'react';
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
  ChevronDown,
  Volume2,
  VolumeX,
  Crop,
  Palette,
  Mic
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface TopControlBarProps {
  windowMode: 'toolbar' | 'panel' | 'stealth' | 'aihere' | 'logo';
  setWindowMode: (mode: 'toolbar' | 'panel' | 'stealth' | 'aihere' | 'logo') => void;
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
  isVoiceMuted: boolean;
  setIsVoiceMuted: (val: boolean) => void;
  cursorColor: 'cyan' | 'purple' | 'green' | 'orange' | 'gold';
  setCursorColor: (color: 'cyan' | 'purple' | 'green' | 'orange' | 'gold') => void;
  startRegionSelection: () => void;
  isFocusMode?: boolean;
  setIsFocusMode?: (val: boolean) => void;
}

/**
 * TopControlBar is the top header containing layout toggles, tab controls, opacity adjustment,
 * screen protection tools, cursor color settings, and context options.
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
  setShowPanel,
  isVoiceMuted,
  setIsVoiceMuted,
  cursorColor,
  setCursorColor,
  startRegionSelection,
  isFocusMode,
  setIsFocusMode
}: TopControlBarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div
      className="top-bar flex items-center gap-2.5 bg-black/80 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/15 shadow-2xl shadow-black/80 pointer-events-auto select-none transition-all duration-300 max-w-full"
      onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
    >
      {/* Brand logo display */}
      <div className="flex items-center gap-1.5 text-cyan-400 font-extrabold text-xs tracking-wider">
        <BrainCircuit size={16} className="text-cyan-400 animate-pulse" />
        {windowMode !== 'stealth' && (
          <span className="font-extrabold text-xs tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            BLINKY
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Focus Mode Quick Toggle */}
      {setIsFocusMode && (
        <Button
          variant={isFocusMode ? "cyan" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setIsFocusMode(!isFocusMode)}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title={isFocusMode ? "Exit Focus Mode" : "Enter Speakable Focus Bar Mode"}
        >
          <Mic size={13} />
        </Button>
      )}

      {/* Tabs directing layout and operation modes */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <Button
          variant={activeTab === 'assist' && windowMode !== 'aihere' ? "default" : "ghost"}
          size="xs"
          className="h-6 px-2 text-[11px] gap-1.5"
          onClick={() => {
            setActiveTab('assist');
            setWindowMode('panel');
          }}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Assistant Panel"
        >
          <MessageSquare size={12} />
          {windowMode !== 'stealth' && <span>Assist</span>}
        </Button>
        <Button
          variant={activeTab === 'search' && windowMode !== 'aihere' ? "default" : "ghost"}
          size="xs"
          className="h-6 px-2 text-[11px] gap-1.5"
          onClick={() => {
            setActiveTab('search');
            setWindowMode('panel');
          }}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Meeting Search Console"
        >
          <Search size={12} />
          {windowMode !== 'stealth' && <span>Search</span>}
        </Button>
        <Button
          variant={windowMode === 'aihere' ? "default" : "ghost"}
          size="xs"
          className="h-6 px-2 text-[11px] gap-1.5"
          onClick={() => setWindowMode('aihere')}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="AI Here Browser"
        >
          <Globe size={12} />
          {windowMode !== 'stealth' && <span>AI Here</span>}
        </Button>
      </div>

      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Buttons switching visual window size/layouts */}
      <div className="flex gap-1">
        <Button
          variant={windowMode === 'logo' ? "purple" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setWindowMode('logo')}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Minimal Logo Mode"
        >
          <BrainCircuit size={13} className="text-purple-400" />
        </Button>
        <Button
          variant={windowMode === 'toolbar' ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setWindowMode('toolbar')}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Toolbar Mode"
        >
          <Minimize2 size={13} />
        </Button>
        <Button
          variant={windowMode === 'stealth' ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setWindowMode('stealth')}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Stealth Mode"
        >
          <EyeOff size={13} />
        </Button>
        <Button
          variant={windowMode === 'panel' ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setWindowMode('panel')}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title="Standard Panel Mode"
        >
          <Maximize2 size={13} />
        </Button>
      </div>

      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Toggle options for click events through overlay and transparency settings */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={clickThrough ? "destructive" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setClickThrough(!clickThrough)}
          onMouseEnter={() => window.electron?.setIgnoreMouseEvents(false)}
          title={clickThrough ? "Click-Through Enabled (Hover or click to toggle OFF)" : "Enable Click-Through"}
        >
          <MousePointer size={13} />
        </Button>

        <Button
          variant={contentProtected ? "cyan" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setContentProtected(!contentProtected)}
          title={contentProtected ? "Hidden from Screen Share" : "Hide from Screen Share"}
        >
          {contentProtected ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
        </Button>

        <Button
          variant={isVoiceMuted ? "destructive" : "ghost"}
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => setIsVoiceMuted(!isVoiceMuted)}
          title={isVoiceMuted ? "Unmute Voice Response" : "Mute Voice Response"}
        >
          {isVoiceMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-cyan-400 hover:text-cyan-300"
          onClick={startRegionSelection}
          title="Circle or Drag to Select Screen Region"
        >
          <Crop size={13} />
        </Button>

        {/* Cursor Color Theme Selector */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title={`Cursor Theme: ${cursorColor}`}
          >
            <Palette size={13} className="text-cyan-400" />
          </Button>

          {showColorPicker && (
            <div className="absolute top-9 right-0 bg-black/95 border border-white/20 rounded-xl p-2 flex gap-2 z-50 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              {(['cyan', 'purple', 'green', 'orange', 'gold'] as const).map((color) => (
                <div
                  key={color}
                  className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-200 hover:scale-125 ${
                    cursorColor === color ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-80'
                  }`}
                  style={{
                    backgroundColor:
                      color === 'cyan' ? '#00f2fe' :
                      color === 'purple' ? '#aa3bff' :
                      color === 'green' ? '#10b981' :
                      color === 'orange' ? '#f59e0b' : '#eab308'
                  }}
                  onClick={() => {
                    setCursorColor(color);
                    setShowColorPicker(false);
                  }}
                  title={`Select ${color} aura`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Opacity Slider */}
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-xl">
          <SlidersHorizontal size={11} className="text-white/60" />
          <input
            type="range"
            min="0.0"
            max="0.95"
            step="0.05"
            value={bgOpacity}
            onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
            className="w-14 h-1 accent-cyan-400 cursor-pointer bg-white/20 rounded-lg appearance-none"
            title={`Transparency: ${Math.round((1 - bgOpacity) * 100)}%`}
          />
        </div>
      </div>

      {/* Compact input query bar visible in minimal Toolbar mode */}
      {windowMode === 'toolbar' && (
        <div className="flex items-center gap-1.5 ml-2">
          <Input
            type="text"
            className="h-7 w-48 text-xs bg-black/60 border-white/20"
            placeholder="Ask Blinky..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
          />
          <Button size="icon" className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40" onClick={() => handleQuerySubmit()}>
            <Play size={10} fill="currentColor" />
          </Button>
        </div>
      )}

      {/* Collapse/Expand toggle button */}
      {windowMode !== 'toolbar' && windowMode !== 'aihere' && (
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2 text-[11px] gap-1 text-white/80 hover:text-white"
          onClick={() => setShowPanel(!showPanel)}
        >
          <ChevronDown
            size={12}
            className={`transition-transform duration-300 ${showPanel ? 'rotate-0' : 'rotate-180'}`}
          />
          {showPanel ? 'Hide' : 'Show'}
        </Button>
      )}
    </div>
  );
}
