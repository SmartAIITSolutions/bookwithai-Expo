import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Theme';

// Salon-owner mode — 5-tab shell, Phase 0.1 (locked 2026-07-16).
// Exactly these 5 tabs, nothing else: Dashboard · Calendar · Customers ·
// Reports · More. No floating action button — primary actions live inside
// each screen, never floating over content.
export default function OwnerTabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.navSelected,
          tabBarInactiveTintColor: Colors.navUnselected,
          tabBarStyle: {
            backgroundColor: Colors.navBackground,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontFamily: 'Sora_500Medium',
            fontSize: 11,
          },
        }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: 'Customers',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="menu-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
