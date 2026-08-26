import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { useColorScheme as useRNColorScheme, Appearance } from "react-native";
import { ThemeMode, ResolvedTheme, ThemeContextType } from "./types";
import { getTheme } from "./themeRegistry";
import { getStoredTheme, setStoredTheme } from "./themeStorage";
import { fetchUserTheme, updateUserTheme } from "./themeApi";
import { ThemeContext } from "./ThemeContext";
import { useAuth } from "@/context/AuthContext";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const rnColorScheme = useRNColorScheme();
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(
    rnColorScheme === "dark" ? "dark" : "light"
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  // Safely access auth context if available
  let userId: string | undefined;
  try {
    const auth = useAuth();
    userId = auth?.user?._id;
  } catch {
    // Auth context not mounted yet or unavailable
    userId = undefined;
  }

  const prevUserIdRef = useRef<string | undefined>(undefined);

  // 1. Listen for device appearance changes in real-time
  useEffect(() => {
    const currentScheme = Appearance.getColorScheme();
    setSystemTheme(currentScheme === "dark" ? "dark" : "light");

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === "dark" ? "dark" : "light");
    });

    return () => subscription.remove();
  }, []);

  // 2. Load stored theme on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const stored = await getStoredTheme();
      if (isMounted) {
        setThemeModeState(stored);
        setIsLoaded(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Sync with backend on user login / account change
  useEffect(() => {
    if (!userId || userId === prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      return;
    }
    prevUserIdRef.current = userId;

    let isMounted = true;
    (async () => {
      const remoteTheme = await fetchUserTheme(userId);
      if (remoteTheme && isMounted) {
        setThemeModeState(remoteTheme);
        await setStoredTheme(remoteTheme);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // 4. Change theme handler (instant UI update + local storage + non-blocking backend sync)
  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setThemeModeState(mode);
      await setStoredTheme(mode);

      if (userId) {
        // Fire-and-forget sync to backend
        updateUserTheme(userId, mode).catch(() => {});
      }
    },
    [userId]
  );

  // 5. Resolve active theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === "system") {
      return systemTheme;
    }
    return themeMode;
  }, [themeMode, systemTheme]);

  const activeTheme = useMemo(() => {
    return getTheme(resolvedTheme);
  }, [resolvedTheme]);

  const contextValue: ThemeContextType = useMemo(
    () => ({
      theme: activeTheme,
      themeMode,
      resolvedTheme,
      systemTheme,
      isDark: resolvedTheme === "dark",
      isLight: resolvedTheme === "light",
      isSystem: themeMode === "system",
      setThemeMode,
    }),
    [activeTheme, themeMode, resolvedTheme, systemTheme, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
