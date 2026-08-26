import { createContext } from "react";
import { ThemeContextType } from "./types";
import { lightTheme } from "./lightTheme";

export const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  themeMode: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  isDark: false,
  isLight: true,
  isSystem: true,
  setThemeMode: async () => {},
});
