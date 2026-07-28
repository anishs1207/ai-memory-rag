"use client";

import React from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

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

export const BlinkyVoiceSettings: React.FC<BlinkyVoiceSettingsProps> = ({
  ttsEnabled,
  onToggleTts,
  selectedVoice,
  onSelectVoice,
  voiceRate,
  onChangeRate,
  voicePitch,
  onChangePitch,
  voiceVolume,
  onChangeVolume,
  voicesList,
  isListening,
  onToggleListening,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          {ttsEnabled ? (
            <Volume2 className="h-4 w-4 text-primary" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
          Voice & Speech Engine
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleListening}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {isListening ? (
              <>
                <Mic className="h-3.5 w-3.5" /> Listening...
              </>
            ) : (
              <>
                <MicOff className="h-3.5 w-3.5" /> Mic Speech
              </>
            )}
          </button>

          <button
            onClick={onToggleTts}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              ttsEnabled
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {ttsEnabled ? "TTS On" : "TTS Off"}
          </button>
        </div>
      </div>

      {ttsEnabled && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-muted-foreground">Select Synthetic Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">System Default Voice</option>
              {voicesList.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Speech Rate</span>
              <span>{voiceRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceRate}
              onChange={(e) => onChangeRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Voice Pitch</span>
              <span>{voicePitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={voicePitch}
              onChange={(e) => onChangePitch(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BlinkyVoiceSettings;
