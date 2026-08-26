import React from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "@/theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  variant?: "background" | "surface" | "surfaceSecondary" | "card";
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  variant = "background",
  ...otherProps
}: ThemedViewProps) {
  const { theme, isDark } = useTheme();

  const backgroundColor =
    (isDark ? darkColor : lightColor) || theme.colors[variant];

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
