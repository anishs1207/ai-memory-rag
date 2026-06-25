import React from "react";
import { ScrollView, Text, Pressable, View } from "react-native";
import { Bot, Hash, FileText, Wallet, BookOpen } from "lucide-react-native";
import { ModelType } from "../../lib/api";

type ModelConfig = {
  id: ModelType;
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
};

const MODELS: ModelConfig[] = [
  {
    id: "general",
    label: "General Chat",
    icon: Bot,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-900/50",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Hash,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-900/50",
  },
  {
    id: "legal",
    label: "Legal Agent",
    icon: FileText,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-900/50",
  },
  {
    id: "pdf",
    label: "PDF Chat",
    icon: FileText,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-900/50",
  },
  {
    id: "budget",
    label: "Budget Planner",
    icon: Wallet,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
    borderColor: "border-pink-200 dark:border-pink-900/50",
  },
  {
    id: "research",
    label: "Research Agent",
    icon: BookOpen,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-900/50",
  },
];

interface ModelSelectorProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
}

export default function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  return (
    <View className="border-b border-gray-100 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md py-3.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {MODELS.map((model) => {
          const Icon = model.icon;
          const isActive = selectedModel === model.id;

          return (
            <Pressable
              key={model.id}
              onPress={() => onSelectModel(model.id)}
              className={`flex-row items-center space-x-2 px-4 py-2.5 rounded-full border transition-all duration-200 ${
                isActive
                  ? `${model.bgColor} ${model.borderColor} scale-102`
                  : "bg-transparent border-gray-100 dark:border-zinc-850 hover:bg-gray-50 dark:hover:bg-zinc-900"
              }`}
            >
              <Icon
                size={16}
                className={isActive ? model.color : "text-gray-400 dark:text-zinc-500"}
              />
              <Text
                className={`text-xs font-semibold tracking-wide ${
                  isActive
                    ? model.color.split(" ")[0]
                    : "text-gray-600 dark:text-zinc-400"
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
