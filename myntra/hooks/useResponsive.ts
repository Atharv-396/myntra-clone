/**
 * useResponsive.ts
 * Centralized responsive utilities for the Myntra Clone app.
 * Use this hook in screens/components to get safe area insets,
 * screen dimensions, and breakpoint helpers.
 *
 * Breakpoints:
 *   phone:  width < 600
 *   tablet: width >= 600 && width < 1024
 *   desktop: width >= 1024
 */

import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isPhone = width < 600;
  const isTablet = width >= 600 && width < 1024;
  const isDesktop = width >= 1024;
  const isLandscape = width > height;

  // Safe header top padding — replaces all hardcoded paddingTop: 50
  const headerPaddingTop = insets.top + 8;
  // Safe bottom padding for footers
  const footerPaddingBottom = insets.bottom > 0 ? insets.bottom : 8;

  // Dynamic product card columns based on screen width
  const productGridColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  // Dynamic card widths for horizontal carousels
  const carouselCardWidth = isDesktop ? 180 : isTablet ? 160 : width < 360 ? 110 : 130;

  // Product image height ratio (3:4 portrait)
  const productImageHeight = Math.round(width * (isTablet ? 0.5 : 0.8));

  // Carousel image height
  const carouselImageHeight = carouselCardWidth * 1.2;

  // Banner height
  const bannerHeight = isTablet ? 280 : isPhone && width < 360 ? 140 : 180;

  return {
    width,
    height,
    insets,
    isPhone,
    isTablet,
    isDesktop,
    isLandscape,
    headerPaddingTop,
    footerPaddingBottom,
    productGridColumns,
    carouselCardWidth,
    productImageHeight,
    carouselImageHeight,
    bannerHeight,
  };
}
