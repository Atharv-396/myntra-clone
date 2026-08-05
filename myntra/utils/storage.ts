// Storage utility — works on both web and native
// Web: uses localStorage
// Native (iOS/Android): uses expo-secure-store

const isWeb = typeof window !== "undefined" && typeof localStorage !== "undefined";

const webStorage = {
  save: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch (e) {}
  },
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) {}
  },
};

const nativeStorage = {
  save: async (key: string, value: string) => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  },
  get: async (key: string): Promise<string | null> => {
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(key);
  },
  remove: async (key: string) => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  },
};

export const saveUserData = async (_id: string, name: string, email: string) => {
  if (isWeb) {
    webStorage.save("userid", _id);
    webStorage.save("userName", name);
    webStorage.save("userEmail", email);
  } else {
    await nativeStorage.save("userid", _id);
    await nativeStorage.save("userName", name);
    await nativeStorage.save("userEmail", email);
  }
};

export const getUserData = async () => {
  if (isWeb) {
    return {
      _id: webStorage.get("userid"),
      name: webStorage.get("userName"),
      email: webStorage.get("userEmail"),
    };
  } else {
    const _id = await nativeStorage.get("userid");
    const name = await nativeStorage.get("userName");
    const email = await nativeStorage.get("userEmail");
    return { _id, name, email };
  }
};

export const clearUserData = async () => {
  if (isWeb) {
    webStorage.remove("userid");
    webStorage.remove("userName");
    webStorage.remove("userEmail");
  } else {
    await nativeStorage.remove("userid");
    await nativeStorage.remove("userName");
    await nativeStorage.remove("userEmail");
  }
};
