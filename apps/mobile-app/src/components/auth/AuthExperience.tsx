import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import AnimatedMascot from "../mascot/AnimatedMascot";
import { useUserStore } from "../../stores/user-store";

const slides = [
  { title: "Meet Inqora", body: "Your thoughtful AI workspace for research, planning, and everyday questions.", icon: "sparkles-outline" as const },
  { title: "One place for every idea", body: "Switch assistants, keep conversations, and return to your work whenever inspiration strikes.", icon: "layers-outline" as const },
  { title: "Ready when you are", body: "Your chats and preferences stay on this device, so every session feels familiar.", icon: "shield-checkmark-outline" as const },
];

export function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const completeOnboarding = useUserStore((state) => state.completeOnboarding);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const profile = useUserStore((state) => state.profile);
  const slide = slides[page]!;

  return (
    <SafeAreaView className="flex-1 bg-[#f7f5ff] dark:bg-[#100d14]">
      <View className="flex-1 px-6 pt-5 pb-6">
        <View className="flex-row justify-between items-center">
          <Text className="text-[18px] font-black text-[#26212d] dark:text-white">INQORA</Text>
          <Pressable onPress={completeOnboarding} className="px-3 py-2 rounded-full active:opacity-60">
            <Text className="text-[13px] font-semibold text-[#756d80] dark:text-[#b8afc3]">Skip</Text>
          </Pressable>
        </View>

        <View className="flex-1 justify-center">
          <AnimatedMascot greeting={page === 0 ? "Hi! I’m Qori 👋" : page === 1 ? "Let’s explore together" : "Your space is ready"} size={240} />
          <View className="mt-5 size-12 rounded-2xl bg-[#ece7ff] dark:bg-[#292131] items-center justify-center">
            <Ionicons name={slide.icon} size={23} color="#6d5dfb" />
          </View>
          <Text className="text-[34px] leading-10 font-bold text-[#25202b] dark:text-white mt-4">{slide.title}</Text>
          <Text className="text-[16px] leading-6 text-[#756f7c] dark:text-[#b7afbf] mt-3">{slide.body}</Text>
          {page === 1 && (
            <View className="flex-row flex-wrap gap-2 mt-5">
              {["Research", "Build products", "Study", "Plan decisions"].map((goal) => {
                const selected = profile.interests?.includes(goal);
                return (
                  <Pressable key={goal} onPress={() => updateProfile({ interests: goal })} className={`px-4 py-3 rounded-2xl border ${selected ? "bg-[#6d5dfb] border-[#6d5dfb]" : "bg-white dark:bg-[#1c1721] border-[#e7e1ef] dark:border-[#342d3d]"}`}>
                    <Text className={`text-[13px] font-semibold ${selected ? "text-white" : "text-[#514a59] dark:text-[#d7cfde]"}`}>{goal}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View className="flex-row items-center mb-5">
          {slides.map((_, index) => (
            <View key={index} className={`h-2 rounded-full mr-2 ${index === page ? "w-8 bg-[#6d5dfb]" : "w-2 bg-[#d9d2e6] dark:bg-[#3b3343]"}`} />
          ))}
        </View>
        <Pressable
          onPress={() => (page === slides.length - 1 ? completeOnboarding() : setPage((current) => current + 1))}
          className="h-14 bg-[#28242f] dark:bg-[#6d5dfb] rounded-[20px] flex-row items-center justify-center active:opacity-80"
        >
          <Text className="text-[15px] font-bold text-white mr-2">{page === slides.length - 1 ? "Continue to login" : "Next"}</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function LoginScreen() {
  const login = useUserStore((state) => state.login);
  const continueAsGuest = useUserStore((state) => state.continueAsGuest);
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo123");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState("");

  const handleLogin = () => {
    const result = login({ username, password });
    setError(result.message || "");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f7f5ff] dark:bg-[#100d14]">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-6 py-6 justify-center">
            <AnimatedMascot greeting="Welcome back!" size={170} />
            <Text className="text-[30px] font-bold text-[#25202b] dark:text-white mt-2">Sign in to Inqora</Text>
            <Text className="text-[15px] leading-6 text-[#756f7c] dark:text-[#b7afbf] mt-2 mb-6">Continue your conversations and preferences.</Text>

            <Text className="text-[13px] font-semibold text-[#514a59] dark:text-[#d7cfde] mb-2">Username</Text>
            <View className="h-14 px-4 bg-white dark:bg-[#1c1721] rounded-2xl border border-[#e7e1ef] dark:border-[#342d3d] flex-row items-center mb-4">
              <Ionicons name="person-outline" size={19} color="#8c8495" />
              <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" className="flex-1 ml-3 text-[16px] text-[#28232e] dark:text-white" placeholder="Username" placeholderTextColor="#9b94a5" />
            </View>
            <Text className="text-[13px] font-semibold text-[#514a59] dark:text-[#d7cfde] mb-2">Password</Text>
            <View className="h-14 px-4 bg-white dark:bg-[#1c1721] rounded-2xl border border-[#e7e1ef] dark:border-[#342d3d] flex-row items-center">
              <Ionicons name="lock-closed-outline" size={19} color="#8c8495" />
              <TextInput value={password} onChangeText={setPassword} secureTextEntry={secure} className="flex-1 ml-3 text-[16px] text-[#28232e] dark:text-white" placeholder="Password" placeholderTextColor="#9b94a5" />
              <Pressable onPress={() => setSecure((value) => !value)} className="p-2 active:opacity-60">
                <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={20} color="#8c8495" />
              </Pressable>
            </View>
            {!!error && <Text className="text-[13px] text-rose-500 mt-3">{error}</Text>}

            <View className="mt-4 p-3.5 bg-[#ede9ff] dark:bg-[#27202f] rounded-2xl flex-row items-center">
              <Ionicons name="key-outline" size={19} color="#6d5dfb" />
              <Text className="ml-3 text-[13px] text-[#554d60] dark:text-[#cfc5d8]">Demo: <Text className="font-bold">demo / demo123</Text></Text>
            </View>
            <Pressable onPress={handleLogin} className="h-14 mt-5 bg-[#6d5dfb] rounded-[20px] items-center justify-center active:opacity-80">
              <Text className="text-[16px] font-bold text-white">Sign in</Text>
            </Pressable>
            <Pressable onPress={continueAsGuest} className="h-13 mt-3 items-center justify-center rounded-[18px] active:opacity-60">
              <Text className="text-[14px] font-semibold text-[#756d80] dark:text-[#b8afc3]">Continue as guest</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
