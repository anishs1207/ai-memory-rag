"use client"

import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { useState, useEffect } from "react"
import axios from "axios"
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatContent from "@/components/chat/ChatContent";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
    setConversations,
    setActiveId,
    addConversation,
    deleteConversation,
    updateConversation as reduxUpdateConversation,
} from "@/redux/chatSlice";
import { Conversation } from "@/types";
import { SERVER_URL } from "@/lib/server-url";

export default function FullChatApp() {
    const dispatch = useAppDispatch();
    const conversations = useAppSelector(state => state.chat.conversations);
    const activeId = useAppSelector(state => state.chat.activeId);
    const [files, setFiles] = useState<string[]>([])

    // Load from localStorage on mount or create initial chat session
    useEffect(() => {
        const saved = localStorage.getItem("rag_conversations");
        if (saved) {
            const parsed = JSON.parse(saved);
            dispatch(setConversations(parsed));
        } else {
            handleNewChat();
        }
        fetchFiles();
    }, [dispatch]);

    // Save to localStorage whenever conversations list updates
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
            timestamp: Date.now(),
            llm: "claude"
        };
        dispatch(addConversation(newChat));
    };

    const handleDeleteChat = (id: string) => {
        // If we delete the last remaining chat session, create a new one first for continuous session availability
        if (conversations.length === 1 && conversations[0]?.id === id) {
            const newChat: Conversation = {
                id: Date.now().toString(),
                title: "New Conversation",
                model: "general",
                messages: [],
                timestamp: Date.now(),
                llm: "claude"
            };
            dispatch(addConversation(newChat));
            dispatch(deleteConversation(id));
        } else {
            dispatch(deleteConversation(id));
        }
    };

    const updateConversation = (id: string, updates: Partial<Conversation>) => {
        dispatch(reduxUpdateConversation({ id, updates }));
    };

    const activeConversation = conversations.find(c => c.id === activeId) || conversations[0];

    const handleSetActiveId = (id: string) => {
        dispatch(setActiveId(id));
    };

    if (!activeConversation) return null;

    return (
        <SidebarProvider>
            <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                setActiveId={handleSetActiveId}
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
