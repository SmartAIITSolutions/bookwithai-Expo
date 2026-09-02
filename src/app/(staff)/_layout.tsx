import { View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Theme';
import { carouselTransitionSpec, makeArcInterpolator } from '@/lib/navigation/tabTransition';

// Staff mode (individual_accounts login, Sprint 7) — a deliberately lean
// shell, not a role-branched copy of the owner app's 5 tabs. Real,
// simple, useful for what a staff member actually needs day-to-day.
export default function StaffTabsLayout() {
  const { t } = useTranslation(['common']);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyleInterpolator: makeArcInterpolator(width),
          transitionSpec: carouselTransitionSpec,
          tabBarActiveTintColor: Colors.navSelected,
          tabBarInactiveTintColor: Colors.navUnselected,
          tabBarStyle: {
            backgroundColor: Colors.navBackground,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontFamily: 'Sora_500Medium',
            fontSize: 11,
          },
        }}>
        <Tabs.Screen
          name="schedule"
          options={{
            title: t('common:tabs.schedule'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="time-off"
          options={{
            title: t('common:tabs.timeOff'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="airplane-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: t('common:tabs.earnings'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cash-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: t('common:tabs.account'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
