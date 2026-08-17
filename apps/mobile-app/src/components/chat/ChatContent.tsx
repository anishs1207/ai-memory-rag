import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Clipboard, // added Clipboard for copying message content
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Conversation, SERVER_URL } from "../../lib/api";

interface ChatContentProps {
  conversation: Conversation;
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onConfirmAction: (msgId: string) => void;
}

// Custom Markdown text parser to render headers, bold text, and lists cleanly
function FormattedText({ text, isUser }: { text: string; isUser: boolean }) {
  const textColor = isUser ? "text-white" : "text-gray-800 dark:text-zinc-200";

  // Parse lines to render lists and headers
  const lines = text.split("\n");

  return (
    <View className="space-y-1">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <Text key={idx} className={`text-[16px] font-bold mt-3 mb-1 ${textColor}`}>
              {line.replace("### ", "")}
            </Text>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <Text key={idx} className={`text-[18px] font-bold mt-3 mb-1 ${textColor}`}>
              {line.replace("## ", "")}
            </Text>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <Text key={idx} className={`text-[20px] font-bold mt-4 mb-2 ${textColor}`}>
              {line.replace("# ", "")}
            </Text>
          );
        }

        // Bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.substring(2);
          return (
            <View key={idx} className="flex-row items-start space-x-1.5 pl-2 my-0.5">
              <Text className={`text-[15px] leading-6 ${textColor}`}>•</Text>
              <Text className={`text-[15px] leading-6 flex-1 ${textColor}`}>
                {parseBold(content, isUser)}
              </Text>
            </View>
          );
        }

        // Standard lines
        return (
          <Text key={idx} className={`text-[15px] leading-6 ${textColor}`}>
            {parseBold(line, isUser)}
          </Text>
        );
      })}
    </View>
  );
}

// Parse **bold** syntax inside text
function parseBold(text: string, isUser: boolean) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;

  const fontClass = isUser ? "font-bold text-white" : "font-bold text-gray-900 dark:text-white";

  return parts.map((part, index) => {
    // Odd indices are the matching group (bold text)
    if (index % 2 === 1) {
      return (
        <Text key={index} className={fontClass}>
          {part}
        </Text>
      );
    }
    return part;
  });
}

