import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as LocalAuthentication from "expo-local-authentication";

// Imports from local layers
import Sidebar from "../components/chat/Sidebar";
import ModelSelector from "../components/chat/ModelSelector";
import EngineSelector from "../components/chat/EngineSelector";
import FileSelector from "../components/chat/FileSelector";
import ChatContent from "../components/chat/ChatContent";
import BudgetDashboard from "../components/chat/BudgetDashboard";
import AccountSheet from "../components/account/AccountSheet";
import { LoginScreen, OnboardingScreen } from "../components/auth/AuthExperience";
import {
  ChatAttachment,
  ChatMessage,
  ModelType,
  chatService,
} from "../lib/api";
import { useChatStore } from "../stores/chat-store";
import { useUserStore } from "../stores/user-store";

export default function IndexScreen() {
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useUserStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const biometricLock = useUserStore((state) => state.preferences.biometricLock);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const unlock = async () => {
    if (!biometricLock) return setIsUnlocked(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Inqora", cancelLabel: "Cancel" });
    setIsUnlocked(result.success);
  };

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    if (!biometricLock) {
      queueMicrotask(() => setIsUnlocked(true));
      return;
    }
    LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Inqora", cancelLabel: "Cancel" })
      .then((result) => setIsUnlocked(result.success));
  }, [hasHydrated, isAuthenticated, biometricLock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && biometricLock) setIsUnlocked(false);
    });
    return () => subscription.remove();
  }, [biometricLock]);

  if (!hasHydrated) {
    return <View className="flex-1 items-center justify-center bg-[#f7f5ff] dark:bg-[#100d14]"><ActivityIndicator size="large" color="#6d5dfb" /></View>;
  }
  if (!hasCompletedOnboarding) return <OnboardingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  if (!isUnlocked) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-[#f7f5ff] dark:bg-[#100d14]">
        <View className="size-20 rounded-[28px] bg-[#ece7ff] dark:bg-[#292131] items-center justify-center"><Ionicons name="lock-closed-outline" size={34} color="#6d5dfb" /></View>
        <Text className="mt-5 text-[26px] font-bold text-[#25202b] dark:text-white">Inqora is locked</Text>
        <Text className="mt-2 text-center text-[15px] leading-6 text-[#756f7c] dark:text-[#b7afbf]">Use your device authentication to continue.</Text>
        <Pressable onPress={unlock} className="mt-6 h-14 w-full rounded-[20px] bg-[#6d5dfb] items-center justify-center"><Text className="text-[15px] font-bold text-white">Unlock</Text></Pressable>
      </SafeAreaView>
    );
  }
  return <HomeScreen />;
}

