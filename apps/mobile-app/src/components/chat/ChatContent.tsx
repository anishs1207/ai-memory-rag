import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Share,
  Keyboard,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { ChatAttachment, Conversation, SERVER_URL } from "../../lib/api";
import { useChatStore } from "../../stores/chat-store";

interface ChatContentProps {
  conversation: Conversation;
  isLoading: boolean;
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  onConfirmAction: (msgId: string) => void;
  onRetryConnection: () => Promise<void>;
  onStop: () => void;
  onRetryMessage: (text: string) => void;
  onCompareMessage: (messageId: string) => void;
  comparingId: string | null;
}

// Custom Markdown text parser to render headers, bold text, and lists cleanly
function FormattedText({ text, isUser }: { text: string; isUser: boolean }) {
  const textColor = isUser ? "text-white" : "text-gray-800 dark:text-zinc-200";
  const lines = text.split("\n");
  const rendered: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || "";

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        code.push(lines[index] || "");
        index += 1;
      }
      rendered.push(
        <View key={`code-${index}`} className="my-2 rounded-xl overflow-hidden bg-[#19161e]">
          {!!language && <Text className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#aaa1b3] bg-[#25212b]">{language}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text selectable className="p-3 text-[13px] leading-5 font-mono text-[#f2edf7]">{code.join("\n")}</Text>
          </ScrollView>
        </View>
      );
      continue;
    }

    const nextLine = lines[index + 1] || "";
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}/.test(nextLine)) {
      const rows: string[][] = [line.split("|").map((cell) => cell.trim()).filter(Boolean)];
      index += 2;
      while (index < lines.length && lines[index]?.includes("|")) {
        rows.push((lines[index] || "").split("|").map((cell) => cell.trim()).filter(Boolean));
        index += 1;
      }
      index -= 1;
      rendered.push(
        <ScrollView key={`table-${index}`} horizontal className="my-2 rounded-xl border border-[#e4deed] dark:border-[#343b36]">
          <View className="min-w-[300px]">
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} className={`flex-row ${rowIndex === 0 ? "bg-[#f0ecff] dark:bg-[#252c27]" : "bg-white dark:bg-[#171c18]"}`}>
                {row.map((cell, cellIndex) => <Text key={cellIndex} className={`min-w-28 flex-1 px-3 py-2 text-[12px] ${rowIndex === 0 ? "font-bold" : ""} text-[#393340] dark:text-[#e4e8e5]`}>{parseInline(cell, isUser)}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s(.+)/);
    if (heading) {
      const size = heading[1]?.length === 1 ? "text-[20px]" : heading[1]?.length === 2 ? "text-[18px]" : "text-[16px]";
      rendered.push(<Text key={index} className={`${size} font-bold mt-3 mb-1 ${textColor}`}>{parseInline(heading[2] || "", isUser)}</Text>);
      continue;
    }

    const bullet = line.match(/^[-*]\s(.+)/);
    const numbered = line.match(/^(\d+)\.\s(.+)/);
    if (bullet || numbered) {
      rendered.push(
        <View key={index} className="flex-row items-start pl-1 my-0.5">
          <Text className={`w-7 text-[15px] leading-6 ${textColor}`}>{numbered ? `${numbered[1]}.` : "•"}</Text>
          <Text className={`text-[15px] leading-6 flex-1 ${textColor}`}>{parseInline((bullet?.[1] || numbered?.[2]) ?? "", isUser)}</Text>
        </View>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      rendered.push(<View key={index} className="my-1 pl-3 border-l-2 border-[#8b5cf6]"><Text className={`text-[14px] italic leading-6 ${textColor}`}>{parseInline(line.slice(2), isUser)}</Text></View>);
      continue;
    }

    rendered.push(<Text key={index} className={`text-[15px] leading-6 ${textColor}`}>{line ? parseInline(line, isUser) : "\n"}</Text>);
  }

  return <View className="gap-0.5">{rendered}</View>;
}

function parseInline(text: string, isUser: boolean) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <Text key={index} className={isUser ? "font-bold text-white" : "font-bold text-gray-900 dark:text-white"}>{token.slice(2, -2)}</Text>;
    if (token.startsWith("`") && token.endsWith("`")) return <Text key={index} className="font-mono bg-black/10 text-violet-700 dark:text-violet-300"> {token.slice(1, -1)} </Text>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <Text key={index} onPress={() => Linking.openURL(link[2] || "")} className={isUser ? "underline text-white" : "underline text-violet-600 dark:text-violet-300"}>{link[1]}</Text>;
    return token;
  });
}

