import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { formatCentsUSD, formatFullDateTime } from '@/lib/i18n/format';
import { useTranslation } from 'react-i18next';

const formatPrice = formatCentsUSD;

function formatLongDateTime(isoStr: string) {
  return formatFullDateTime(new Date(isoStr));
}

export default function ReceiptScreen() {
  const { t } = useTranslation(['booking']);
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
      t('booking:receiptScreen.receiptFor', { salonName }),
      startsAt ? formatLongDateTime(startsAt) : '',
      serviceName,
      staffName ? t('booking:receiptScreen.with', { name: staffName }) : null,
      '',
      t('booking:receiptScreen.serviceLine', { amount: formatPrice(price) }),
      tax > 0 ? t('booking:receiptScreen.taxLine', { amount: formatPrice(tax) }) : null,
      tip > 0 ? t('booking:receiptScreen.tipLine', { amount: formatPrice(tip) }) : null,
      t('booking:receiptScreen.totalLine', { amount: formatPrice(total) }),
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
          <Text style={styles.headerTitle}>{t('booking:receiptScreen.title')}</Text>
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
            <Text style={styles.lineLabel}>{serviceName || t('booking:receiptScreen.service')}</Text>
            <Text style={styles.lineValue}>{formatPrice(price)}</Text>
          </View>
          {staffName ? (
            <Text style={styles.staffText}>{t('booking:receiptScreen.with', { name: staffName })}</Text>
          ) : null}

          <View style={styles.divider} />

          {tax > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.lineLabelSub}>{t('booking:receiptScreen.tax')}</Text>
              <Text style={styles.lineValueSub}>{formatPrice(tax)}</Text>
            </View>
          )}
          {tip > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.lineLabelSub}>{t('booking:receiptScreen.tip')}</Text>
              <Text style={styles.lineValueSub}>{formatPrice(tip)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.lineRow}>
            <Text style={styles.totalLabel}>{t('booking:receiptScreen.total')}</Text>
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
