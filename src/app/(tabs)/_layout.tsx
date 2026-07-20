import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth/AuthContext';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import {
  Bookmark,
  CalendarDays,
  LucideIcon,
  UserRound,
} from 'lucide-react-native';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  gold: '#F4D77A',
  purple: '#8B5CFF',
  white: '#FFFFFF',
  inactive: 'rgba(255,255,255,0.72)',
  border: 'rgba(212,175,55,0.28)',
  background: 'rgba(10,0,16,0.78)',
};

function TabIcon({
  Icon,
  color,
  size,
  focused,
}: {
  Icon: LucideIcon;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={styles.iconSlot}>
      {focused && (
        <>
          <View style={styles.activeGlowOuter} />
          <View style={styles.activeGlowInner} />
        </>
      )}

      <Icon
        size={focused ? size + 1 : size}
        color={color as string}
        strokeWidth={focused ? 2 : 1.7}
      />

      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {user && <NotificationBell />}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: COLORS.gold,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 10,
            height: 66 + insets.bottom,
            paddingTop: 8,
            paddingBottom: 8 + insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderRadius: 26,
            overflow: 'hidden',
            elevation: 0,
          },
          tabBarBackground: () => (
            <View style={styles.tabBackground}>
              <BlurView
                intensity={42}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.tabTint} />
              <View style={styles.topHighlight} />
            </View>
          ),
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: 10.5,
            marginTop: 1,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
        }}>
        <Tabs.Screen
          name="book"
          options={{
            title: 'Book',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                Icon={CalendarDays}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="my-booking"
          options={{
            title: 'My Booking',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                Icon={Bookmark}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                Icon={UserRound}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09000F',
  },

  iconSlot: {
    width: 42,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeGlowOuter: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(139,92,255,0.16)',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.56,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },

  activeGlowInner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244,215,122,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(244,215,122,0.14)',
  },

  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },

  tabBackground: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 18,
  },

  tabTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(28,5,41,0.58)',
  },

  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 42,
    right: 42,
    height: 1,
    backgroundColor: 'rgba(244,215,122,0.32)',
  },
});