function HomeScreen() {
  // State
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const hasHydrated = useChatStore((state) => state.hasHydrated);
  const createChat = useChatStore((state) => state.createChat);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const selectChat = useChatStore((state) => state.selectChat);
  const updateChat = useChatStore((state) => state.updateChat);
  const renameChat = useChatStore((state) => state.renameChat);
  const togglePin = useChatStore((state) => state.togglePin);
  const duplicateChat = useChatStore((state) => state.duplicateChat);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const profile = useUserStore((state) => state.profile);
  const preferences = useUserStore((state) => state.preferences);
  const [comparingId, setComparingId] = useState<string | null>(null);

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

  useEffect(() => NetInfo.addEventListener((state) => {
    if (!state.isConnected) setServerOnline(false);
    else void checkServerStatus();
  }), []);

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

  const handleSendMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    if (!activeConversation || isLoading) return;

    setIsLoading(true);
    if (preferences.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const controller = new AbortController();
    requestController.current = controller;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      attachments,
      createdAt: Date.now(),
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
        const res = await chatService.sendMessage("research", text, activeConversation.llm || "gemini", controller.signal);
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
          const res = await chatService.sendPdfMessage(text, activeConversation.selectedFile, activeConversation.llm || "gemini", controller.signal);
          assistantResponse = res.data || "No response generated from file.";
        }
      } else if (activeConversation.model === "budget") {
        // Budget logic is local dashboard, standard reply
        assistantResponse = "Budget planner updated. Please view the dashboard above.";
      } else {
        // general, finance, legal models
        const res = await chatService.sendMessage(activeConversation.model as any, text, activeConversation.llm || "gemini", controller.signal);
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
      if (preferences.speakResponses && assistantResponse) Speech.speak(assistantResponse);
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED") return;
      console.error("Message send failed:", err);
      const errMsg = err.response?.data?.error || err.message || "Network error. Make sure server is running.";
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Error: ${errMsg}`,
        error: true,
        retryText: text,
      };

      useChatStore.getState().updateChat(activeConversation.id, {
        messages: [...updatedMessages, errorMsg],
      });
    } finally {
      requestController.current = null;
      setIsLoading(false);
    }
  };

  const handleCompareMessage = async (messageId: string) => {
    if (!activeConversation || comparingId) return;
    const index = activeConversation.messages.findIndex((message) => message.id === messageId);
    const prompt = [...activeConversation.messages.slice(0, index)].reverse().find((message) => message.role === "user")?.content;
    if (!prompt || activeConversation.model === "pdf" || activeConversation.model === "budget") return;
    setComparingId(messageId);
    try {
      const alternate = activeConversation.llm === "smollm" ? "gemini" : "smollm";
      const result = await chatService.sendMessage(activeConversation.model, prompt, alternate);
      const latest = useChatStore.getState().conversations.find((chat) => chat.id === activeConversation.id);
      if (!latest) return;
      updateChat(activeConversation.id, {
        messages: latest.messages.map((message) => message.id === messageId
          ? { ...message, comparison: { label: alternate === "gemini" ? "Gemini" : "SmolLM", content: result.data || "No comparison response received." } }
          : message),
      });
    } finally {
      setComparingId(null);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f5ff" }} className="dark:bg-[#0e110f]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
          <View className="flex-1 flex-row bg-[#f7f5ff] dark:bg-[#0e110f]">
        {/* Sidebar Left Navigation (Permanent on Desktop Web, Slide-over on mobile) */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          conversations={conversations}
          activeId={activeId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={renameChat}
          onTogglePin={togglePin}
          onDuplicateChat={duplicateChat}
        />

        {/* Main Content Area */}
        <View className="flex-1 flex-col bg-[#f7f5ff] dark:bg-[#0e110f]">
          {/* Header */}
          <View className="h-20 flex-row items-center justify-between px-4 bg-[#f7f5ff] dark:bg-[#0e110f]">
            <View className="flex-row items-center flex-1">
              {/* Hamburger Button for mobile */}
              {!isLargeScreen && (
                <Pressable
                  onPress={() => setIsSidebarOpen(true)}
                  className="size-12 mr-3 rounded-2xl items-center justify-center bg-white dark:bg-[#1b211d] border border-[#ebe7f7] dark:border-[#29312b] shadow-sm active:opacity-60"
                >
                  <Ionicons name="menu-outline" size={24} color="#626a63" />
                </Pressable>
              )}

              <View className="flex-1">
                <Text className="text-[11px] text-[#8b8497] dark:text-[#7f8880] mb-0.5">
                  You&apos;re chatting with
                </Text>
                <Text numberOfLines={1} className="text-[18px] font-bold text-[#211f27] dark:text-[#f1f3f0] max-w-[200px]">
                  {activeConversation.title || "Chat Session"}
                </Text>
                <Text className="text-[12px] text-[#756d80] dark:text-[#7f8880] capitalize">
                  {activeConversation.model} assistant
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setIsAccountOpen(true)}
              className="size-11 rounded-full items-center justify-center bg-white dark:bg-[#1b211d] border border-[#ebe7f7] dark:border-[#29312b] shadow-sm active:opacity-60"
            >
              <View className={`absolute right-0 top-0 size-3 rounded-full border-2 border-[#f7f5ff] ${serverOnline ? "bg-emerald-400" : serverOnline === false ? "bg-rose-400" : "bg-amber-400"}`} />
              <Text className="text-[16px] font-bold text-[#6d5dfb]">{profile.displayName.slice(0, 1).toUpperCase()}</Text>
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
              key={activeConversation.id}
              conversation={activeConversation}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onConfirmAction={handleConfirmAction}
              onRetryConnection={checkServerStatus}
              onStop={() => requestController.current?.abort()}
              onRetryMessage={(retryText) => handleSendMessage(retryText)}
              onCompareMessage={handleCompareMessage}
              comparingId={comparingId}
            />
          )}
        </View>
        <AccountSheet visible={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
