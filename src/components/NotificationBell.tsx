import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { fetchNotifications } from '@/lib/notifications/api';
import { Colors, FontFamily, FontSize } from '@/constants/Theme';

export function NotificationBell() {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications().then((items) => {
        const count = items.filter((n) => !n.read).length;
        setUnreadCount(count);
        Notifications.setBadgeCountAsync(count);
      });
    }, [])
  );

  return (
    <Pressable
      style={[styles.bell, { top: insets.top + 8 }]}
      onPress={() => router.push('/notifications')}
      hitSlop={12}>
      <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
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
