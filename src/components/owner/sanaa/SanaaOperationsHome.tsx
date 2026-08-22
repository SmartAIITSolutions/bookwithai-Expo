import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { SanaaLifecycle, SanaaStatus, pauseSanaa, resumeSanaa, repairSanaaConnection, openSanaaBillingPortal } from '@/lib/api/ownerSanaa';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSanaaCalls, getSanaaCallsSummary, SanaaCall, SanaaCallsSummary } from '@/lib/api/ownerSanaaCalls';
import { getSanaaUsage, SanaaUsage } from '@/lib/api/ownerSanaaUsage';
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

const STATUS_COPY: Record<string, { label: string; color: string; dot: string }> = {
  live: { label: 'LIVE — Answering Calls', color: '#4ADE80', dot: '🟢' },
  paused: { label: 'PAUSED — Not Answering Calls', color: 'rgba(255,255,255,0.6)', dot: '⏸️' },
  action_required: { label: 'ACTION REQUIRED', color: '#EF4444', dot: '⚠️' },
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const MANAGEMENT_ROWS = [
  { icon: 'call-outline' as const, label: 'Calls & Activity', route: '/owner-sanaa/calls' },
  { icon: 'settings-outline' as const, label: 'Configure SANAA', route: '/owner-sanaa/configure' },
  { icon: 'phone-portrait-outline' as const, label: 'Phone & Connectivity', route: '/owner-sanaa/phone' },
  { icon: 'card-outline' as const, label: 'Plan & Billing', route: '/owner-sanaa/billing' },
];

interface SanaaOperationsHomeProps {
  state: SanaaLifecycle;
  /** Raw status payload -- null only in the __DEV__ state-switcher preview,
   *  where there's no real backend state to read banner reasons from. */
  status: SanaaStatus | null;
}

function formatFullDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

// Live/paused/action-required experience -- SANAA-P0/P1-SPEC §13/§14.
// Strict order: status -> results -> recent activity -> management. Never
// leads with settings.
//
// P8: Results and Recent Activity are now real, sourced from
// sanaa_call_logs via /api/owner/sanaa/calls (summary + first page), kept
// fresh by the same tenant-scoped Realtime subscription the Calls screen
// itself uses.
export function SanaaOperationsHome({ state, status: sanaaStatus }: SanaaOperationsHomeProps) {
  const statusCopy = STATUS_COPY[state] ?? STATUS_COPY.paused;
  const { clientId } = useAuth();

  const [summary, setSummary] = useState<SanaaCallsSummary | null>(null);
  const [recentCalls, setRecentCalls] = useState<SanaaCall[]>([]);
  const [usage, setUsage] = useState<SanaaUsage | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const commercial = sanaaStatus?.commercial_state ?? 'none';

  // P11 — action_required is reachable from two independent causes (a
  // billing problem, or Telnyx not yet caught up to the desired
  // service_state) -- pick the specific reason and CTA rather than one
  // generic "something's wrong" message.
  const actionReason: 'suspended' | 'cancelled' | 'billing_other' | 'sync' | null =
    state !== 'action_required' ? null
      : !sanaaStatus?.subscribed
        ? (commercial === 'suspended' ? 'suspended' : commercial === 'cancelled' ? 'cancelled' : 'billing_other')
        : 'sync';

  async function handleResume() {
    setActionPending(true);
    const result = await resumeSanaa();
    setActionPending(false);
    if (!result.ok) {
      if (result.code === 'billing_required') router.push('/owner-sanaa/billing' as never);
      return;
    }
    router.replace('/(owner)/sanaa' as never);
  }

  async function handlePause() {
    setActionPending(true);
    await pauseSanaa();
    setActionPending(false);
    router.replace('/(owner)/sanaa' as never);
  }

  async function handleRepair() {
    setActionPending(true);
    await repairSanaaConnection();
    setActionPending(false);
    router.replace('/(owner)/sanaa' as never);
  }

  async function handleUpdateBilling() {
    const result = await openSanaaBillingPortal();
    if (result.ok) {
      await WebBrowser.openBrowserAsync(result.data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } else {
      router.push('/owner-sanaa/billing' as never);
    }
  }

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    const [summaryResult, callsResult, usageResult] = await Promise.all([
      getSanaaCallsSummary(), getSanaaCalls(0), getSanaaUsage(),
    ]);
    if (summaryResult.ok) setSummary(summaryResult.data);
    if (callsResult.ok) setRecentCalls(callsResult.data.calls.slice(0, 5));
    if (usageResult.ok) setUsage(usageResult.data);
    setLoadingActivity(false);
  }, []);

  useEffect(() => { loadActivity(); }, [loadActivity]);
  useSanaaCallsRealtime(clientId, loadActivity);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BlurView intensity={90} tint="dark" style={styles.statusCard}>
        <CardOverlay />
        <Text style={styles.statusName}>SANAA</Text>
        <Text style={[styles.statusLine, { color: statusCopy.color }]}>{statusCopy.dot} {statusCopy.label}</Text>

        {actionReason === 'suspended' && (
          <>
            <Text style={styles.statusReason}>SANAA is unavailable due to a billing issue.</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>Update Billing</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'cancelled' && (
          <>
            <Text style={styles.statusReason}>Your SANAA subscription has ended.</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={() => router.push('/owner-sanaa/plans' as never)}>
              <Text style={styles.resumeBtnText}>Restart SANAA</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'billing_other' && (
          <>
            <Text style={styles.statusReason}>There's a billing issue with your SANAA subscription.</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>Update Billing</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'sync' && (
          <>
            <Text style={styles.statusReason}>SANAA needs attention -- we couldn't confirm her phone service is up to date.</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleRepair} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>{actionPending ? 'Repairing…' : 'Repair Connection'}</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'paused' && (
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume} disabled={actionPending}>
            <Text style={styles.resumeBtnText}>{actionPending ? 'Resuming…' : 'Resume SANAA'}</Text>
          </TouchableOpacity>
        )}
        {state === 'live' && commercial === 'past_due' && (
          <>
            <Text style={styles.statusReason}>Payment issue -- update your billing method to avoid interruption.</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling}>
              <Text style={styles.resumeBtnText}>Update Billing</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'live' && commercial === 'cancel_scheduled' && sanaaStatus?.current_period_end && (
          <Text style={styles.statusReason}>SANAA will remain active until {formatFullDate(sanaaStatus.current_period_end)}.</Text>
        )}
        {state === 'live' && (
          <TouchableOpacity style={styles.pauseLink} onPress={handlePause} disabled={actionPending}>
            <Text style={styles.pauseLinkText}>{actionPending ? 'Pausing…' : 'Pause SANAA'}</Text>
          </TouchableOpacity>
        )}
      </BlurView>

      {usage?.available && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.usageBlock}>
              <Text style={styles.usagePlanName}>{usage.plan_name}</Text>
              <Text style={styles.usageMinutesLine}>
                {usage.used_minutes} / {usage.included_minutes} minutes
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(usage.usage_percent, 100)}%`,
                      backgroundColor: usage.overage_minutes > 0 ? '#F87171' : '#F4D77A',
                    },
                  ]}
                />
              </View>
              {usage.overage_minutes > 0 ? (
                <>
                  <Text style={styles.usageOverageLine}>{usage.overage_minutes} additional minutes</Text>
                  <Text style={styles.usageEstimate}>
                    Estimated additional usage: {formatMoney(usage.estimated_overage_cents)}
                  </Text>
                </>
              ) : (
                <Text style={styles.usageRemainingLine}>{usage.remaining_minutes} minutes included remaining</Text>
              )}
              <Text style={styles.usageCycleLabel}>
                {formatShortDate(usage.current_period_start)} – {formatShortDate(usage.current_period_end)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/owner-sanaa/billing' as never)}
            >
              <Text style={styles.rowLabel}>View Usage & Billing</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results{summary ? ` — Last ${summary.window_days} Days` : ''}</Text>
        {loadingActivity && !summary ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="stats-chart-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>Loading…</Text>
          </View>
        ) : (
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.calls_handled ?? 0}</Text>
                <Text style={styles.metricLabel}>Calls Handled</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.appointments_booked ?? 0}</Text>
                <Text style={styles.metricLabel}>Booked</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.transfers ?? 0}</Text>
                <Text style={styles.metricLabel}>Transfers</Text>
              </View>
            </View>
          </BlurView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {loadingActivity && recentCalls.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="time-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>Loading…</Text>
          </View>
        ) : recentCalls.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="time-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>Recent calls will show up here.</Text>
          </View>
        ) : (
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            {recentCalls.map((call, i) => {
              const outcome = outcomeFor(call);
              const who = call.customer_name ?? maskPhone(call.from_number);
              return (
                <View key={call.id} style={[styles.activityRow, i > 0 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.activityTopLine}>
                      <Text style={styles.activityName} numberOfLines={1}>{who}</Text>
                      <View style={[styles.outcomeBadge, { backgroundColor: `${outcome.color}22` }]}>
                        <Text style={[styles.outcomeText, { color: outcome.color }]}>{outcome.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.activityMeta}>{formatDate(call.started_at)}</Text>
                    {!!call.summary && (
                      <Text style={styles.activitySummary} numberOfLines={1}>{call.summary}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </BlurView>
        )}
        <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push('/owner-sanaa/calls' as never)}>
          <Text style={styles.viewAllText}>View All Calls</Text>
          <Ionicons name="chevron-forward" size={14} color="#F4D77A" />
        </TouchableOpacity>
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
  pauseLink: { marginTop: Spacing.xs, alignSelf: 'flex-start' },
  pauseLinkText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)', textDecorationLine: 'underline' },
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
  usageBlock: { padding: Spacing.md, gap: 4 },
  usagePlanName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  usageMinutesLine: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginVertical: 4,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  usageRemainingLine: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  usageOverageLine: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#F87171' },
  usageEstimate: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  usageCycleLabel: { fontFamily: FontFamily.sora, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  metricsRow: { flexDirection: 'row', padding: Spacing.md },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: '#FFFFFF' },
  metricLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  activityRow: { padding: Spacing.md, gap: 3 },
  activityTopLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activityName: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  activityMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  activitySummary: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  outcomeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  outcomeText: { fontFamily: FontFamily.soraSemiBold, fontSize: 10 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  viewAllText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  rowLabel: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
});
