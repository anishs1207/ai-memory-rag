import React from "react";
import {
  View,
  Text,
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
    flex-col h-full bg-[#f7f7f2] dark:bg-[#101411] border-r border-[#e7e9e3] dark:border-[#29312b]
    ${Platform.OS === "web" ? "w-72 md:flex" : "w-72"}
  `;

  const renderContent = () => (
    <View className="flex-1 flex-col h-full">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-7 pb-5 border-b border-[#e7e9e3] dark:border-[#29312b]">
        <View className="flex-row items-center space-x-3">
          <View className="bg-[#171b18] dark:bg-[#f1f3ef] p-2.5 rounded-xl">
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
          className="flex-row items-center justify-center space-x-2 py-4 bg-[#171b18] dark:bg-[#f1f3ef] rounded-2xl active:opacity-80"
        >
          <Ionicons name="add" size={21} color="#8b5cf6" />
          <Text className="text-[15px] font-semibold text-white dark:text-[#171b18]">New chat</Text>
        </Pressable>
      </View>

      {/* Conversations List */}
      <ScrollView className="flex-1 px-3" showsVerticalScrollIndicator={false}>
        {conversations.length === 0 ? (
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
                      className={`group flex-row items-center rounded-xl px-3 py-3 transition-colors ${
                        isActive
                          ? "bg-violet-50 dark:bg-violet-950/20"
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
                          className={`text-[14px] font-semibold ${
                            isActive
                              ? "text-violet-700 dark:text-violet-300"
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
      <View className="h-full w-72 bg-white dark:bg-zinc-950 shadow-2xl">
        {renderContent()}
      </View>
      <Pressable className="flex-1 h-full" onPress={onClose} />
    </View>
  );
}
