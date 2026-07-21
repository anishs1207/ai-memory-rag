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
import {
  ArrowUp,
  Search,
  Zap,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  AlertCircle,
  Bot,
  Copy, // added Copy for message actions
} from "lucide-react-native";
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
            <Text key={idx} className={`text-xs font-extrabold mt-2 mb-1 ${textColor}`}>
              {line.replace("### ", "")}
            </Text>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <Text key={idx} className={`text-sm font-extrabold mt-2 mb-1 ${textColor}`}>
              {line.replace("## ", "")}
            </Text>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <Text key={idx} className={`text-base font-black mt-3 mb-1.5 ${textColor}`}>
              {line.replace("# ", "")}
            </Text>
          );
        }

        // Bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.substring(2);
          return (
            <View key={idx} className="flex-row items-start space-x-1.5 pl-2 my-0.5">
              <Text className={`text-xs ${textColor}`}>•</Text>
              <Text className={`text-xs flex-1 ${textColor}`}>
                {parseBold(content, isUser)}
              </Text>
            </View>
          );
        }

        // Standard lines
        return (
          <Text key={idx} className={`text-xs leading-5 ${textColor}`}>
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
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950">
      {/* Scrollable Messages Area */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {conversation.messages.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20 px-8 space-y-4">
            <View className="bg-blue-100 dark:bg-blue-950/30 p-4 rounded-full border border-blue-200/50 dark:border-blue-900/50">
              <Bot size={40} className="text-blue-600 dark:text-blue-400" />
            </View>
            <Text className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
              Start a Conversation
            </Text>
            <Text className="text-xs text-gray-400 dark:text-zinc-500 text-center leading-5 max-w-[280px]">
              Choose a model configuration from the panel above to test different agent capabilities.
            </Text>
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
                  <View className="size-7 bg-gray-200 dark:bg-zinc-800 rounded-full items-center justify-center mr-2 border border-gray-300/40 dark:border-zinc-700/50">
                    <Bot size={14} className="text-gray-600 dark:text-zinc-400" />
                  </View>
                )}

                <View className="max-w-[82%]">
                  {/* Bubble Container */}
                  <View
                    className={`px-4 py-3.5 rounded-2xl shadow-sm border ${
                      isUser
                        ? "bg-blue-600 border-blue-500 rounded-tr-none"
                        : isError
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 rounded-tl-none"
                        : "bg-white dark:bg-zinc-900 border-gray-150/80 dark:border-zinc-800 rounded-tl-none"
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
                              <CheckCircle2 size={11} className="text-green-500" />
                              <Text className="text-[9px] font-semibold text-green-600 dark:text-green-400">Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={11} className="text-gray-400 dark:text-zinc-500" />
                              <Text className="text-[9px] font-semibold text-gray-500 dark:text-zinc-400">Copy</Text>
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
                        <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <Text className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex-1 truncate">
                          Download Compiled PDF Report
                        </Text>
                        <Download size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </Pressable>
                    )}

                    {/* Confirmation Panel */}
                    {msg.requiresConfirmation && (
                      <View className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-900/40 space-y-2">
                        <View className="flex-row items-center space-x-1.5">
                          <AlertCircle size={14} className="text-orange-500" />
                          <Text className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
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
                            <CheckCircle2 size={14} color="#22c55e" />
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
                        <Search size={10} className="text-blue-500" />
                        <Text className="text-[9px] font-bold text-gray-500 dark:text-zinc-450 uppercase tracking-wider flex-1">
                          {showReasoning[msg.id] ? "Hide Agent Logic" : "Show Agent Logic"}
                        </Text>
                        {showReasoning[msg.id] ? (
                          <ChevronUp size={10} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={10} className="text-gray-500" />
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
                                    <CheckCircle2 size={10} className="text-green-600 dark:text-green-400" />
                                  ) : step.status === "running" ? (
                                    <ActivityIndicator size="small" color="#3b82f6" style={{ transform: [{ scale: 0.6 }] }} />
                                  ) : (
                                    <Clock size={10} className="text-gray-400" />
                                  )}
                                </View>
                                {sIdx < (msg.reasoning!.steps.length - 1) && (
                                  <View className="w-[1px] h-6 bg-gray-200 dark:bg-zinc-800 mt-1" />
                                )}
                              </View>

                              <View className="flex-1">
                                <Text className="text-[10px] font-bold text-gray-800 dark:text-zinc-200">
                                  {step.title}
                                </Text>
                                <Text className="text-[9px] text-gray-500 dark:text-zinc-500 leading-4 mt-0.5">
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
                                <Zap size={10} color="#ffffff" />
                              </View>
                              <Text className="text-[9px] font-mono font-bold text-zinc-300">
                                Tool: {tool.name}
                              </Text>
                            </View>
                            <Text className="text-[8px] font-bold text-green-500 uppercase">
                              {tool.status}
                            </Text>
                          </View>
                          <View className="p-2.5">
                            <Text className="text-[9px] font-mono text-zinc-400">
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
            <View className="size-7 bg-gray-200 dark:bg-zinc-800 rounded-full items-center justify-center mr-2 border border-gray-300/40">
              <Bot size={14} className="text-gray-600 dark:text-zinc-400" />
            </View>
            <View className="px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-2xl rounded-tl-none">
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View className="p-3 bg-white dark:bg-zinc-950 border-t border-gray-150/80 dark:border-zinc-900/60 flex-row items-center space-x-2">
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask a question..."
          placeholderTextColor="#71717a"
          multiline
          className="flex-1 px-4 py-2.5 bg-gray-55 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs text-gray-900 dark:text-white max-h-[80px]"
        />

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          className={`size-9 rounded-full items-center justify-center ${
            inputText.trim() && !isLoading ? "bg-blue-600 active:scale-95" : "bg-gray-100 dark:bg-zinc-800 opacity-60"
          }`}
        >
          <ArrowUp size={16} color={inputText.trim() && !isLoading ? "#ffffff" : "#a1a1aa"} />
        </Pressable>
      </View>
    </View>
  );
}
