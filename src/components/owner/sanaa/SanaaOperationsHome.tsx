import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SanaaLifecycle } from '@/lib/api/ownerSanaa';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const STATUS_COPY: Record<string, { label: string; color: string; dot: string }> = {
  live: { label: 'LIVE — Answering Calls', color: '#4ADE80', dot: '🟢' },
  paused: { label: 'PAUSED — Not Answering Calls', color: 'rgba(255,255,255,0.6)', dot: '⏸️' },
  action_required: { label: 'ACTION REQUIRED', color: '#EF4444', dot: '⚠️' },
};

const MANAGEMENT_ROWS = [
  { icon: 'call-outline' as const, label: 'Calls & Activity', route: '/owner-sanaa/calls' },
  { icon: 'settings-outline' as const, label: 'Configure SANAA', route: '/owner-sanaa/configure' },
  { icon: 'phone-portrait-outline' as const, label: 'Phone & Connectivity', route: '/owner-sanaa/phone' },
  { icon: 'card-outline' as const, label: 'Plan & Billing', route: '/owner-sanaa/billing' },
];

interface SanaaOperationsHomeProps {
  state: SanaaLifecycle;
}

// Live/paused/action-required experience -- SANAA-P0/P1-SPEC §13/§14.
// Strict order: status -> results -> recent activity -> management. Never
// leads with settings. Results/activity are placeholder containers since no
// real call data exists yet -- that's a separately-scoped later phase.
export function SanaaOperationsHome({ state }: SanaaOperationsHomeProps) {
  const status = STATUS_COPY[state] ?? STATUS_COPY.paused;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BlurView intensity={90} tint="dark" style={styles.statusCard}>
        <CardOverlay />
        <Text style={styles.statusName}>SANAA</Text>
        <Text style={[styles.statusLine, { color: status.color }]}>{status.dot} {status.label}</Text>
        {state === 'action_required' && (
          <Text style={styles.statusReason}>Something needs your attention -- open Plan & Billing or Phone & Connectivity below to resolve it.</Text>
        )}
        {state === 'paused' && (
          <TouchableOpacity style={styles.resumeBtn}>
            <Text style={styles.resumeBtnText}>Resume SANAA</Text>
          </TouchableOpacity>
        )}
      </BlurView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results</Text>
        <View style={styles.placeholderCard}>
          <Ionicons name="stats-chart-outline" size={22} color="rgba(255,200,87,0.6)" />
          <Text style={styles.placeholderText}>Call and booking metrics are coming here soon.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.placeholderCard}>
          <Ionicons name="time-outline" size={22} color="rgba(255,200,87,0.6)" />
          <Text style={styles.placeholderText}>Recent calls will show up here.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage</Text>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          {MANAGEMENT_ROWS.map((row, i) => (
            <TouchableOpacity
              key={row.label}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => router.push(row.route as never)}
            >
              <Ionicons name={row.icon} size={18} color="#FFC857" />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          ))}
        </BlurView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
  statusCard: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.lg, gap: 6,
  },
  statusName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: '#FFFFFF' },
  statusLine: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base },
  statusReason: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  resumeBtn: {
    marginTop: Spacing.sm, alignSelf: 'flex-start', borderRadius: BorderRadius.full,
    backgroundColor: '#F4D77A', paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  resumeBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeholderCard: {
    borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,200,87,0.35)',
    backgroundColor: 'rgba(0,0,0,0.15)', padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
  },
  placeholderText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  rowLabel: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
});
