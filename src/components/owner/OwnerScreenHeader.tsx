import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

// Shared top bar for every primary owner-mode screen. Each action icon only
// renders when the screen actually passes a real handler for it -- Search
// never wired up anywhere and Create has no handler on most screens (only
// Calendar's does, opening the Walk-In sheet), so those were showing as
// dead buttons on every screen that didn't wire them.
interface OwnerScreenHeaderProps {
  title: string;
  onSearchPress?: () => void;
  onCreatePress?: () => void;
  onNotificationsPress?: () => void;
}

export function OwnerScreenHeader({ title, onSearchPress, onCreatePress, onNotificationsPress }: OwnerScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.actions}>
        {onSearchPress && (
          <TouchableOpacity onPress={onSearchPress} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="search-outline" size={20} color="#F4D77A" />
          </TouchableOpacity>
        )}
        {onNotificationsPress && (
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color="#F4D77A" />
          </TouchableOpacity>
        )}
        {onCreatePress && (
          <TouchableOpacity onPress={onCreatePress} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="add" size={22} color="#F4D77A" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
