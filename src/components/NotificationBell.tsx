import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Bell } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { fetchNotifications } from '@/lib/notifications/api';
import { Colors, FontFamily, FontSize } from '@/constants/Theme';

export function NotificationBell() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [unreadCount, setUnreadCount] = useState(0);
  // Book screen is a dark-background design exploration -- the default
  // dark icon color would be invisible there, so swap to a blurred glass
  // button with a gold lucide icon on that screen only. Every other tab
  // keeps the original plain Ionicons look.
  const onDarkScreen = segments[segments.length - 1] === 'book';

  useFocusEffect(
    useCallback(() => {
      fetchNotifications().then((items) => {
        const count = items.filter((n) => !n.read).length;
        setUnreadCount(count);
        Notifications.setBadgeCountAsync(count);
      });
    }, [])
  );

  const badge = unreadCount > 0 && (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
    </View>
  );

  if (onDarkScreen) {
    return (
      <Pressable
        style={[styles.bellGlassWrap, { top: insets.top + 8 }]}
        onPress={() => router.push('/notifications')}
        hitSlop={12}>
        <BlurView intensity={20} tint="dark" style={styles.bellGlassBlur}>
          <Bell size={21} color="#F4D77A" strokeWidth={1.7} />
        </BlurView>
        {badge}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.bell, { top: insets.top + 8 }]}
      onPress={() => router.push('/notifications')}
      hitSlop={12}>
      <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellGlassWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  bellGlassBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: 10,
    color: Colors.white,
  },
});
