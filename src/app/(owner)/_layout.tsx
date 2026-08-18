import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Users, Sparkles, Menu } from 'lucide-react-native';
import { TabIcon, TAB_ICON_COLORS } from '@/components/TabIcon';
import { carouselTransitionSpec, makeArcInterpolator } from '@/lib/navigation/tabTransition';
import { getSanaaStatus, deriveSanaaLifecycle } from '@/lib/api/ownerSanaa';

const COLORS = {
  ...TAB_ICON_COLORS,
  border: 'rgba(123,63,228,0.34)',
  background: 'rgba(20,10,34,0.82)',
};

// Salon-owner mode — 5-tab shell, Phase 0.1 (locked 2026-07-16), amended
// 2026-08-17: Reports moved into the More screen to make room for SANAA's
// required permanent nav entry (SANAA-P0/P1-SPEC §4.1) without exceeding
// the locked tab count. Exactly these 5 tabs, nothing else: Dashboard ·
// Calendar · Customers · SANAA · More. No floating action button — primary
// actions live inside each screen, never floating over content.
export default function OwnerTabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Attention indicator is a real-condition badge only (SANAA-P0/P1-SPEC
  // §20) -- never shown for non-subscribers or a healthy/live tenant.
  const { data: sanaaStatus } = useQuery({
    queryKey: ['owner-sanaa-status'],
    queryFn: async () => {
      const r = await getSanaaStatus();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  const sanaaNeedsAttention = sanaaStatus ? deriveSanaaLifecycle(sanaaStatus) === 'action_required' : false;

  return (
    <View style={styles.root}>
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
              <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
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
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon Icon={Home} color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon Icon={CalendarDays} color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: 'Customers',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon Icon={Users} color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="sanaa"
          options={{
            title: 'SANAA',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon Icon={Sparkles} color={color} size={size} focused={focused} badge={sanaaNeedsAttention} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon Icon={Menu} color={color} size={size} focused={focused} />
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
