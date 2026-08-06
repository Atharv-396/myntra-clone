/**
 * recentlyViewedStorage.ts
 * Handles local recently viewed history for guest (not logged in) users.
 * Uses the same cross-platform storage pattern as storage.ts.
 * Max 20 items, no duplicates, newest last.
 */

const MAX_HISTORY = 20;
const STORAGE_KEY = "recentlyViewed";

export interface LocalViewedItem {
  productId: string;
  viewedAt: string; // ISO date string
}

const isWeb =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const readRaw = async (): Promise<string | null> => {
  if (isWeb) {
    return localStorage.getItem(STORAGE_KEY);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(STORAGE_KEY);
};

const writeRaw = async (value: string): Promise<void> => {
  if (isWeb) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(STORAGE_KEY, value);
  }
};

const removeRaw = async (): Promise<void> => {
  if (isWeb) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }
};

/** Get the full local recently viewed history */
export const getLocalRecentlyViewed = async (): Promise<LocalViewedItem[]> => {
  try {
    const raw = await readRaw();
    if (!raw) return [];
    return JSON.parse(raw) as LocalViewedItem[];
  } catch {
    return [];
  }
};

/** Add a product to local history.
 * - Removes duplicates
 * - Adds as newest (end of array)
 * - Caps at MAX_HISTORY
 */
export const addToLocalRecentlyViewed = async (
  productId: string
): Promise<void> => {
  try {
    let history = await getLocalRecentlyViewed();

    // Remove existing entry for this product
    history = history.filter((item) => item.productId !== productId);

    // Add as newest
    history.push({ productId, viewedAt: new Date().toISOString() });

    // Cap at MAX_HISTORY (remove oldest = front of array)
    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY);
    }

    await writeRaw(JSON.stringify(history));
  } catch (e) {
    console.log("addToLocalRecentlyViewed error:", e);
  }
};

/** Clear the entire local recently viewed history */
export const clearLocalRecentlyViewed = async (): Promise<void> => {
  try {
    await removeRaw();
  } catch (e) {
    console.log("clearLocalRecentlyViewed error:", e);
  }
};
