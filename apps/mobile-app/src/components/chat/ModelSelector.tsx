import React from "react";
import { ScrollView, Text, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModelType } from "../../lib/api";

type ModelConfig = {
  id: ModelType;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const MODELS: ModelConfig[] = [
  {
    id: "general",
    label: "General",
    icon: "chatbubble-ellipses-outline",
  },
  {
    id: "finance",
    label: "Finance",
    icon: "stats-chart-outline",
  },
  {
    id: "legal",
    label: "Legal",
    icon: "document-text-outline",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: "document-attach-outline",
  },
  {
    id: "budget",
    label: "Budget",
    icon: "wallet-outline",
  },
  {
    id: "research",
    label: "Research",
    icon: "book-outline",
  },
];

interface ModelSelectorProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
}

export default function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  return (
    <View className="pb-2.5 bg-white dark:bg-[#111512] border-b border-[#eceeea] dark:border-[#242a25]">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {MODELS.map((model) => {
          const isActive = selectedModel === model.id;

          return (
            <Pressable
              key={model.id}
              onPress={() => onSelectModel(model.id)}
              className={`h-11 px-3.5 flex-row items-center rounded-full border ${
                isActive
                  ? "bg-[#171b18] border-[#171b18] dark:bg-[#f3f4f1] dark:border-[#f3f4f1]"
                  : "bg-[#f7f8f5] border-[#e6e9e3] dark:bg-[#1b211d] dark:border-[#2c342e]"
              }`}
            >
              <Ionicons name={model.icon} size={18} color={isActive ? "#8b5cf6" : "#727a73"} />
              <Text
                className={`ml-2 text-[13px] font-semibold ${
                  isActive
                    ? "text-white dark:text-[#171b18]"
                    : "text-[#59615a] dark:text-[#b9c0ba]"
                }`}
              >
                {model.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
