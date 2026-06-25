import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Menu, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports from local layers
import Sidebar from "../components/chat/Sidebar";
import ModelSelector from "../components/chat/ModelSelector";
import FileSelector from "../components/chat/FileSelector";
import ChatContent from "../components/chat/ChatContent";
import BudgetDashboard from "../components/chat/BudgetDashboard";
import {
  Conversation,
  ChatMessage,
  ModelType,
  chatService,
} from "../lib/api";
import { storage } from "../lib/storage";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Screen width for responsive sidebar on Web
  const [screenWidth, setScreenWidth] = useState(
    Platform.OS === "web" ? window.innerWidth : Dimensions.get("window").width
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const isLargeScreen = Platform.OS === "web" && screenWidth >= 768;

  // Check backend server status
  const checkServerStatus = async () => {
    try {
      // Try to fetch files to test connectivity
      await chatService.getFiles();
      setServerOnline(true);
    } catch (err) {
      console.warn("[API] Server check failed. Server appears to be offline.", err);
      setServerOnline(false);
    }
  };

  const createInitialSession = () => {
    const newChat: Conversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      model: "general",
      messages: [],
      timestamp: Date.now(),
    };
    setConversations([newChat]);
    setActiveId(newChat.id);
    storage.setItem("rag_conversations", JSON.stringify([newChat]));
    storage.setItem("rag_active_id", newChat.id);
  };

  const fetchFiles = async () => {
    try {
      const res = await chatService.getFiles();
      if (res.success) {
        setFiles(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch files from server", err);
    }
  };

  // Load conversations and files on mount
  useEffect(() => {
    const initApp = async () => {
      await checkServerStatus();
      
      // Load conversations
      const saved = await storage.getItem("rag_conversations");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Conversation[];
          setConversations(parsed);
          
          const savedActiveId = await storage.getItem("rag_active_id");
          if (savedActiveId && parsed.some((c) => c.id === savedActiveId)) {
            setActiveId(savedActiveId);
          } else if (parsed.length > 0 && parsed[0]) {
            setActiveId(parsed[0].id);
          }
        } catch (e) {
          console.error("Failed to parse saved conversations", e);
          createInitialSession();
        }
      } else {
        createInitialSession();
      }

      // Fetch uploaded files
      fetchFiles();
    };

    initApp();
  }, []);

  // Sync conversations to storage
  const syncConversations = async (updated: Conversation[]) => {
    setConversations(updated);
    await storage.setItem("rag_conversations", JSON.stringify(updated));
  };

  const handleNewChat = () => {
    const newChat: Conversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      model: "general",
      messages: [],
      timestamp: Date.now(),
    };
    const updated = [newChat, ...conversations];
    syncConversations(updated);
    setActiveId(newChat.id);
    storage.setItem("rag_active_id", newChat.id);
  };

  const handleDeleteChat = (id: string) => {
    let updated = conversations.filter((c) => c.id !== id);
    if (updated.length === 0) {
      const newChat: Conversation = {
        id: Date.now().toString(),
        title: "New Conversation",
        model: "general",
        messages: [],
        timestamp: Date.now(),
      };
      updated = [newChat];
    }
    
    syncConversations(updated);
    
    // Adjust active ID if we deleted the current one
    if (activeId === id) {
      const nextActive = updated[0];
      if (nextActive) {
        setActiveId(nextActive.id);
        storage.setItem("rag_active_id", nextActive.id);
      }
    }
  };

  const handleSelectChat = (id: string) => {
    setActiveId(id);
    storage.setItem("rag_active_id", id);
  };

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0];

  const handleSelectModel = (model: ModelType) => {
    if (!activeConversation) return;
    const updated = conversations.map((c) =>
      c.id === activeConversation.id ? { ...c, model } : c
    );
    syncConversations(updated);
  };

  const handleSelectFile = (fileName: string) => {
    if (!activeConversation) return;
    const updated = conversations.map((c) =>
      c.id === activeConversation.id ? { ...c, selectedFile: fileName } : c
    );
    syncConversations(updated);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversation || isLoading) return;

    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const updatedMessages = [...activeConversation.messages, userMsg];

    // Set first message as conversation title if it was named default
    const title =
      activeConversation.messages.length === 0
        ? text.slice(0, 26) + (text.length > 26 ? "..." : "")
        : activeConversation.title;

    // Optimistic Update
    const updatedConvList = conversations.map((c) =>
      c.id === activeConversation.id
        ? { ...c, messages: updatedMessages, title }
        : c
    );
    await syncConversations(updatedConvList);

    try {
      let assistantResponse = "";
      let pdfUrl: string | undefined = undefined;
      let mockReasoning = undefined;
      let mockTools = undefined;
      let mockConfirmation = undefined;

      const isAnalyze = text.toLowerCase().includes("analyze");
      const isConfirm = text.toLowerCase().includes("confirm");

      if (activeConversation.model === "research") {
        const res = await chatService.sendMessage("research", text);
        if (res.success && res.data) {
          assistantResponse = `### Research Report Generated\n\nI have generated a research report for you based on **${text}**. You can download the LaTeX compiled PDF document using the link below.`;
          // The server research endpoint returns res.pdfUrl
          pdfUrl = (res as any).pdfUrl;
        } else {
          assistantResponse = "Failed to generate research report.";
        }
      } else if (activeConversation.model === "pdf") {
        if (!activeConversation.selectedFile) {
          assistantResponse = "Please upload or select a PDF document first before querying.";
        } else {
          const res = await chatService.sendPdfMessage(text, activeConversation.selectedFile);
          assistantResponse = res.data || "No response generated from file.";
        }
      } else if (activeConversation.model === "budget") {
        // Budget logic is local dashboard, standard reply
        assistantResponse = "Budget planner updated. Please view the dashboard above.";
      } else {
        // general, finance, legal models
        const res = await chatService.sendMessage(activeConversation.model as any, text);
        assistantResponse = res.data || "No response received.";
        
        // Replicate web logic for analysis mockups
        if (isAnalyze) {
          mockReasoning = {
            steps: [
              { title: "Context Analysis", content: "Extracting entities, constraints and variables from query context.", status: "complete" as const },
              { title: "Document Scanning", content: "Cross-referencing matching items against stored document indexes.", status: "complete" as const },
              { title: "Logical Synthesis", content: "Evaluating rules and synthesizing final answer payload.", status: "complete" as const }
            ]
          };
          mockTools = [
            { name: "semantic_search", args: { query: text, limit: 3 }, status: "success" as const }
          ];
        }

        // Replicate confirmation trigger
        if (isConfirm) {
          mockConfirmation = true;
        }
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantResponse,
        pdfUrl,
        reasoning: mockReasoning,
        toolCalls: mockTools,
        requiresConfirmation: mockConfirmation,
        confirmed: false,
      };

      const finalConversations = conversations.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...updatedMessages, assistantMsg] }
          : c
      );
      await syncConversations(finalConversations);
    } catch (err: any) {
      console.error("Message send failed:", err);
      const errMsg = err.response?.data?.error || err.message || "Network error. Make sure server is running.";
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Error: ${errMsg}`,
        error: true,
      };

      const finalConversations = conversations.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...updatedMessages, errorMsg] }
          : c
      );
      await syncConversations(finalConversations);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = (msgId: string) => {
    if (!activeConversation) return;
    const updatedMessages = activeConversation.messages.map((m) =>
      m.id === msgId ? { ...m, confirmed: true } : m
    );
    const updated = conversations.map((c) =>
      c.id === activeConversation.id ? { ...c, messages: updatedMessages } : c
    );
    syncConversations(updated);
  };

  if (!activeConversation) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-zinc-950">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Safe area padding for mobile
  const contentPlatformPadding = Platform.select({
    ios: { paddingTop: insets.top },
    android: { paddingTop: insets.top },
    web: { paddingTop: 0 }
  });

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: "#ffffff" }, contentPlatformPadding]} className="dark:bg-zinc-950">
      <View className="flex-1 flex-row bg-white dark:bg-zinc-950">
        {/* Sidebar Left Navigation (Permanent on Desktop Web, Slide-over on mobile) */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          conversations={conversations}
          activeId={activeId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* Main Content Area */}
        <View className="flex-1 flex-col h-full bg-white dark:bg-zinc-950">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-zinc-900/60 bg-white dark:bg-zinc-950">
            <View className="flex-row items-center space-x-3">
              {/* Hamburger Button for mobile */}
              {!isLargeScreen && (
                <Pressable
                  onPress={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-lg bg-gray-50 dark:bg-zinc-900 active:scale-95"
                >
                  <Menu size={18} className="text-gray-600 dark:text-zinc-400" />
                </Pressable>
              )}

              <Text className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
                {activeConversation.title || "Chat Session"}
              </Text>
            </View>

            <View className="flex-row items-center space-x-3">
              {/* Server Offline Banner */}
              {serverOnline === false && (
                <View className="flex-row items-center space-x-1 px-2.5 py-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-full">
                  <AlertTriangle size={10} color="#ef4444" />
                  <Text className="text-[9px] font-bold text-red-500 uppercase">
                    Offline
                  </Text>
                </View>
              )}
              {serverOnline === true && (
                <View className="flex-row items-center space-x-1 px-2.5 py-1 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-full">
                  <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <Text className="text-[9px] font-bold text-green-600 dark:text-green-400 uppercase">
                    Server Online
                  </Text>
                </View>
              )}

              {/* Refresh connectivity status */}
              <Pressable
                onPress={checkServerStatus}
                className="p-1.5 rounded-full bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700/50 active:scale-95"
              >
                <RefreshCw size={12} className="text-gray-500 dark:text-zinc-400" />
              </Pressable>
            </View>
          </View>

          {/* Model Selector Bar */}
          <ModelSelector
            selectedModel={activeConversation.model}
            onSelectModel={handleSelectModel}
          />

          {/* File Selector Bar (Only for PDF Chat mode) */}
          {activeConversation.model === "pdf" && (
            <FileSelector
              selectedFile={activeConversation.selectedFile}
              onSelectFile={handleSelectFile}
              files={files}
              onRefreshFiles={fetchFiles}
            />
          )}

          {/* Core Panel: Either Budget Dashboard or Message Stream */}
          {activeConversation.model === "budget" ? (
            <View className="flex-1 bg-gray-50 dark:bg-zinc-950">
              <BudgetDashboard />
            </View>
          ) : (
            <ChatContent
              conversation={activeConversation}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onConfirmAction={handleConfirmAction}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
