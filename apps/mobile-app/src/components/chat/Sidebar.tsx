import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Conversation } from "../../lib/api";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onDuplicateChat: (id: string) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onTogglePin,
  onDuplicateChat,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const visibleConversations = useMemo(
    () => conversations
      .filter((chat) => chat.title.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.timestamp - a.timestamp),
    [conversations, search]
  );
  // Group conversations by period
  const getGroupedConversations = () => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    
    const tempYest = new Date();
    tempYest.setDate(now.getDate() - 1);
    const yesterdayStr = tempYest.toDateString();

    visibleConversations.forEach((chat) => {
      const date = new Date(chat.timestamp);
      const dateStr = date.toDateString();

      if (dateStr === todayStr) {
        today.push(chat);
      } else if (dateStr === yesterdayStr) {
        yesterday.push(chat);
      } else {
        older.push(chat);
      }
    });

    return [
      { title: "Today", data: today },
      { title: "Yesterday", data: yesterday },
      { title: "Older", data: older },
    ].filter((group) => group.data.length > 0);
  };

  const grouped = getGroupedConversations();

  // Sidebar container styles
  const sidebarClass = `
    flex-col h-full bg-[#f7f5ff] dark:bg-[#101411] border-r border-[#e7e2f2] dark:border-[#29312b]
    ${Platform.OS === "web" ? "w-72 md:flex" : "w-72"}
  `;

  const renderContent = () => (
    <View className="flex-1 flex-col h-full">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-7 pb-5 border-b border-[#e7e9e3] dark:border-[#29312b]">
        <View className="flex-row items-center space-x-3">
          <View className="bg-[#28242f] dark:bg-[#f1f3ef] p-2.5 rounded-2xl">
            <Ionicons name="sparkles-outline" size={22} color="#8b5cf6" />
          </View>
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Inqora
            </Text>
            <Text className="text-[12px] text-gray-500 font-medium">
              AI workspace
            </Text>
          </View>
        </View>

        {/* Close button for Mobile drawer */}
        {Platform.OS !== "web" && (
          <Pressable
            onPress={onClose}
            className="size-10 items-center justify-center rounded-full bg-white dark:bg-zinc-900"
          >
            <Ionicons name="close" size={22} color="#687069" />
          </Pressable>
        )}
      </View>

      {/* Action Button: New Chat */}
      <View className="px-4 py-4">
        <Pressable
          onPress={() => {
            onNewChat();
            if (Platform.OS !== "web") onClose();
          }}
          className="flex-row items-center justify-center space-x-2 py-4 bg-[#6d5dfb] dark:bg-[#f1f3ef] rounded-[20px] shadow-sm active:opacity-80"
        >
          <Ionicons name="add" size={21} color="#8b5cf6" />
          <Text className="text-[15px] font-semibold text-white dark:text-[#171b18]">New chat</Text>
        </Pressable>
      </View>

      <View className="mx-4 mb-3 h-12 px-3 rounded-2xl bg-white dark:bg-[#1b211d] border border-[#e7e2f2] dark:border-[#29312b] flex-row items-center">
        <Ionicons name="search-outline" size={18} color="#8c8495" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search conversations" placeholderTextColor="#8c8495" className="flex-1 ml-2 text-[14px] text-[#28232e] dark:text-white" />
      </View>

      {/* Conversations List */}
      <ScrollView className="flex-1 px-3" showsVerticalScrollIndicator={false}>
        {visibleConversations.length === 0 ? (
          <View className="py-8 items-center justify-center">
            <Text className="text-[14px] text-gray-500 dark:text-zinc-400 font-medium">
              No conversations yet
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.title} className="mb-5">
              <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                {group.title}
              </Text>
              
              <View className="space-y-1">
                {group.data.map((chat) => {
                  const isActive = activeId === chat.id;
                  return (
                    <View
                      key={chat.id}
                      className={`flex-row items-center rounded-xl px-3 py-3 ${
                        isActive
                          ? "bg-[#ebe6ff] dark:bg-violet-950/20"
                          : "bg-transparent"
                      }`}
                    >
                      <Pressable
                        onPress={() => {
                          onSelectChat(chat.id);
                          if (Platform.OS !== "web") onClose();
                        }}
                        className="flex-1"
                      >
                        {editingId === chat.id ? (
                          <TextInput
                            autoFocus
                            value={editingTitle}
                            onChangeText={setEditingTitle}
                            onSubmitEditing={() => { onRenameChat(chat.id, editingTitle); setEditingId(null); }}
                            onBlur={() => { onRenameChat(chat.id, editingTitle); setEditingId(null); }}
                            className="text-[14px] font-semibold text-[#2f2936] dark:text-white p-0"
                          />
                        ) : <Text
                          numberOfLines={1}
                          className={`text-[14px] font-semibold ${
                            isActive
                              ? "text-violet-700 dark:text-violet-300"
                              : "text-gray-700 dark:text-zinc-300"
                          }`}
                        >
                          {chat.pinned ? "★ " : ""}{chat.title || "New Conversation"}
                        </Text>}
                      </Pressable>

                      <Pressable onPress={() => onTogglePin(chat.id)} className="p-1.5 rounded-md active:opacity-50">
                        <Ionicons name={chat.pinned ? "star" : "star-outline"} size={15} color={chat.pinned ? "#f59e0b" : "#9ca3af"} />
                      </Pressable>
                      <Pressable onPress={() => { setEditingTitle(chat.title); setEditingId(chat.id); }} className="p-1.5 rounded-md active:opacity-50">
                        <Ionicons name="pencil-outline" size={15} color="#9ca3af" />
                      </Pressable>
                      <Pressable onPress={() => onDuplicateChat(chat.id)} className="p-1.5 rounded-md active:opacity-50">
                        <Ionicons name="copy-outline" size={15} color="#9ca3af" />
                      </Pressable>
                      <Pressable
                        onPress={() => onDeleteChat(chat.id)}
                        className="p-1 rounded-md opacity-70 active:opacity-50"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={isActive ? "#7c3aed" : "#9ca3af"}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View className={`${sidebarClass} hidden md:flex w-72 border-r`}>
        {renderContent()}
      </View>
    );
  }

  // Mobile Slide-over Overlay Drawer
  if (!isOpen) return null;

  return (
    <View className="absolute left-0 top-0 bottom-0 right-0 z-50 flex-row bg-black/40">
      <View className="h-full w-72 bg-[#f7f5ff] dark:bg-zinc-950 shadow-2xl">
        {renderContent()}
      </View>
      <Pressable className="flex-1 h-full" onPress={onClose} />
    </View>
  );
}
