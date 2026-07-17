import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

// Shared top bar for every primary owner-mode screen — Phase 0.1: Universal
// Search and Universal Create live here, present everywhere, not per-screen.
// Search and Create are not wired to real logic yet (Sprint 0 is shell only);
// they're placed now so no later sprint has to redesign the header to add them.
interface OwnerScreenHeaderProps {
  title: string;
  onSearchPress?: () => void;
  onCreatePress?: () => void;
  onNotificationsPress?: () => void;
}

export function OwnerScreenHeader({ title, onSearchPress, onCreatePress, onNotificationsPress }: OwnerScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onSearchPress} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="search-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCreatePress} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="add" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
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
