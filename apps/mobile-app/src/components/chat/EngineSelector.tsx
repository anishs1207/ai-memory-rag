import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface EngineSelectorProps {
  selectedLlm: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter";
  onSelectLlm: (llm: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter") => void;
}

const ENGINES = [
  { id: "gemini", label: "Gemini Flash" },
  { id: "smollm", label: "SmolLM" },
  { id: "sf_financial_qa", label: "Finance SFT" },
  { id: "dpo_adapter", label: "DPO" },
] as const;

export default function EngineSelector({ selectedLlm, onSelectLlm }: EngineSelectorProps) {
  return (
    <View className="h-12 px-4 bg-white dark:bg-[#111512] border-b border-[#eceeea] dark:border-[#242a25] flex-row items-center">
      <Text className="mr-3 text-[12px] font-semibold text-[#8a918b] dark:text-[#858d86] uppercase tracking-wider">
        Model
      </Text>
      <View className="flex-1">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, alignItems: "center" }}
        >
          {ENGINES.map((engine) => {
            const isActive = selectedLlm === engine.id;
            return (
              <Pressable
                key={engine.id}
                onPress={() => onSelectLlm(engine.id as any)}
                className={`px-3 py-1.5 rounded-full ${
                  isActive
                    ? "bg-violet-100 dark:bg-violet-950/50"
                    : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-[12px] font-medium ${
                    isActive
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-[#59615a] dark:text-[#aeb6af]"
                  }`}
                >
                  {engine.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
