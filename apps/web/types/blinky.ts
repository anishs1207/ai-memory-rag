import { ComponentType } from "react";

export interface BlinkyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface BlinkyChatSession {
  id: string;
  title: string;
  messages: BlinkyMessage[];
  updatedAt: string;
}

export interface PlatformDownload {
  platform: "macOS" | "Windows" | "Linux";
  version: string;
  arch: string;
  filename: string;
  downloadUrl: string;
  size: string;
  iconName?: string;
}

export interface BlinkyFeature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}
