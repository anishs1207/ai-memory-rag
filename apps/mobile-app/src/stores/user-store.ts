import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { asyncStorageAdapter } from "../lib/storage";
import type { AuthResult, LoginCredentials, UserProfile } from "../types/auth";
import type { ThemePreference, UserPreferences } from "../types/settings";

type UserStore = {
  hasHydrated: boolean;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  profile: UserProfile;
  preferences: UserPreferences;
  completeOnboarding: () => void;
  login: (credentials: LoginCredentials) => AuthResult;
  continueAsGuest: () => void;
  logout: () => void;
  updateProfile: (update: Partial<UserProfile>) => void;
  setTheme: (theme: ThemePreference) => void;
  updatePreferences: (update: Partial<UserPreferences>) => void;
  setHasHydrated: (value: boolean) => void;
};

const demoProfile: UserProfile = {
  id: "demo-user",
  username: "demo",
  displayName: "Anish Explorer",
  email: "demo@inqora.app",
  bio: "Curious builder exploring research, ideas, and better decisions with Inqora.",
  role: "Inqora member",
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      hasHydrated: false,
      hasCompletedOnboarding: false,
      isAuthenticated: false,
      profile: demoProfile,
      preferences: {
        theme: "system",
        compactMessages: false,
        haptics: true,
        responseStyle: "balanced",
        fontScale: "standard",
        rememberContext: true,
        speakResponses: false,
        biometricLock: false,
        mascotMotion: true,
        mascotSpeed: "normal",
      },
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      login: ({ username, password }) => {
        if (username.trim().toLowerCase() !== "demo" || password !== "demo123") {
          return { success: false, message: "Use the demo credentials shown below." };
        }
        set({ isAuthenticated: true });
        return { success: true };
      },
      continueAsGuest: () =>
        set((state) => ({
          isAuthenticated: true,
          profile: {
            ...state.profile,
            id: "guest-user",
            username: "guest",
            displayName: "Guest Explorer",
            email: "Local session",
            role: "Guest",
          },
        })),
      logout: () =>
        set({
          isAuthenticated: false,
          hasCompletedOnboarding: false,
        }),
      updateProfile: (update) => set((state) => ({ profile: { ...state.profile, ...update } })),
      setTheme: (theme) =>
        set((state) => ({ preferences: { ...state.preferences, theme } })),
      updatePreferences: (update) =>
        set((state) => ({ preferences: { ...state.preferences, ...update } })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "inqora-user-store",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: ({ hasCompletedOnboarding, isAuthenticated, profile, preferences }) => ({
        hasCompletedOnboarding,
        isAuthenticated,
        profile,
        preferences,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
      merge: (persisted, current) => {
        const saved = persisted as Partial<UserStore>;
        return {
          ...current,
          ...saved,
          profile: { ...current.profile, ...saved.profile },
          preferences: { ...current.preferences, ...saved.preferences },
        };
      },
    }
  )
);
