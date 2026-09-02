import React, { createContext, useContext, useEffect, useState } from "react";
import { getUserData, saveUserData, clearUserData } from "@/utils/storage";
import axios from "axios";
import BASE_URL from "@/config/api";
import { mergeLocalHistoryAfterLogin } from "@/utils/recentlyViewedService";
import { mergeGuestCartAfterLogin } from "@/utils/cartService";
import { initializeNotifications, deregisterDevice } from "@/utils/notificationService";

type AuthContextType = {
  isAuthenticated: boolean;
  isHydrated: boolean;
  user: { _id: string; name: string; email: string; themePreference?: string } | null;
  Signup: (fullName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // isHydrated = false during SSR and before the first client-side session restore.
  // Components that read `user` must not render auth-dependent UI until this is true,
  // which prevents the server/client mismatch that causes React error #418.
  const [isHydrated, setIsHydrated] = useState(false);
  const [user, setUser] = useState<{
    _id: string;
    name: string;
    email: string;
    themePreference?: string;
  } | null>(null);

  // Restore session on app start — runs only on the client after mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getUserData();
        if (data._id && data.name && data.email) {
          setUser({
            _id: data._id,
            name: data.name,
            email: data.email,
          });
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.log("Session restore failed:", e);
      } finally {
        // Always mark hydrated after the first session check completes,
        // regardless of whether a user was found.
        setIsHydrated(true);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${BASE_URL}/user/login`, {
      email: email.trim().toLowerCase(),
      password,
    });

    const data = res.data.user;

    if (!data || !data._id) {
      throw new Error("Invalid response from server");
    }

    await saveUserData(data._id, data.fullName, data.email);
    setUser({
      _id: data._id,
      name: data.fullName,
      email: data.email,
      themePreference: data.themePreference,
    });
    setIsAuthenticated(true);

    // Merge any guest recently viewed history into MongoDB
    mergeLocalHistoryAfterLogin(data._id).catch(() => {});
    // Merge any guest cart items into MongoDB
    mergeGuestCartAfterLogin(data._id).catch(() => {});
    // Initialize push notifications for this device
    initializeNotifications(data._id).catch(() => {});
  };

  const Signup = async (fullName: string, email: string, password: string) => {
    const res = await axios.post(`${BASE_URL}/user/signup`, {
      fullName,
      email: email.trim().toLowerCase(),
      password,
    });

    const data = res.data.user;

    if (!data || !data._id) {
      throw new Error("Invalid response from server");
    }

    await saveUserData(data._id, data.fullName, data.email);
    setUser({
      _id: data._id,
      name: data.fullName,
      email: data.email,
      themePreference: data.themePreference,
    });
    setIsAuthenticated(true);

    // Merge any guest recently viewed history into MongoDB
    mergeLocalHistoryAfterLogin(data._id).catch(() => {});
    // Merge any guest cart items into MongoDB
    mergeGuestCartAfterLogin(data._id).catch(() => {});
    // Initialize push notifications for this device
    initializeNotifications(data._id).catch(() => {});
  };

  const logout = async () => {
    try {
      // Deregister push device before clearing user data
      const data = await getUserData();
      if (data._id) {
        deregisterDevice(data._id).catch(() => {});
      }
      await clearUserData();
    } catch (e) {
      console.log("Clear storage failed:", e);
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isHydrated, user, Signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
