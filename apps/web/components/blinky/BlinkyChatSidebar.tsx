"use client";

import React from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { BlinkyChatSession } from "@/types";

export interface BlinkyChatSidebarProps {
  sessions: BlinkyChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export const BlinkyChatSidebar: React.FC<BlinkyChatSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}) => {
  return (
    <aside className="flex flex-col w-64 border-r border-border bg-card/50 p-3 space-y-3">
      <div className="flex items-center justify-between px-2 pt-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={onNewSession}
          aria-label="New chat session"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {sessions.map((sess) => {
          const isActive = sess.id === activeSessionId;
          return (
            <div
              key={sess.id}
              onClick={() => onSelectSession(sess.id)}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{sess.title}</span>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={(e) => onDeleteSession(sess.id, e)}
                  aria-label="Delete chat"
                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/20 ${
                    isActive ? "text-primary-foreground" : "text-destructive"
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