export default function ChatContent({
  conversation,
  isLoading,
  onSendMessage,
  onConfirmAction,
  onRetryConnection,
  onStop,
  onRetryMessage,
  onCompareMessage,
  comparingId,
}: ChatContentProps) {
  const [inputText, setInputText] = useState(conversation.draft || "");
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null); // tracks the last copied message ID for micro-feedback
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const savedPrompts = useChatStore((state) => state.savedPrompts);
  const savePrompt = useChatStore((state) => state.savePrompt);
  const removePrompt = useChatStore((state) => state.removePrompt);
  const updateChat = useChatStore((state) => state.updateChat);

  // Handle clipboard text copy with micro-interaction state
  const handleCopyMessage = async (msgId: string, content: string) => {
    await Clipboard.setStringAsync(content);
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
    onSendMessage(text, attachments);
    setInputText("");
    updateChat(conversation.id, { draft: "" });
    setAttachments([]);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
    if (result.canceled) return;
    setAttachments((current) => [
      ...current,
      ...result.assets.map((asset) => ({
        id: `${Date.now()}-${asset.name}`,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
        kind: "document" as const,
      })),
    ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    setAttachments((current) => [
      ...current,
      ...result.assets.map((asset, index) => ({
        id: `${Date.now()}-image-${index}`,
        name: asset.fileName || `Image ${index + 1}`,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.fileSize,
        kind: "image" as const,
      })),
    ]);
  };

  const promptIdeas: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    prompt: string;
  }[] = [
    { icon: "bulb-outline", label: "Explain simply", prompt: "Explain a complex idea to me in simple terms" },
    { icon: "trending-up-outline", label: "Analyze trends", prompt: "Analyze the key trends in this topic" },
    { icon: "scale-outline", label: "Build a case", prompt: "Help me structure a clear, evidence-based argument" },
  ];
  const allPromptIdeas = [
    ...savedPrompts.map((prompt) => ({ icon: "bookmark-outline" as const, label: prompt, prompt })),
    ...promptIdeas,
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
    <View className="flex-1 bg-[#f7f5ff] dark:bg-[#0e110f]">
      {/* Scrollable Messages Area */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 12, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {conversation.messages.length === 0 ? (
          <View className="flex-1 justify-center pb-5">
            <View className="size-14 rounded-[22px] bg-[#28242f] dark:bg-[#f0f2ee] items-center justify-center mb-5 shadow-sm">
              <Ionicons name="sparkles-outline" size={24} color="#a993ff" />
            </View>
            <Text className="text-[32px] leading-10 font-bold text-[#211f27] dark:text-[#f3f5f2] tracking-tight max-w-[330px]">
              What are we creating today?
            </Text>
            <Text className="text-[15px] text-[#756f7c] dark:text-[#a1a8a2] leading-6 mt-3 mb-8 max-w-[325px]">
              Start with an idea or choose a shortcut. Inqora will keep the conversation focused.
            </Text>
            <View className="space-y-2">
              {allPromptIdeas.map(({ icon, label, prompt }) => (
                <Pressable key={`${icon}-${label}`} onPress={() => setInputText(prompt)} onLongPress={() => savedPrompts.includes(prompt) && removePrompt(prompt)} className="min-h-16 flex-row items-center px-4 bg-white dark:bg-[#171c18] border border-[#ebe7f7] dark:border-[#272e29] rounded-[20px] shadow-sm active:opacity-60">
                  <View className="size-10 items-center justify-center rounded-2xl bg-[#f1edff] dark:bg-[#222923] mr-3">
                    <Ionicons name={icon} size={17} color="#7c3aed" />
                  </View>
                  <Text className="flex-1 text-[15px] font-semibold text-[#302c36] dark:text-[#dce1dc]">{label}</Text>
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
                  <View className="size-9 bg-[#28242f] dark:bg-zinc-800 rounded-full items-center justify-center mr-3">
                    <Ionicons name="sparkles-outline" size={16} color="#a993ff" />
                  </View>
                )}

                <View className="max-w-[82%]">
                  {/* Bubble Container */}
                  <View
                    className={`px-4 py-3.5 rounded-2xl shadow-sm border ${
                      isUser
                        ? "bg-[#6d5dfb] border-[#6d5dfb] rounded-tr-md"
                        : isError
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 rounded-tl-none"
                        : "bg-white dark:bg-[#1a211c] border-[#ebe7f7] dark:border-[#29312b] rounded-tl-md"
                    }`}
                  >
                    {/* Render message content */}
                    <FormattedText text={msg.content} isUser={isUser} />
                    {isError && (
                      <Pressable onPress={() => msg.retryText ? onRetryMessage(msg.retryText) : onRetryConnection()} className="mt-3 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex-row items-center justify-center">
                        <Ionicons name="refresh-outline" size={17} color="#e05267" />
                        <Text className="ml-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">Retry connection</Text>
                      </Pressable>
                    )}

                    {!!msg.attachments?.length && (
                      <View className="mt-3 gap-2">
                        {msg.attachments.map((attachment) => (
                          <View key={attachment.id} className="flex-row items-center rounded-xl bg-black/10 px-3 py-2">
                            {attachment.kind === "image" ? (
                              <Image source={{ uri: attachment.uri }} className="size-10 rounded-lg mr-2" />
                            ) : (
                              <Ionicons name="document-outline" size={19} color={isUser ? "#fff" : "#7c3aed"} />
                            )}
                            <Text numberOfLines={1} className={`flex-1 ml-2 text-[12px] font-semibold ${isUser ? "text-white" : "text-gray-700 dark:text-zinc-200"}`}>{attachment.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Clipboard copy action for assistant messages (not errors) */}
                    {!isUser && !isError && (
                      <View className="flex-row flex-wrap justify-end gap-1 mt-2 pt-2 border-t border-gray-100/50 dark:border-zinc-800/40">
                        <Pressable
                          onPress={() => handleCopyMessage(msg.id, msg.content)}
                          className="flex-row items-center space-x-1 px-2 py-1 rounded bg-gray-55 dark:bg-zinc-800 active:opacity-60"
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
                        <Pressable onPress={() => Speech.speak(msg.content)} className="p-2 rounded-lg active:opacity-60" accessibilityLabel="Read response aloud">
                          <Ionicons name="volume-high-outline" size={16} color="#8b8495" />
                        </Pressable>
                        <Pressable onPress={() => Share.share({ message: msg.content })} className="p-2 rounded-lg active:opacity-60" accessibilityLabel="Share response">
                          <Ionicons name="share-outline" size={16} color="#8b8495" />
                        </Pressable>
                        <Pressable onPress={() => setInputText(msg.content)} className="p-2 rounded-lg active:opacity-60" accessibilityLabel="Reuse response">
                          <Ionicons name="refresh-outline" size={16} color="#8b8495" />
                        </Pressable>
                        <Pressable onPress={() => onCompareMessage(msg.id)} className="p-2 rounded-lg active:opacity-60" accessibilityLabel="Compare with another model">
                          {comparingId === msg.id ? <ActivityIndicator size="small" color="#7c3aed" /> : <Ionicons name="git-compare-outline" size={16} color="#8b8495" />}
                        </Pressable>
                      </View>
                    )}

                    {/* PDF attachment button (Research Model) */}
                    {msg.pdfUrl && (
                      <Pressable
                        onPress={() => handleDownloadPdf(msg.pdfUrl!)}
                        className="flex-row items-center space-x-2 mt-3.5 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 active:opacity-60"
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

                  {msg.comparison && (
                    <View className="mt-2 p-3.5 rounded-2xl bg-[#f0ecff] dark:bg-[#242b26] border border-[#ddd5fb] dark:border-[#343d36]">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-[#6d5dfb] mb-2">Compared with {msg.comparison.label}</Text>
                      <FormattedText text={msg.comparison.content} isUser={false} />
                    </View>
                  )}

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
                        <View className="mt-2 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3.5">
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
            <View className="size-9 bg-[#28242f] dark:bg-zinc-800 rounded-full items-center justify-center mr-3">
              <Ionicons name="sparkles-outline" size={16} color="#a993ff" />
            </View>
            <View className="px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-2xl rounded-tl-none">
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View className="mx-4 mb-4 bg-white dark:bg-[#171c18] border border-[#e5e0f1] dark:border-[#2a322c] rounded-[24px] shadow-md overflow-hidden">
        {!!attachments.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pt-3">
            {attachments.map((attachment) => (
              <View key={attachment.id} className="mr-2 px-3 py-2 rounded-xl bg-[#f0ecff] dark:bg-[#252c27] flex-row items-center">
                <Ionicons name={attachment.kind === "image" ? "image-outline" : "document-outline"} size={15} color="#6d5dfb" />
                <Text numberOfLines={1} className="max-w-32 ml-2 text-[12px] font-semibold text-[#4f4758] dark:text-[#d7dcd8]">{attachment.name}</Text>
                <Pressable onPress={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))} className="ml-2"><Ionicons name="close-circle" size={16} color="#8c8495" /></Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        <View className="min-h-16 px-2 pl-3 py-2.5 flex-row items-end">
        <Pressable onPress={pickDocument} className="size-10 rounded-xl items-center justify-center active:opacity-60" accessibilityLabel="Attach document">
          <Ionicons name="attach-outline" size={22} color="#746d7c" />
        </Pressable>
        <Pressable onPress={pickImage} className="size-10 rounded-xl items-center justify-center active:opacity-60" accessibilityLabel="Attach image">
          <Ionicons name="image-outline" size={21} color="#746d7c" />
        </Pressable>
        <TextInput
          value={inputText}
          onChangeText={(value) => { setInputText(value); updateChat(conversation.id, { draft: value }); }}
          placeholder="Type a message..."
          placeholderTextColor="#8a918b"
          multiline
          className="flex-1 py-2.5 text-[16px] text-[#191d1a] dark:text-white max-h-[120px]"
        />

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          className={`size-11 ml-2 rounded-2xl items-center justify-center ${
            inputText.trim() && !isLoading ? "bg-[#6d5dfb] dark:bg-[#f0f2ee] active:opacity-70" : "bg-[#eeeaf6] dark:bg-[#2a312c]"
          }`}
        >
          <Ionicons name="arrow-up" size={20} color={inputText.trim() && !isLoading ? "#ffffff" : "#9b94a5"} />
        </Pressable>
        {!!inputText.trim() && (
          <Pressable onPress={() => savePrompt(inputText.trim())} className="size-10 ml-1 rounded-xl items-center justify-center active:opacity-60" accessibilityLabel="Save prompt">
            <Ionicons name={savedPrompts.includes(inputText.trim()) ? "bookmark" : "bookmark-outline"} size={19} color="#7c3aed" />
          </Pressable>
        )}
        </View>
        {isLoading && (
          <Pressable onPress={onStop} className="mx-3 mb-3 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex-row items-center justify-center">
            <Ionicons name="stop-circle-outline" size={18} color="#e05267" />
            <Text className="ml-2 text-[13px] font-semibold text-rose-500">Stop generating</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
