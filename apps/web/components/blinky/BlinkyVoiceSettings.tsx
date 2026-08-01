"use client";

import React from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

/**
 * Interface properties for the BlinkyVoiceSettings component.
 */
export interface BlinkyVoiceSettingsProps {
  ttsEnabled: boolean;
  onToggleTts: () => void;
  selectedVoice: string;
  onSelectVoice: (voiceURI: string) => void;
  voiceRate: number;
  onChangeRate: (rate: number) => void;
  voicePitch: number;
  onChangePitch: (pitch: number) => void;
  voiceVolume: number;
  onChangeVolume: (vol: number) => void;
  voicesList: SpeechSynthesisVoice[];
  isListening: boolean;
  onToggleListening: () => void;
}

/**
 * Minimalist voice settings component.
 */
export const BlinkyVoiceSettings: React.FC<BlinkyVoiceSettingsProps> = ({
  ttsEnabled,
  onToggleTts,
  selectedVoice,
  onSelectVoice,
  voiceRate,
  onChangeRate,
  voicePitch,
  onChangePitch,
  voicesList,
  isListening,
  onToggleListening,
}) => {
  return (
    <div id="voice-controls" className="rounded-3xl border border-border/40 bg-card/30 p-6 backdrop-blur-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          {ttsEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          Speech Engine
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleListening}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isListening
                ? "bg-rose-500 text-white animate-pulse"
                : "border border-border/40 bg-card/40 text-foreground hover:bg-accent"
            }`}
          >
            {isListening ? (
              <>
                <Mic className="h-3 w-3" /> Listening
              </>
            ) : (
              <>
                <MicOff className="h-3 w-3 text-muted-foreground" /> Mic
              </>
            )}
          </button>

          <button
            onClick={onToggleTts}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              ttsEnabled
                ? "bg-foreground text-background"
                : "border border-border/40 bg-card/40 text-muted-foreground"
            }`}
          >
            {ttsEnabled ? "TTS Active" : "Muted"}
          </button>
        </div>
      </div>

      {ttsEnabled && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs pt-1">
          <div className="space-y-1.5 sm:col-span-2">
            <select
              value={selectedVoice}
              onChange={(e) => onSelectVoice(e.target.value)}
              aria-label="Voice Selection"
              className="w-full rounded-2xl border border-border/40 bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none"
            >
              <option value="">System Default Voice</option>
              {voicesList.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Speech Rate</span>
              <span className="font-mono text-foreground">{voiceRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceRate}
              onChange={(e) => onChangeRate(parseFloat(e.target.value))}
              aria-label="Speech Rate"
              className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-foreground"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Voice Pitch</span>
              <span className="font-mono text-foreground">{voicePitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={voicePitch}
              onChange={(e) => onChangePitch(parseFloat(e.target.value))}
              aria-label="Voice Pitch"
              className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BlinkyVoiceSettings;


