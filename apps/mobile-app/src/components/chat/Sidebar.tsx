import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Plus, Trash2, Bot, X } from "lucide-react-native";
import { Conversation } from "../../lib/api";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
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

    conversations.forEach((chat) => {
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
    flex-col h-full bg-white dark:bg-zinc-950 border-r border-gray-100 dark:border-zinc-900 
    ${Platform.OS === "web" ? "w-72 md:flex" : "w-72"}
  `;

  const renderContent = () => (
    <View className="flex-1 flex-col h-full">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-50 dark:border-zinc-900/60">
        <View className="flex-row items-center space-x-3">
          <View className="bg-blue-600 p-2 rounded-xl">
            <Bot size={20} color="#ffffff" />
          </View>
          <View>
            <Text className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Agentic RAG
            </Text>
            <Text className="text-[10px] text-gray-500 font-medium">
              V1.0.0 • EXPO MOBILE
            </Text>
          </View>
        </View>

        {/* Close button for Mobile drawer */}
        {Platform.OS !== "web" && (
          <Pressable
            onPress={onClose}
            className="p-1.5 rounded-full bg-gray-50 dark:bg-zinc-900"
          >
            <X size={18} className="text-gray-500 dark:text-zinc-400" />
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
          className="flex-row items-center justify-center space-x-2 py-3 bg-gray-900 dark:bg-zinc-800 hover:bg-gray-800 dark:hover:bg-zinc-700 rounded-xl shadow-sm transition-all"
        >
          <Plus size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">New Chat</Text>
        </Pressable>
      </View>

      {/* Conversations List */}
      <ScrollView className="flex-1 px-3" showsVerticalScrollIndicator={false}>
        {conversations.length === 0 ? (
          <View className="py-8 items-center justify-center">
            <Text className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
              No conversations yet
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.title} className="mb-5">
              <Text className="text-[10px] font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-3 mb-2">
                {group.title}
              </Text>
              
              <View className="space-y-1">
                {group.data.map((chat) => {
                  const isActive = activeId === chat.id;
                  return (
                    <View
                      key={chat.id}
                      className={`group flex-row items-center rounded-xl px-3 py-3 transition-colors ${
                        isActive
                          ? "bg-blue-50/70 dark:bg-blue-950/20"
                          : "hover:bg-gray-50 dark:hover:bg-zinc-900/40"
                      }`}
                    >
                      <Pressable
                        onPress={() => {
                          onSelectChat(chat.id);
                          if (Platform.OS !== "web") onClose();
                        }}
                        className="flex-1"
                      >
                        <Text
                          numberOfLines={1}
                          className={`text-xs font-semibold tracking-wide ${
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-700 dark:text-zinc-300"
                          }`}
                        >
                          {chat.title || "New Conversation"}
                        </Text>
                      </Pressable>

                      {/* Trash action button */}
                      <Pressable
                        onPress={() => onDeleteChat(chat.id)}
                        className="p-1 rounded-md opacity-70 group-hover:opacity-100 active:scale-95"
                      >
                        <Trash2
                          size={13}
                          className={
                            isActive
                              ? "text-blue-500 dark:text-blue-400"
                              : "text-gray-400 dark:text-zinc-500 hover:text-red-500"
                          }
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

      {/* User Footer Profile */}
      <View className="p-4 border-t border-gray-50 dark:border-zinc-900/60 bg-gray-50/50 dark:bg-zinc-950/40">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3">
            <View className="size-9 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center border border-blue-200/50 dark:border-blue-900/50">
              <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                U
              </Text>
            </View>
            <View className="max-w-[130px]">
              <Text className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                Demo User
              </Text>
              <Text className="text-[9px] text-gray-400 dark:text-zinc-500 truncate">
                user@example.com
              </Text>
            </View>
          </View>
        </View>
      </View>
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
      <View className="h-full w-72 bg-white dark:bg-zinc-950 shadow-2xl">
        {renderContent()}
      </View>
      <Pressable className="flex-1 h-full" onPress={onClose} />
    </View>
  );
}
