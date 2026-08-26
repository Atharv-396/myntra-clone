import React from "react";
import { Text, type TextProps, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link" | "caption" | "label";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { theme, isDark } = useTheme();

  const color =
    (isDark ? darkColor : lightColor) ||
    (type === "link"
      ? theme.colors.info
      : type === "caption"
      ? theme.colors.textTertiary
      : type === "label"
      ? theme.colors.textSecondary
      : theme.colors.textPrimary);

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        type === "caption" ? styles.caption : undefined,
        type === "label" ? styles.label : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 15,
    lineHeight: 22,
  },
  defaultSemiBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "bold",
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
});
