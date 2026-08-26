import { lightColors } from "@/theme/lightTheme";
import { darkColors } from "@/theme/darkTheme";

export const Colors = {
  light: {
    text: lightColors.textPrimary,
    background: lightColors.background,
    tint: lightColors.primary,
    icon: lightColors.icon,
    tabIconDefault: lightColors.tabBarInactive,
    tabIconSelected: lightColors.tabBarActive,
  },
  dark: {
    text: darkColors.textPrimary,
    background: darkColors.background,
    tint: darkColors.primary,
    icon: darkColors.icon,
    tabIconDefault: darkColors.tabBarInactive,
    tabIconSelected: darkColors.tabBarActive,
  },
};
