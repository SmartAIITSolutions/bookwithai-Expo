import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function StaffAccountScreen() {
  const { user, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign out?', "You'll need to sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/auth'); },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{(user?.email || 'S')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.signOutBtnText}>Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain, padding: Spacing.xl, gap: Spacing.xl },
  header: {},
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: Colors.textPrimary },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: Colors.white },
  profileEmail: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#FEF2F2', borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.error },
  signOutBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: Colors.error },
});
