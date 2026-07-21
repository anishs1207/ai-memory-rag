import React from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { Cpu } from "lucide-react-native";

interface EngineSelectorProps {
  selectedLlm: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter";
  onSelectLlm: (llm: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter") => void;
}

const ENGINES = [
  { id: "gemini", label: "Gemini 2.5 Flash" },
  { id: "smollm", label: "smolLM 135 SFT" },
  { id: "sf_financial_qa", label: "sf_financial_qa" },
  { id: "dpo_adapter", label: "dpo_adapter (DPO)" },
] as const;

export default function EngineSelector({ selectedLlm, onSelectLlm }: EngineSelectorProps) {
  // DPO Mode status is true when the selected LLM is dpo_adapter
  const isDpo = selectedLlm === "dpo_adapter";

  // Handle DPO switch toggle to match web interface rules
  const handleDpoChange = (val: boolean) => {
    // Toggling DPO on sets it to dpo_adapter, toggling off falls back to standard smollm SFT
    onSelectLlm(val ? "dpo_adapter" : "smollm");
  };

  return (
    <View className="px-4 py-2 bg-gray-50/50 dark:bg-zinc-900/10 border-b border-gray-100 dark:border-zinc-800/80 flex-row items-center justify-between">
      {/* Engine Selection Section */}
      <View className="flex-row items-center space-x-1.5 flex-1 pr-4">
        <Cpu size={13} className="text-gray-400 dark:text-zinc-500 mr-1" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {ENGINES.map((engine) => {
            const isActive = selectedLlm === engine.id;
            return (
              <Pressable
                key={engine.id}
                onPress={() => onSelectLlm(engine.id as any)}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  isActive
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50"
                    : "bg-white border-gray-150 dark:bg-zinc-900 dark:border-zinc-855"
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-zinc-400"
                  }`}
                >
                  {engine.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* DPO Switch Toggle Section */}
      <View className="flex-row items-center space-x-2 border-l border-gray-200 dark:border-zinc-800/60 pl-3">
        <Text className="text-[10px] font-extrabold text-gray-550 dark:text-zinc-400 tracking-wider">
          DPO
        </Text>
        <Switch
          value={isDpo}
          onValueChange={handleDpoChange}
          trackColor={{ false: "#e4e4e7", true: "#bfdbfe" }}
          thumbColor={isDpo ? "#2563eb" : "#f4f4f5"}
          style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
        />
      </View>
    </View>
  );
}
