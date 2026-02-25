"use client"

import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { useState, useEffect } from "react"
import axios from "axios"
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatContent from "@/components/chat/ChatContent";

const SERVER_URL = "http://localhost:3001";

type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research"; // Updated models

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
    reasoning?: {
        steps: {
            title: string;
            content: string;
            status: "complete" | "running" | "pending";
        }[];
    };
    toolCalls?: {
        name: string;
        args: Record<string, any>;
        status: "pending" | "success" | "error";
    }[];
    requiresConfirmation?: boolean;
    confirmed?: boolean;
};

type Conversation = {
    id: string;
    title: string;
    model: ModelType;
    messages: ChatMessage[];
    selectedFile?: string;
    timestamp: number;
};


export default function FullChatApp() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeId, setActiveId] = useState<string>("")
    const [files, setFiles] = useState<string[]>([])

    // Load from localStorage on mount or create initial
    useEffect(() => {
        const saved = localStorage.getItem("rag_conversations");
        if (saved) {
            const parsed = JSON.parse(saved);
            setConversations(parsed);
            if (parsed.length > 0) setActiveId(parsed[0].id);
        } else {
            handleNewChat();
        }
        fetchFiles();
    }, []);

    // Save to localStorage
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem("rag_conversations", JSON.stringify(conversations));
        }
    }, [conversations]);

    const fetchFiles = async () => {
        try {
            const res = await axios.get<{ success: boolean; data: string[] }>(
                `${SERVER_URL}/api/v1/message/get-files`
            );
            if (res.data.success) {
                setFiles(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch files", err);
        }
    };

    const handleNewChat = () => {
        const newChat: Conversation = {
            id: Date.now().toString(),
            title: "New Conversation",
            model: "general",
            messages: [],
            timestamp: Date.now()
        };
        setConversations(prev => [newChat, ...prev]);
        setActiveId(newChat.id);
    };

    const handleDeleteChat = (id: string) => {
        setConversations(prev => {
            const filtered = prev.filter(c => c.id !== id);
            if (activeId === id && filtered.length > 0) setActiveId(filtered[0]?.id || "");
            else if (filtered.length === 0) handleNewChat();
            return filtered;
        });
    };

    const updateConversation = (id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const activeConversation = conversations.find(c => c.id === activeId) || conversations[0];

    if (!activeConversation) return null;

    return (
        <SidebarProvider>
            <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                setActiveId={setActiveId}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
            />
            <SidebarInset>
                <ChatContent
                    conversation={activeConversation}
                    updateConversation={updateConversation}
                    files={files}
                    fetchFiles={fetchFiles}
                />
            </SidebarInset>
        </SidebarProvider>
    )
}