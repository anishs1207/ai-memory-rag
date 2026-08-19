import React, { useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";

import { useUserStore } from "../../stores/user-store";
import { useChatStore } from "../../stores/chat-store";
import type { ThemePreference } from "../../types/settings";

type AccountSheetProps = { visible: boolean; onClose: () => void };

const themeOptions: { id: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "light", label: "Light", icon: "sunny-outline" },
  { id: "dark", label: "Dark", icon: "moon-outline" },
  { id: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function AccountSheet({ visible, onClose }: AccountSheetProps) {
  const profile = useUserStore((state) => state.profile);
  const preferences = useUserStore((state) => state.preferences);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const updatePreferences = useUserStore((state) => state.updatePreferences);
  const setTheme = useUserStore((state) => state.setTheme);
  const logout = useUserStore((state) => state.logout);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests || "Research, product design, AI");
  const conversations = useChatStore((state) => state.conversations);
  const clearChats = useChatStore((state) => state.clearChats);

  const save = () => {
    updateProfile({ displayName: displayName.trim() || profile.displayName, bio: bio.trim(), interests: interests.trim() });
    onClose();
  };

  const chooseAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) updateProfile({ avatarUri: result.assets[0]?.uri });
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (!enabled) return updatePreferences({ biometricLock: false });
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) return Alert.alert("Biometrics unavailable", "Set up a fingerprint or face unlock on this device first.");
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Enable Inqora app lock" });
    if (result.success) updatePreferences({ biometricLock: true });
  };

  const exportData = () => Share.share({
    title: "Inqora data export",
    message: JSON.stringify({ profile, preferences, conversations }, null, 2),
  });

  const confirmClearChats = () => Alert.alert("Clear conversation history?", "This removes every locally saved conversation from this device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: clearChats },
  ]);

  const deleteLocalData = () => Alert.alert("Delete all local data?", "This resets your profile, preferences, onboarding and every conversation. This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete everything", style: "destructive", onPress: async () => {
      clearChats();
      await useChatStore.persist.clearStorage();
      await useUserStore.persist.clearStorage();
      logout();
      onClose();
    } },
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/30">
        <View className="max-h-[92%] bg-[#f7f5ff] dark:bg-[#100d14] rounded-t-[32px] overflow-hidden">
          <View className="items-center pt-3"><View className="w-10 h-1 rounded-full bg-[#cfc7d8] dark:bg-[#49404f]" /></View>
          <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-[24px] font-bold text-[#28232e] dark:text-white">Account</Text>
              <Text className="text-[13px] text-[#7c7485] dark:text-[#aaa1b3] mt-0.5">Profile and preferences</Text>
            </View>
            <Pressable onPress={onClose} className="size-10 rounded-full bg-white dark:bg-[#211b27] items-center justify-center active:opacity-60">
              <Ionicons name="close" size={21} color="#756d80" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
            <View className="p-4 bg-white dark:bg-[#1b1620] rounded-[24px] border border-[#e9e3f1] dark:border-[#312a38] flex-row items-center mb-4">
              <Pressable onPress={chooseAvatar} className="size-14 rounded-2xl bg-[#6d5dfb] items-center justify-center overflow-hidden">
                {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} className="size-14" /> : <Text className="text-[22px] font-bold text-white">{displayName.slice(0, 1).toUpperCase()}</Text>}
              </Pressable>
              <View className="flex-1 ml-3">
                <Text className="text-[17px] font-bold text-[#2c2732] dark:text-white">{profile.displayName}</Text>
                <Text className="text-[13px] text-[#7a7282] dark:text-[#aaa1b3]">@{profile.username} · {profile.role}</Text>
                <Text className="text-[12px] text-[#938b9b] dark:text-[#8f8697] mt-0.5">{profile.email}</Text>
              </View>
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">About you</Text>
            <View className="p-4 bg-white dark:bg-[#1b1620] rounded-[24px] border border-[#e9e3f1] dark:border-[#312a38] mb-4">
              <Text className="text-[13px] font-semibold text-[#514a59] dark:text-[#d8d0df] mb-2">Display name</Text>
              <TextInput value={displayName} onChangeText={setDisplayName} className="h-12 px-3 bg-[#f8f6fb] dark:bg-[#251f2b] rounded-xl text-[15px] text-[#28232e] dark:text-white" />
              <Text className="text-[13px] font-semibold text-[#514a59] dark:text-[#d8d0df] mt-4 mb-2">Bio</Text>
              <TextInput value={bio} onChangeText={setBio} multiline className="min-h-20 px-3 py-3 bg-[#f8f6fb] dark:bg-[#251f2b] rounded-xl text-[15px] leading-5 text-[#28232e] dark:text-white" />
              <Text className="text-[13px] font-semibold text-[#514a59] dark:text-[#d8d0df] mt-4 mb-2">Interests</Text>
              <TextInput value={interests} onChangeText={setInterests} className="h-12 px-3 bg-[#f8f6fb] dark:bg-[#251f2b] rounded-xl text-[15px] text-[#28232e] dark:text-white" />
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Appearance</Text>
            <View className="p-3 bg-white dark:bg-[#1b1620] rounded-[24px] border border-[#e9e3f1] dark:border-[#312a38] mb-4">
              <View className="flex-row gap-2">
                {themeOptions.map((option) => {
                  const selected = preferences.theme === option.id;
                  return (
                    <Pressable key={option.id} onPress={() => setTheme(option.id)} className={`flex-1 h-16 rounded-2xl items-center justify-center ${selected ? "bg-[#eae5ff] dark:bg-[#392e54]" : "bg-[#f8f6fb] dark:bg-[#251f2b]"}`}>
                      <Ionicons name={option.icon} size={20} color={selected ? "#6d5dfb" : "#8c8495"} />
                      <Text className={`text-[12px] font-semibold mt-1 ${selected ? "text-[#5c4de5] dark:text-[#c5baff]" : "text-[#756d80] dark:text-[#aaa1b3]"}`}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Preferences</Text>
            <View className="px-4 bg-white dark:bg-[#1b1620] rounded-[24px] border border-[#e9e3f1] dark:border-[#312a38] mb-5">
              <PreferenceRow icon="phone-portrait-outline" title="Compact messages" subtitle="Fit more conversation on screen" value={preferences.compactMessages} onChange={(value) => updatePreferences({ compactMessages: value })} />
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <PreferenceRow icon="pulse-outline" title="Haptics" subtitle="Gentle feedback for actions" value={preferences.haptics} onChange={(value) => updatePreferences({ haptics: value })} />
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <PreferenceRow icon="bulb-outline" title="Remember context" subtitle="Allow local conversations to retain context" value={preferences.rememberContext ?? true} onChange={(value) => updatePreferences({ rememberContext: value })} />
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <PreferenceRow icon="volume-high-outline" title="Read responses" subtitle="Speak new assistant responses aloud" value={preferences.speakResponses ?? false} onChange={(value) => updatePreferences({ speakResponses: value })} />
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <PreferenceRow icon="finger-print-outline" title="Biometric lock" subtitle="Require device authentication when supported" value={preferences.biometricLock ?? false} onChange={toggleBiometrics} />
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <PreferenceRow icon="paw-outline" title="Mascot motion" subtitle="Show contextual mascot animations" value={preferences.mascotMotion ?? true} onChange={(value) => updatePreferences({ mascotMotion: value })} />
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Response style</Text>
            <View className="flex-row gap-2 mb-4">
              {(["concise", "balanced", "detailed"] as const).map((style) => (
                <Pressable key={style} onPress={() => updatePreferences({ responseStyle: style })} className={`flex-1 h-12 rounded-2xl items-center justify-center ${preferences.responseStyle === style ? "bg-[#6d5dfb]" : "bg-white dark:bg-[#1b1620]"}`}>
                  <Text className={`text-[12px] font-bold capitalize ${preferences.responseStyle === style ? "text-white" : "text-[#756d80] dark:text-[#cfc5d8]"}`}>{style}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Text size</Text>
            <View className="flex-row gap-2 mb-4">
              {(["standard", "large", "extra-large"] as const).map((size) => (
                <Pressable key={size} onPress={() => updatePreferences({ fontScale: size })} className={`flex-1 h-12 rounded-2xl items-center justify-center ${preferences.fontScale === size ? "bg-[#6d5dfb]" : "bg-white dark:bg-[#1b1620]"}`}>
                  <Text className={`${size === "extra-large" ? "text-[15px]" : size === "large" ? "text-[14px]" : "text-[12px]"} font-bold capitalize ${preferences.fontScale === size ? "text-white" : "text-[#756d80] dark:text-[#cfc5d8]"}`}>{size.replace("-", " ")}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Mascot speed</Text>
            <View className="flex-row gap-2 mb-4">
              {(["calm", "normal", "lively"] as const).map((speed) => (
                <Pressable key={speed} onPress={() => updatePreferences({ mascotSpeed: speed })} className={`flex-1 h-12 rounded-2xl items-center justify-center ${preferences.mascotSpeed === speed ? "bg-[#6d5dfb]" : "bg-white dark:bg-[#1b1620]"}`}>
                  <Text className={`text-[12px] font-bold capitalize ${preferences.mascotSpeed === speed ? "text-white" : "text-[#756d80] dark:text-[#cfc5d8]"}`}>{speed}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-[12px] font-bold uppercase tracking-wider text-[#8c8495] mb-2 ml-1">Data</Text>
            <View className="p-3 bg-white dark:bg-[#1b1620] rounded-[24px] border border-[#e9e3f1] dark:border-[#312a38] mb-4">
              <Text className="px-2 pb-2 text-[12px] text-[#8a8292] dark:text-[#978e9f]">{conversations.length} local conversations · approximately {Math.max(1, Math.round(JSON.stringify(conversations).length / 1024))} KB</Text>
              <Pressable onPress={exportData} className="h-12 px-3 flex-row items-center"><Ionicons name="share-outline" size={18} color="#6d5dfb" /><Text className="ml-3 text-[14px] font-semibold text-[#38313f] dark:text-white">Export my data</Text></Pressable>
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <Pressable onPress={confirmClearChats} className="h-12 px-3 flex-row items-center"><Ionicons name="trash-outline" size={18} color="#e05267" /><Text className="ml-3 text-[14px] font-semibold text-rose-500">Clear conversations</Text></Pressable>
              <View className="h-px bg-[#eee9f3] dark:bg-[#312a38]" />
              <Pressable onPress={deleteLocalData} className="h-12 px-3 flex-row items-center"><Ionicons name="warning-outline" size={18} color="#e05267" /><Text className="ml-3 text-[14px] font-semibold text-rose-500">Delete all local data</Text></Pressable>
            </View>

            <Pressable onPress={save} className="h-14 bg-[#6d5dfb] rounded-[20px] items-center justify-center active:opacity-80"><Text className="text-[15px] font-bold text-white">Save changes</Text></Pressable>
            <Pressable onPress={() => { logout(); onClose(); }} className="h-13 mt-3 flex-row items-center justify-center rounded-[18px] active:opacity-60">
              <Ionicons name="log-out-outline" size={19} color="#e05267" />
              <Text className="ml-2 text-[14px] font-semibold text-rose-500">Sign out</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PreferenceRow({ icon, title, subtitle, value, onChange }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="min-h-16 py-3 flex-row items-center">
      <View className="size-9 rounded-xl bg-[#f0ecff] dark:bg-[#2b2334] items-center justify-center"><Ionicons name={icon} size={18} color="#6d5dfb" /></View>
      <View className="flex-1 ml-3"><Text className="text-[14px] font-semibold text-[#38313f] dark:text-white">{title}</Text><Text className="text-[11px] text-[#8a8292] dark:text-[#978e9f] mt-0.5">{subtitle}</Text></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#ded8e5", true: "#a99cff" }} thumbColor={value ? "#6d5dfb" : "#ffffff"} />
    </View>
  );
}
