import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { Colors } from '@/constants/Theme';

export default function TabsLayout() {
  const { user } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      {user && <NotificationBell />}
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
        name="book"
        options={{
          title: 'Book',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-booking"
        options={{
          title: 'My Booking',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}
