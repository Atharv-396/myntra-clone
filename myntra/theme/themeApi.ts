import axios from "axios";
import BASE_URL from "@/config/api";
import { ThemeMode } from "./types";

let lastSyncTimestamp = 0;

export async function fetchUserTheme(userId: string): Promise<ThemeMode | null> {
  if (!userId) return null;
  try {
    const res = await axios.get(`${BASE_URL}/user/theme/${userId}`, { timeout: 5000 });
    const pref = res.data?.themePreference;
    if (pref === "system" || pref === "light" || pref === "dark") {
      return pref;
    }
  } catch (error: any) {
    console.log("[ThemeApi] fetchUserTheme error:", error?.message || error);
  }
  return null;
}

export async function updateUserTheme(
  userId: string,
  themeMode: ThemeMode
): Promise<ThemeMode | null> {
  if (!userId) return null;
  const currentTimestamp = Date.now();
  lastSyncTimestamp = currentTimestamp;

  try {
    const res = await axios.patch(
      `${BASE_URL}/user/theme`,
      { userId, themePreference: themeMode },
      { timeout: 5000 }
    );

    // If a newer request was initiated while this request was in flight, discard response
    if (lastSyncTimestamp > currentTimestamp) {
      return null;
    }

    const pref = res.data?.themePreference;
    if (pref === "system" || pref === "light" || pref === "dark") {
      return pref;
    }
  } catch (error: any) {
    console.log("[ThemeApi] updateUserTheme error (offline or server error):", error?.message || error);
  }
  return null;
}
