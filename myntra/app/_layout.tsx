import React from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/context/AuthContext";
import { getNotificationRoute } from "@/utils/notificationService";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    let isMounted = true;

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[Notification received]", notification.request.content.title);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        const route = getNotificationRoute(data);
        if (route) {
          setTimeout(() => {
            try {
              if (isMounted) {
                router.push(route as any);
              }
            } catch (e) {
              console.log("[Notification nav error]", e);
            }
          }, 500);
        }
      }
    );

    return () => {
      isMounted = false;
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [router]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="recently-viewed" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
