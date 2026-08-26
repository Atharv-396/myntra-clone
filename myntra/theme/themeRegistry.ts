import { Theme, ResolvedTheme } from "./types";
import { lightTheme } from "./lightTheme";
import { darkTheme } from "./darkTheme";

export const themeRegistry: Record<ResolvedTheme, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

export function getTheme(id: ResolvedTheme): Theme {
  return themeRegistry[id] || lightTheme;
}