export default function ChatContent({
  conversation,
  isLoading,
  onSendMessage,
  onConfirmAction,
}: ChatContentProps) {
  const [inputText, setInputText] = useState("");
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null); // tracks the last copied message ID for micro-feedback
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle clipboard text copy with micro-interaction state
  const handleCopyMessage = (msgId: string, content: string) => {
    Clipboard.setString(content);
    setCopiedId(msgId);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  // Auto scroll to bottom when messages or loading state changes
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation.messages.length, isLoading]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInputText("");
  };

  const promptIdeas = [
    { icon: Lightbulb, label: "Explain simply", prompt: "Explain a complex idea to me in simple terms" },
    { icon: TrendingUp, label: "Analyze trends", prompt: "Analyze the key trends in this topic" },
    { icon: Scale, label: "Build a case", prompt: "Help me structure a clear, evidence-based argument" },
  ];

  const toggleReasoning = (msgId: string) => {
    setShowReasoning((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleDownloadPdf = (pdfUrl: string) => {
    const fullUrl = pdfUrl.startsWith("http") ? pdfUrl : `${SERVER_URL}${pdfUrl}`;
    console.log("Opening PDF URL:", fullUrl);
    Linking.openURL(fullUrl).catch((err) =>
      console.error("Failed to open report PDF URL", err)
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#0e110f]">
      {/* Scrollable Messages Area */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, gap: 14, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {conversation.messages.length === 0 ? (
          <View className="flex-1 justify-center pb-8">
            <View className="size-12 rounded-2xl bg-[#171b18] dark:bg-[#f0f2ee] items-center justify-center mb-5">
              <Ionicons name="sparkles-outline" size={21} color="#8b5cf6" />
            </View>
            <Text className="text-[30px] leading-9 font-semibold text-[#191d1a] dark:text-[#f3f5f2] tracking-tight">
              How can I help?
            </Text>
            <Text className="text-[15px] text-[#687068] dark:text-[#a1a8a2] leading-6 mt-3 mb-8 max-w-[320px]">
              Ask a question, explore an idea, or choose a starting point below.
            </Text>
            <View className="space-y-2">
              {promptIdeas.map(({ icon: IdeaIcon, label, prompt }) => (
                <Pressable key={label} onPress={() => setInputText(prompt)} className="h-14 flex-row items-center px-4 bg-[#f8f9f7] dark:bg-[#171c18] border border-[#e5e8e3] dark:border-[#272e29] rounded-2xl active:opacity-60">
                  <View className="size-9 items-center justify-center rounded-xl bg-white dark:bg-[#222923] mr-3">
                    <IdeaIcon size={14} color="#7c3aed" />
                  </View>
                  <Text className="flex-1 text-[14px] font-medium text-[#303631] dark:text-[#dce1dc]">{label}</Text>
                  <Text className="text-[#929993] text-xl">›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          conversation.messages.map((msg) => {
            const isUser = msg.role === "user";
            const isError = msg.error;

            return (
              <View
                key={msg.id}
                className={`flex-row ${isUser ? "justify-end" : "justify-start"} mb-4`}
              >
                {/* Avatar for bot */}
                {!isUser && (
                  <View className="size-9 bg-gray-200 dark:bg-zinc-800 rounded-full items-center justify-center mr-3 border border-gray-300/40 dark:border-zinc-700/50">
                    <Ionicons name="sparkles-outline" size={17} color="#687069" />
                  </View>
                )}

                <View className="max-w-[82%]">
                  {/* Bubble Container */}
                  <View
                    className={`px-4 py-3.5 rounded-2xl shadow-sm border ${
                      isUser
                        ? "bg-violet-600 border-violet-500 rounded-tr-sm"
                        : isError
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 rounded-tl-none"
                        : "bg-white dark:bg-[#1a211c] border-[#e3e6df] dark:border-[#29312b] rounded-tl-sm"
                    }`}
                  >
                    {/* Render message content */}
                    <FormattedText text={msg.content} isUser={isUser} />

                    {/* Clipboard copy action for assistant messages (not errors) */}
                    {!isUser && !isError && (
                      <View className="flex-row justify-end mt-2 pt-2 border-t border-gray-100/50 dark:border-zinc-800/40">
                        <Pressable
                          onPress={() => handleCopyMessage(msg.id, msg.content)}
                          className="flex-row items-center space-x-1 px-2 py-1 rounded bg-gray-55 dark:bg-zinc-800 active:scale-95"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
                              <Text className="text-[11px] font-semibold text-green-600 dark:text-green-400">Copied</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="copy-outline" size={14} color="#9ca3af" />
                              <Text className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Copy</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    )}

                    {/* PDF attachment button (Research Model) */}
                    {msg.pdfUrl && (
                      <Pressable
                        onPress={() => handleDownloadPdf(msg.pdfUrl!)}
                        className="flex-row items-center space-x-2 mt-3.5 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 active:scale-98"
                      >
                        <Ionicons name="document-text-outline" size={18} color="#7c3aed" />
                        <Text className="text-[13px] font-bold text-violet-700 dark:text-violet-300 flex-1 truncate">
                          Download Compiled PDF Report
                        </Text>
                        <Ionicons name="download-outline" size={17} color="#7c3aed" />
                      </Pressable>
                    )}

                    {/* Confirmation Panel */}
                    {msg.requiresConfirmation && (
                      <View className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-900/40 space-y-2">
                        <View className="flex-row items-center space-x-1.5">
                          <Ionicons name="alert-circle-outline" size={17} color="#f97316" />
                          <Text className="text-[12px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                            Requires User Confirmation
                          </Text>
                        </View>
                        
                        {!msg.confirmed ? (
                          <Pressable
                            onPress={() => onConfirmAction(msg.id)}
                            className="w-full py-2.5 bg-orange-500 active:bg-orange-600 rounded-lg items-center justify-center"
                          >
                            <Text className="text-xs font-bold text-white">
                              Confirm Action
                            </Text>
                          </Pressable>
                        ) : (
                          <View className="flex-row items-center justify-center space-x-1.5 py-1.5">
                            <Ionicons name="checkmark-circle-outline" size={17} color="#22c55e" />
                            <Text className="text-xs font-semibold text-green-600 dark:text-green-400">
                              Action Confirmed
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Collapsible Reasoning Steps Accordion (Agentic RAG) */}
                  {!isUser && msg.reasoning?.steps && (
                    <View className="mt-2 ml-1">
                      <Pressable
                        onPress={() => toggleReasoning(msg.id)}
                        className="flex-row items-center space-x-1 py-1 px-2 rounded bg-gray-150/50 dark:bg-zinc-900/45 w-36"
                      >
                        <Ionicons name="search-outline" size={14} color="#7c3aed" />
                        <Text className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex-1">
                          {showReasoning[msg.id] ? "Hide Agent Logic" : "Show Agent Logic"}
                        </Text>
                        {showReasoning[msg.id] ? (
                          <Ionicons name="chevron-up" size={14} color="#687069" />
                        ) : (
                          <Ionicons name="chevron-down" size={14} color="#687069" />
                        )}
                      </Pressable>

                      {showReasoning[msg.id] && (
                        <View className="mt-2 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3.5 transition-all">
                          {msg.reasoning.steps.map((step, sIdx) => (
                            <View key={sIdx} className="flex-row items-start space-x-2.5">
                              <View className="items-center">
                                <View className={`size-5 rounded-full items-center justify-center border text-[9px] ${
                                  step.status === "complete"
                                    ? "bg-green-100 border-green-200 text-green-600 dark:bg-green-950/20 dark:border-green-900/50"
                                    : step.status === "running"
                                    ? "bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/50"
                                    : "bg-gray-100 border-gray-200 text-gray-400 dark:bg-zinc-800"
                                }`}>
                                  {step.status === "complete" ? (
                                    <Ionicons name="checkmark" size={13} color="#16a34a" />
                                  ) : step.status === "running" ? (
                                    <ActivityIndicator size="small" color="#3b82f6" style={{ transform: [{ scale: 0.6 }] }} />
                                  ) : (
                                    <Ionicons name="time-outline" size={13} color="#9ca3af" />
                                  )}
                                </View>
                                {sIdx < (msg.reasoning!.steps.length - 1) && (
                                  <View className="w-[1px] h-6 bg-gray-200 dark:bg-zinc-800 mt-1" />
                                )}
                              </View>

                              <View className="flex-1">
                                <Text className="text-[13px] font-bold text-gray-800 dark:text-zinc-200">
                                  {step.title}
                                </Text>
                                <Text className="text-[12px] text-gray-500 dark:text-zinc-400 leading-5 mt-0.5">
                                  {step.content}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Monospace Tool Execution Panel */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <View className="mt-2 ml-1">
                      {msg.toolCalls.map((tool, tIdx) => (
                        <View
                          key={tIdx}
                          className="bg-zinc-900/90 dark:bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-1.5 w-68 md:w-80"
                        >
                          <View className="bg-zinc-950 px-3 py-1.5 flex-row items-center justify-between border-b border-zinc-850">
                            <View className="flex-row items-center space-x-1.5">
                              <View className="size-4 bg-orange-500 rounded items-center justify-center">
                                <Ionicons name="flash" size={12} color="#ffffff" />
                              </View>
                              <Text className="text-[11px] font-mono font-bold text-zinc-300">
                                Tool: {tool.name}
                              </Text>
                            </View>
                            <Text className="text-[10px] font-bold text-green-500 uppercase">
                              {tool.status}
                            </Text>
                          </View>
                          <View className="p-2.5">
                            <Text className="text-[11px] font-mono text-zinc-400">
                              {JSON.stringify(tool.args, null, 2)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <View className="flex-row justify-start mb-4">
            <View className="size-9 bg-gray-200 dark:bg-zinc-800 rounded-full items-center justify-center mr-3 border border-gray-300/40">
              <Ionicons name="sparkles-outline" size={17} color="#687069" />
            </View>
            <View className="px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-2xl rounded-tl-none">
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View className="mx-4 mb-4 min-h-16 px-2 pl-4 py-2.5 bg-[#f7f8f5] dark:bg-[#171c18] border border-[#dfe3dc] dark:border-[#2a322c] rounded-[22px] flex-row items-end shadow-sm">
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message Inqora"
          placeholderTextColor="#8a918b"
          multiline
          className="flex-1 py-2.5 text-[16px] text-[#191d1a] dark:text-white max-h-[120px]"
        />

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          className={`size-11 ml-2 rounded-2xl items-center justify-center ${
            inputText.trim() && !isLoading ? "bg-[#171b18] dark:bg-[#f0f2ee] active:opacity-70" : "bg-[#e6e9e4] dark:bg-[#2a312c]"
          }`}
        >
          <Ionicons name="arrow-up" size={20} color={inputText.trim() && !isLoading ? "#8b5cf6" : "#a1a7a2"} />
        </Pressable>
      </View>
    </View>
  );
}
