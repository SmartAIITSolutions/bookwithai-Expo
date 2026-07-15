import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing } from '@/constants/Theme';

// PLACEHOLDER — Step 8 will build the real service selection screen
export default function ServicesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Select a Service</Text>
        <Text style={styles.subtitle}>Choose one or more services to book.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: 28, color: Colors.textPrimary },
  subtitle: { fontFamily: FontFamily.sora, fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
