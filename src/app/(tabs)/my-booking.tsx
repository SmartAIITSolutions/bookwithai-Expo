import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing } from '@/constants/Theme';

// PLACEHOLDER — Step 13 will build the real booking confirmation + upcoming screen
export default function MyBookingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>My Booking</Text>
        <Text style={styles.subtitle}>Your upcoming appointments will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
