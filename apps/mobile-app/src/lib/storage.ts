import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        console.error("Local storage error:", err);
        return null;
      }
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (err) {
      console.error("AsyncStorage getItem error:", err);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        console.error("Local storage error:", err);
      }
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.error("AsyncStorage setItem error:", err);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        console.error("Local storage error:", err);
      }
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.error("AsyncStorage removeItem error:", err);
    }
  },
};
