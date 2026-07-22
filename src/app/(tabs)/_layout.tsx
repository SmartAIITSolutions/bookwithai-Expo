import { NotificationBell } from '@/components/NotificationBell';
import { TabIcon, TAB_ICON_COLORS } from '@/components/TabIcon';
import { useAuth } from '@/lib/auth/AuthContext';
import { useFavorites } from '@/lib/favorites/FavoritesContext';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import {
  Bookmark,
  CalendarDays,
  Heart,
  UserRound,
} from 'lucide-react-native';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { carouselTransitionSpec, makeArcInterpolator } from '@/lib/navigation/tabTransition';

const COLORS = {
  ...TAB_ICON_COLORS,
  border: 'rgba(123,63,228,0.34)',
  background: 'rgba(20,10,34,0.82)',
};

export default function TabsLayout() {
  const { user } = useAuth();
  const { hasFavorites } = useFavorites();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.root}>
      {user && <NotificationBell />}

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyleInterpolator: makeArcInterpolator(width),
          transitionSpec: carouselTransitionSpec,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: COLORS.gold,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 66 + insets.bottom,
            paddingTop: 8,
            paddingBottom: 8 + insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
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
            title: 'Find Salon',
            href: hasFavorites ? null : undefined,
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
          name="my-salons"
          options={{
            title: 'My Salons',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                Icon={Heart}
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

  tabBackground: {
    flex: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
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