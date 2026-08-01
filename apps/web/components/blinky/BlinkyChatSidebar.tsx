"use client";

import React from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { BlinkyChatSession } from "@/types";

/**
 * Interface properties for the BlinkyChatSidebar component.
 */
export interface BlinkyChatSidebarProps {
  /** Array of active chat sessions */
  sessions: BlinkyChatSession[];
  /** Currently selected chat session ID */
  activeSessionId: string | null;
  /** Callback when selecting a chat session */
  onSelectSession: (id: string) => void;
  /** Callback to initiate a new session */
  onNewSession: () => void;
  /** Callback to delete a session */
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

/**
 * Minimalist chat sidebar component for navigating conversational history.
 */
export const BlinkyChatSidebar: React.FC<BlinkyChatSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}) => {
  return (
    <aside className="flex flex-col w-60 border-r border-border/40 bg-card/30 p-3.5 space-y-3 shrink-0">
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={onNewSession}
          aria-label="New chat session"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-foreground transition-all duration-200 hover:bg-accent hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {sessions.map((sessionItem) => {
          const isActiveSession = sessionItem.id === activeSessionId;
          return (
            <div
              key={sessionItem.id}
              onClick={() => onSelectSession(sessionItem.id)}
              className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-200 ${
                isActiveSession
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-foreground hover:bg-accent/60"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span className="truncate">{sessionItem.title}</span>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={(e) => onDeleteSession(sessionItem.id, e)}
                  aria-label="Delete chat"
                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/20 ${
                    isActiveSession ? "text-primary-foreground" : "text-destructive"
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default BlinkyChatSidebar;

