import { ThemeMode } from "./types";

const THEME_STORAGE_KEY = "@app/theme-preference";
const isWeb = typeof window !== "undefined" && typeof localStorage !== "undefined";

const VALID_MODES: ThemeMode[] = ["system", "light", "dark"];

function isValidThemeMode(val: any): val is ThemeMode {
  return typeof val === "string" && VALID_MODES.includes(val as ThemeMode);
}

export async function getStoredTheme(): Promise<ThemeMode> {
  try {
    let raw: string | null = null;
    if (isWeb) {
      raw = localStorage.getItem(THEME_STORAGE_KEY);
    } else {
      const SecureStore = await import("expo-secure-store");
      raw = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    }

    if (raw && isValidThemeMode(raw)) {
      return raw;
    }
  } catch (error) {
    console.log("[ThemeStorage] Failed to read theme from storage:", error);
  }
  return "system";
}

export async function setStoredTheme(themeMode: ThemeMode): Promise<void> {
  try {
    const value = isValidThemeMode(themeMode) ? themeMode : "system";
    if (isWeb) {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, value);
    }
  } catch (error) {
    console.log("[ThemeStorage] Failed to save theme to storage:", error);
  }
}

export async function removeStoredTheme(): Promise<void> {
  try {
    if (isWeb) {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(THEME_STORAGE_KEY);
    }
  } catch (error) {
    console.log("[ThemeStorage] Failed to remove theme from storage:", error);
  }
}
