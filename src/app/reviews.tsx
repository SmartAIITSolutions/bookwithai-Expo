import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { listOwnerReviews, OwnerReview } from '@/lib/api/ownerReviews';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= count ? 'star' : 'star-outline'} size={15} color="#F4D77A" />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<OwnerReview[]>([]);

  const load = useCallback(async () => {
    const result = await listOwnerReviews();
    if (result.ok) setReviews(result.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const average = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Reviews', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#F4D77A" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {average && (
            <BlurView intensity={90} tint="dark" style={styles.summaryCard}>
              <CardOverlay />
              <Text style={styles.summaryValue}>{average}</Text>
              <Stars count={Math.round(Number(average))} />
              <Text style={styles.summaryHint}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</Text>
            </BlurView>
          )}

          {reviews.length === 0 ? (
            <Text style={styles.emptyHint}>No reviews yet.</Text>
          ) : (
            reviews.map((r) => (
              <BlurView key={r.id} intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <View style={styles.cardTopRow}>
                  <Text style={styles.customerName}>{r.customer?.name ?? 'Customer'}</Text>
                  <Stars count={r.stars} />
                </View>
                {r.review_text && <Text style={styles.reviewText}>{r.review_text}</Text>}
                <Text style={styles.dateText}>
                  {formatDate(r.updated_at ?? r.submitted_at ?? '')}
                  {r.updated_at && r.submitted_at && r.updated_at !== r.submitted_at ? ' (edited)' : ''}
                </Text>
              </BlurView>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 60 },
  summaryCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.lg, alignItems: 'center', gap: 4, marginBottom: Spacing.sm,
  },
  summaryValue: { fontFamily: FontFamily.frauncesBold, fontSize: 32, color: '#FFFFFF' },
  summaryHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: Spacing.lg },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: 6,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  reviewText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },
  dateText: { fontFamily: FontFamily.sora, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
});
