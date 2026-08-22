import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSanaaCalls, SanaaCall } from '@/lib/api/ownerSanaaCalls';
import { useSanaaCallsRealtime } from '@/lib/sanaa/useSanaaCallsRealtime';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#0B0712' },
  headerTintColor: '#F4D77A',
  headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
  title: 'Calls & Activity',
  headerBackTitle: 'SANAA',
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  booked: { label: 'Booked', color: '#4ADE80' },
  cancelled: { label: 'Cancelled', color: '#F87171' },
  rescheduled: { label: 'Rescheduled', color: '#C4B5FD' },
  transferred: { label: 'Transferred', color: '#FFC857' },
  no_answer: { label: 'No Answer', color: 'rgba(255,255,255,0.4)' },
  info_only: { label: 'Info Only', color: 'rgba(255,255,255,0.4)' },
  no_action: { label: 'Info / Question', color: 'rgba(255,255,255,0.4)' },
};

function outcomeFor(call: SanaaCall): { label: string; color: string } {
  if (call.outcome && OUTCOME_LABELS[call.outcome]) return OUTCOME_LABELS[call.outcome];
  if (call.status === 'initiated') return { label: 'Incomplete', color: 'rgba(255,255,255,0.35)' };
  return { label: call.outcome ?? '—', color: 'rgba(255,255,255,0.4)' };
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'Unknown number';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) return `***-***-${digits.slice(-4)}`;
  return phone;
}

function formatDuration(secs: number | null): string {
  if (secs == null) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function CallRow({ call }: { call: SanaaCall }) {
  const [expanded, setExpanded] = useState(false);
  const outcome = outcomeFor(call);
  const hasDetail = !!(call.summary || call.transcript_text);
  const who = call.customer_name ?? maskPhone(call.from_number);

  return (
    <View style={[styles.card, styles.callCard]}>
      <CardOverlay />
      <TouchableOpacity
        style={styles.callRow}
        onPress={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.callTopLine}>
            <Text style={styles.callerName} numberOfLines={1}>{who}</Text>
            <View style={[styles.outcomeBadge, { backgroundColor: `${outcome.color}22` }]}>
              <Text style={[styles.outcomeText, { color: outcome.color }]}>{outcome.label}</Text>
            </View>
          </View>
          <Text style={styles.callMeta}>
            {formatDate(call.started_at)} · {formatDuration(call.duration_seconds)}
          </Text>
        </View>
        {hasDetail && (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.35)" />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detailBlock}>
          {call.summary && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Summary</Text>
              <Text style={styles.detailBody}>{call.summary}</Text>
            </View>
          )}
          {call.transcript_text && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Transcript</Text>
              <Text style={styles.transcriptBody}>{call.transcript_text}</Text>
            </View>
          )}
          {call.booking_id && (
            <TouchableOpacity
              style={styles.viewAppointmentBtn}
              onPress={() => router.push(`/appointment/${call.booking_id}` as never)}
            >
              <Ionicons name="calendar-outline" size={14} color="#F4D77A" />
              <Text style={styles.viewAppointmentText}>View Appointment</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// P8.3: real call history, replacing the P0/P1 placeholder shell.
// customer_name (resolved server-side when customer_id matches a real
// customer) takes priority over a masked caller number -- never both.
export default function SanaaCallsScreen() {
  const { clientId } = useAuth();
  const [calls, setCalls] = useState<SanaaCall[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getSanaaCalls(0);
    if (result.ok) {
      setCalls(result.data.calls);
      setHasMore(result.data.hasMore);
      setPage(0);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  // A new/updated call while this screen is open resets back to a fresh
  // first page rather than trying to splice an update into whatever page
  // the owner has scrolled to.
  useSanaaCallsRealtime(clientId, loadFirstPage);

  async function loadMore() {
    setLoadingMore(true);
    const next = page + 1;
    const result = await getSanaaCalls(next);
    setLoadingMore(false);
    if (result.ok) {
      setCalls((prev) => [...prev, ...result.data.calls]);
      setHasMore(result.data.hasMore);
      setPage(next);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <BreathingHeart size={40} color="#F4D77A" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <ErrorState message={error} onRetry={loadFirstPage} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={HEADER_OPTIONS} />
      <ScrollView contentContainerStyle={styles.content}>
        {calls.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <CardOverlay />
            <Ionicons name="call-outline" size={28} color="rgba(255,200,87,0.5)" />
            <Text style={styles.emptyText}>No calls yet. Once SANAA answers a call, it'll show up here.</Text>
          </View>
        ) : (
          <>
            {calls.map((call) => <CallRow key={call.id} call={call} />)}
            {hasMore && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                <Text style={styles.loadMoreText}>{loadingMore ? 'Loading…' : 'Load More'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 110 },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  callCard: { marginBottom: Spacing.sm },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  callTopLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 3 },
  callerName: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  callMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  outcomeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  outcomeText: { fontFamily: FontFamily.soraSemiBold, fontSize: 10 },
  detailBlock: {
    borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', padding: Spacing.md, gap: Spacing.sm,
  },
  detailSection: { gap: 4 },
  detailLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
    color: 'rgba(255,200,87,0.6)',
  },
  detailBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', lineHeight: FontSize.sm * 1.5 },
  transcriptBody: {
    fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', lineHeight: FontSize.xs * 1.6,
  },
  viewAppointmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
  viewAppointmentText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#F4D77A' },
  emptyCard: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  loadMoreBtn: {
    marginTop: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
    paddingVertical: 12, alignItems: 'center',
  },
  loadMoreText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
});
