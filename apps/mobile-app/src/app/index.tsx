import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// Imports from local layers
import Sidebar from "../components/chat/Sidebar";
import ModelSelector from "../components/chat/ModelSelector";
import EngineSelector from "../components/chat/EngineSelector";
import FileSelector from "../components/chat/FileSelector";
import ChatContent from "../components/chat/ChatContent";
import BudgetDashboard from "../components/chat/BudgetDashboard";
import {
  ChatMessage,
  ModelType,
  chatService,
} from "../lib/api";
import { useChatStore } from "../stores/chat-store";

export default function HomeScreen() {
  // State
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const hasHydrated = useChatStore((state) => state.hasHydrated);
  const createChat = useChatStore((state) => state.createChat);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const selectChat = useChatStore((state) => state.selectChat);
  const updateChat = useChatStore((state) => state.updateChat);
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

  // Check the backend and load server-owned files on mount. Chats hydrate through Zustand.
  useEffect(() => {
    const initApp = async () => {
      await checkServerStatus();
      await fetchFiles();
    };

    initApp();
  }, []);

  const handleNewChat = () => {
    createChat();
  };

  const handleDeleteChat = (id: string) => {
    deleteChat(id);
  };

  const handleSelectChat = (id: string) => {
    selectChat(id);
  };

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0];

  const handleSelectModel = (model: ModelType) => {
    if (!activeConversation) return;
    updateChat(activeConversation.id, { model });
  };

  const handleSelectFile = (fileName: string) => {
    if (!activeConversation) return;
    updateChat(activeConversation.id, { selectedFile: fileName });
  };

  // Update active conversation's LLM engine model
  const handleSelectLlm = (llm: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter") => {
    if (!activeConversation) return;
    updateChat(activeConversation.id, { llm });
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
    updateChat(activeConversation.id, { messages: updatedMessages, title });

    try {
      let assistantResponse = "";
      let pdfUrl: string | undefined = undefined;
      let mockReasoning = undefined;
      let mockTools = undefined;
      let mockConfirmation = undefined;

      const isAnalyze = text.toLowerCase().includes("analyze");
      const isConfirm = text.toLowerCase().includes("confirm");

      if (activeConversation.model === "research") {
        const res = await chatService.sendMessage("research", text, activeConversation.llm || "gemini");
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
          const res = await chatService.sendPdfMessage(text, activeConversation.selectedFile, activeConversation.llm || "gemini");
          assistantResponse = res.data || "No response generated from file.";
        }
      } else if (activeConversation.model === "budget") {
        // Budget logic is local dashboard, standard reply
        assistantResponse = "Budget planner updated. Please view the dashboard above.";
      } else {
        // general, finance, legal models
        const res = await chatService.sendMessage(activeConversation.model as any, text, activeConversation.llm || "gemini");
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

      useChatStore.getState().updateChat(activeConversation.id, {
        messages: [...updatedMessages, assistantMsg],
      });
    } catch (err: any) {
      console.error("Message send failed:", err);
      const errMsg = err.response?.data?.error || err.message || "Network error. Make sure server is running.";
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Error: ${errMsg}`,
        error: true,
      };

      useChatStore.getState().updateChat(activeConversation.id, {
        messages: [...updatedMessages, errorMsg],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = (msgId: string) => {
    if (!activeConversation) return;
    const updatedMessages = activeConversation.messages.map((m) =>
      m.id === msgId ? { ...m, confirmed: true } : m
    );
    updateChat(activeConversation.id, { messages: updatedMessages });
  };

  if (!hasHydrated || !activeConversation) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-zinc-950">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }} className="dark:bg-[#0e110f]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View className="flex-1 flex-row bg-white dark:bg-[#0e110f]">
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
        <View className="flex-1 flex-col h-full bg-white dark:bg-[#0e110f]">
          {/* Header */}
          <View className="h-16 flex-row items-center justify-between px-4 bg-white dark:bg-[#0e110f]">
            <View className="flex-row items-center flex-1">
              {/* Hamburger Button for mobile */}
              {!isLargeScreen && (
                <Pressable
                  onPress={() => setIsSidebarOpen(true)}
                  className="size-11 mr-3 rounded-xl items-center justify-center bg-[#f5f6f3] dark:bg-[#1b211d] active:opacity-60"
                >
                  <Ionicons name="menu-outline" size={24} color="#626a63" />
                </Pressable>
              )}

              <View className="flex-1">
                <Text numberOfLines={1} className="text-[17px] font-semibold text-[#191d1a] dark:text-[#f1f3f0] max-w-[200px]">
                  {activeConversation.title || "Chat Session"}
                </Text>
                <Text className="text-[12px] text-[#8a918b] dark:text-[#7f8880] capitalize">
                  {activeConversation.model} assistant
                </Text>
              </View>
            </View>

            <Pressable
              onPress={checkServerStatus}
              className="h-10 px-3 rounded-full flex-row items-center bg-[#f5f6f3] dark:bg-[#1b211d] active:opacity-60"
            >
              <View className={`size-1.5 rounded-full mr-1.5 ${serverOnline ? "bg-emerald-500" : serverOnline === false ? "bg-rose-500" : "bg-amber-400"}`} />
              <Text className="text-[12px] font-medium text-[#687069] dark:text-[#aeb5af]">
                {serverOnline ? "Online" : serverOnline === false ? "Offline" : "Checking"}
              </Text>
              <Ionicons name="refresh-outline" size={14} color="#8a918b" style={{ marginLeft: 5 }} />
            </Pressable>
          </View>

          {/* Model Selector Bar */}
          <ModelSelector
            selectedModel={activeConversation.model}
            onSelectModel={handleSelectModel}
          />

          {/* LLM Engine Selector (Only for non-budget modes matching web folder features) */}
          {activeConversation.model !== "budget" && (
            <EngineSelector
              selectedLlm={activeConversation.llm || "gemini"}
              onSelectLlm={handleSelectLlm}
            />
          )}

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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
