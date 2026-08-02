import { Tabs } from 'expo-router';
import React from 'react';
import { Chrome, Heart, Search, ShoppingBag, User } from 'lucide-react-native';
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ff3f6c',
        tabBarInactiveTintColor: '#3e3e3e',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color ,size}) => <Chrome size={size} color={color}/>,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color ,size}) => <Search size={size} color={color}/>,
        }}
      />
        <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color ,size}) => <Heart size={size} color={color}/>,
        }}
      />
        <Tabs.Screen
        name="bag"
        options={{
          title: 'Bag',
          tabBarIcon: ({ color ,size}) => <ShoppingBag size={size} color={color}/>,
        }}
      />
        <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color ,size}) => <User size={size} color={color}/>,
        }}
      />
     
    </Tabs>
  );
}
