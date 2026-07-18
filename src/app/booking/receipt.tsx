import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLongDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} at ${h}:${m} ${ampm}`;
}

export default function ReceiptScreen() {
  const { salonName, startsAt, serviceName, staffName, priceCents, taxCents, tipCents, totalCents } =
    useLocalSearchParams<{
      salonName: string; startsAt: string; serviceName: string; staffName: string;
      priceCents: string; taxCents: string; tipCents: string; totalCents: string;
    }>();

  const price = parseInt(priceCents || '0', 10);
  const tax = parseInt(taxCents || '0', 10);
  const tip = parseInt(tipCents || '0', 10);
  const total = parseInt(totalCents || '0', 10);

  async function handleShare() {
    const lines = [
      `Receipt — ${salonName}`,
      startsAt ? formatLongDateTime(startsAt) : '',
      serviceName,
      staffName ? `with ${staffName}` : null,
      '',
      `Service: ${formatPrice(price)}`,
      tax > 0 ? `Tax: ${formatPrice(tax)}` : null,
      tip > 0 ? `Tip: ${formatPrice(tip)}` : null,
      `Total: ${formatPrice(total)}`,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      // user cancelled -- nothing to recover from
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Receipt</Text>
        </View>
        <Pressable onPress={handleShare} style={styles.backBtn}>
          <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.salonName}>{salonName}</Text>
          <Text style={styles.dateText}>{startsAt ? formatLongDateTime(startsAt) : '—'}</Text>

          <View style={styles.divider} />

          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>{serviceName || 'Service'}</Text>
            <Text style={styles.lineValue}>{formatPrice(price)}</Text>
          </View>
          {staffName ? (
            <Text style={styles.staffText}>with {staffName}</Text>
          ) : null}

          <View style={styles.divider} />

          {tax > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.lineLabelSub}>Tax</Text>
              <Text style={styles.lineValueSub}>{formatPrice(tax)}</Text>
            </View>
          )}
          {tip > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.lineLabelSub}>Tip</Text>
              <Text style={styles.lineValueSub}>{formatPrice(tip)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.lineRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  scrollContent: { padding: Spacing.xl },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  salonName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  dateText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  lineValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  staffText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  lineLabelSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  lineValueSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  totalLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
});
