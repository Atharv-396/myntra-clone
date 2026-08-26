export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  divider: string;
  primary: string;
  primaryText: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  disabled: string;
  overlay: string;
  placeholder: string;
  icon: string;
  iconSecondary: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBar: "light" | "dark";
}

export interface ThemeTypography {
  fontFamily: {
    regular: string;
    medium: string;
    bold: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    title: number;
  };
  fontWeight: {
    regular: "400";
    medium: "500";
    semibold: "600";
    bold: "700";
  };
  lineHeight: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    title: number;
  };
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ThemeShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeShadows {
  none: ThemeShadowStyle;
  sm: ThemeShadowStyle;
  md: ThemeShadowStyle;
  lg: ThemeShadowStyle;
}

export interface ThemeIconSizes {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeComponentHeights {
  button: number;
  input: number;
  header: number;
  tab: number;
}

export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  iconSizes: ThemeIconSizes;
  componentHeights: ThemeComponentHeights;
}

export interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}
