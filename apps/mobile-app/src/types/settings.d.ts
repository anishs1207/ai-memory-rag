export type ThemePreference = "light" | "dark" | "system";

export type UserPreferences = {
  theme: ThemePreference;
  compactMessages: boolean;
  haptics: boolean;
  responseStyle: "balanced" | "concise" | "detailed";
  fontScale: "standard" | "large" | "extra-large";
  rememberContext: boolean;
  speakResponses: boolean;
  biometricLock: boolean;
  mascotMotion: boolean;
  mascotSpeed: "calm" | "normal" | "lively";
};
