import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { SanaaLifecycle, SanaaStatus, pauseSanaa, resumeSanaa, repairSanaaConnection, openSanaaBillingPortal } from '@/lib/api/ownerSanaa';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSanaaCalls, getSanaaCallsSummary, SanaaCall, SanaaCallsSummary } from '@/lib/api/ownerSanaaCalls';
import { getSanaaUsage, SanaaUsage } from '@/lib/api/ownerSanaaUsage';
import { useSanaaCallsRealtime } from '@/lib/sanaa/useSanaaCallsRealtime';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatMonthDay, formatTimeShort, formatMonthDayLong, formatCentsUSD } from '@/lib/i18n/format';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function maskPhone(phone: string | null, unknownLabel: string): string {
  if (!phone) return unknownLabel;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) return `***-***-${digits.slice(-4)}`;
  return phone;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatMonthDay(d)}, ${formatTimeShort(d)}`;
}

function formatShortDate(iso: string): string {
  return formatMonthDay(new Date(iso));
}

function formatMoney(cents: number): string {
  return formatCentsUSD(cents);
}

function formatFullDate(dateIso: string): string {
  return formatMonthDayLong(new Date(dateIso));
}

interface SanaaOperationsHomeProps {
  state: SanaaLifecycle;
  /** Raw status payload -- null only in the __DEV__ state-switcher preview,
   *  where there's no real backend state to read banner reasons from. */
  status: SanaaStatus | null;
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
  const { t } = useTranslation(['sanaa']);
  const STATUS_COPY: Record<string, { label: string; color: string; dot: string }> = {
    live: { label: t('sanaa:operationsHome.statusLive'), color: '#4ADE80', dot: '🟢' },
    paused: { label: t('sanaa:operationsHome.statusPaused'), color: 'rgba(255,255,255,0.6)', dot: '⏸️' },
    action_required: { label: t('sanaa:operationsHome.statusActionRequired'), color: '#EF4444', dot: '⚠️' },
  };
  const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
    booked: { label: t('sanaa:operationsHome.outcomeBooked'), color: '#4ADE80' },
    cancelled: { label: t('sanaa:operationsHome.outcomeCancelled'), color: '#F87171' },
    rescheduled: { label: t('sanaa:operationsHome.outcomeRescheduled'), color: '#C4B5FD' },
    transferred: { label: t('sanaa:operationsHome.outcomeTransferred'), color: '#FFC857' },
    no_answer: { label: t('sanaa:operationsHome.outcomeNoAnswer'), color: 'rgba(255,255,255,0.4)' },
    info_only: { label: t('sanaa:operationsHome.outcomeInfoOnly'), color: 'rgba(255,255,255,0.4)' },
    no_action: { label: t('sanaa:operationsHome.outcomeInfoQuestion'), color: 'rgba(255,255,255,0.4)' },
  };
  function outcomeFor(call: SanaaCall): { label: string; color: string } {
    if (call.outcome && OUTCOME_LABELS[call.outcome]) return OUTCOME_LABELS[call.outcome];
    if (call.status === 'initiated') return { label: t('sanaa:operationsHome.outcomeIncomplete'), color: 'rgba(255,255,255,0.35)' };
    return { label: call.outcome ?? '—', color: 'rgba(255,255,255,0.4)' };
  }
  const MANAGEMENT_ROWS = [
    { icon: 'call-outline' as const, label: t('sanaa:operationsHome.manageCallsActivity'), route: '/owner-sanaa/calls' },
    { icon: 'settings-outline' as const, label: t('sanaa:operationsHome.manageConfigureSanaa'), route: '/owner-sanaa/configure' },
    { icon: 'phone-portrait-outline' as const, label: t('sanaa:operationsHome.managePhoneConnectivity'), route: '/owner-sanaa/phone' },
    { icon: 'card-outline' as const, label: t('sanaa:operationsHome.managePlanBilling'), route: '/owner-sanaa/billing' },
  ];
  const statusCopy = STATUS_COPY[state] ?? STATUS_COPY.paused;
  const { clientId } = useAuth();
  const queryClient = useQueryClient();

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
      if (result.code === 'billing_required') { router.push('/owner-sanaa/billing' as never); return; }
      // Audit finding — every other failure (most importantly code:'not_paused',
      // returned when the server already thinks service_state is 'active') used
      // to be silently swallowed here: no error shown, no state change, the
      // screen just kept showing stale "Paused" forever. The server is always
      // authoritative (never flip local UI state to "active" ourselves) -- the
      // fix is just to invalidate the shared status query so this screen (and
      // the Dashboard card, same query key) refetch and re-render from whatever
      // is actually true right now, instead of staying stuck on the state that
      // was on screen before the tap.
      await queryClient.invalidateQueries({ queryKey: ['owner-sanaa-status'] });
      return;
    }
    // Success path already invalidates via the query key below, so the
    // Dashboard card (which never unmounts on tab switches, per
    // useRefetchOnFocus's own comment) picks up the change even though it
    // isn't the screen being navigated to here.
    await queryClient.invalidateQueries({ queryKey: ['owner-sanaa-status'] });
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
            <Text style={styles.statusReason}>{t('sanaa:operationsHome.suspendedReason')}</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>{t('sanaa:operationsHome.updateBilling')}</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'cancelled' && (
          <>
            <Text style={styles.statusReason}>{t('sanaa:operationsHome.cancelledReason')}</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={() => router.push('/owner-sanaa/plans' as never)}>
              <Text style={styles.resumeBtnText}>{t('sanaa:operationsHome.restartSanaa')}</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'billing_other' && (
          <>
            <Text style={styles.statusReason}>{t('sanaa:operationsHome.billingOtherReason')}</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>{t('sanaa:operationsHome.updateBilling')}</Text>
            </TouchableOpacity>
          </>
        )}
        {actionReason === 'sync' && (
          <>
            <Text style={styles.statusReason}>{t('sanaa:operationsHome.syncReason')}</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleRepair} disabled={actionPending}>
              <Text style={styles.resumeBtnText}>{actionPending ? t('sanaa:operationsHome.repairing') : t('sanaa:operationsHome.repairConnection')}</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'paused' && (
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume} disabled={actionPending}>
            <Text style={styles.resumeBtnText}>{actionPending ? t('sanaa:operationsHome.resuming') : t('sanaa:operationsHome.resumeSanaa')}</Text>
          </TouchableOpacity>
        )}
        {state === 'live' && commercial === 'past_due' && (
          <>
            <Text style={styles.statusReason}>{t('sanaa:operationsHome.pastDueReason')}</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleUpdateBilling}>
              <Text style={styles.resumeBtnText}>{t('sanaa:operationsHome.updateBilling')}</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'live' && commercial === 'cancel_scheduled' && sanaaStatus?.current_period_end && (
          <Text style={styles.statusReason}>{t('sanaa:operationsHome.remainsActiveUntil', { date: formatFullDate(sanaaStatus.current_period_end) })}</Text>
        )}
        {state === 'live' && (
          <TouchableOpacity style={styles.pauseLink} onPress={handlePause} disabled={actionPending}>
            <Text style={styles.pauseLinkText}>{actionPending ? t('sanaa:operationsHome.pausing') : t('sanaa:operationsHome.pauseSanaa')}</Text>
          </TouchableOpacity>
        )}
      </BlurView>

      {usage?.available ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:operationsHome.yourSanaaUsage')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.usageBlock}>
              <Text style={styles.usagePlanName}>{usage.plan_name}</Text>
              <Text style={styles.usageMinutesLine}>
                {t('sanaa:operationsHome.minutesUsedOf', { used: usage.used_minutes, included: usage.included_minutes, percent: usage.usage_percent })}
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
                  <Text style={styles.usageOverageLine}>{t('sanaa:operationsHome.additionalMinutes', { count: usage.overage_minutes })}</Text>
                  <Text style={styles.usageEstimate}>
                    {t('sanaa:operationsHome.estimatedAdditionalUsage', { amount: formatMoney(usage.estimated_overage_cents) })}
                  </Text>
                </>
              ) : (
                <Text style={styles.usageRemainingLine}>{t('sanaa:operationsHome.minutesRemaining', { count: usage.remaining_minutes })}</Text>
              )}
              <Text style={styles.usageCycleLabel}>
                {formatShortDate(usage.current_period_start)} – {formatShortDate(usage.current_period_end)}
                {usage.renews_at ? t('sanaa:operationsHome.renewsOn', { date: formatShortDate(usage.renews_at) }) : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/owner-sanaa/billing' as never)}
            >
              <Text style={styles.rowLabel}>{t('sanaa:operationsHome.viewUsageBilling')}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          </BlurView>
        </View>
      ) : sanaaStatus?.tenant_role === 'prototype' ? (
        // Prototype/internal tenant -- never fakes a plan, cycle, or
        // commercial limit (none exists, by design -- see MASTER.md §70).
        // Still shows real usage, so the screen isn't just silently empty.
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:operationsHome.yourSanaaUsage')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.usageBlock}>
              <Text style={styles.usagePlanName}>{t('sanaa:operationsHome.prototypeInternal')}</Text>
              <Text style={styles.usageMinutesLine}>
                {t('sanaa:operationsHome.prototypeMinutesUsed', { count: summary?.total_minutes_used_window ?? 0, days: summary?.window_days ?? 30 })}
              </Text>
              <Text style={styles.usageRemainingLine}>{t('sanaa:operationsHome.prototypeNoCycle')}</Text>
            </View>
          </BlurView>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{summary ? t('sanaa:operationsHome.resultsLastDays', { days: summary.window_days }) : t('sanaa:operationsHome.results')}</Text>
        {loadingActivity && !summary ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="stats-chart-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>{t('sanaa:operationsHome.loading')}</Text>
          </View>
        ) : (
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.calls_handled ?? 0}</Text>
                <Text style={styles.metricLabel}>{t('sanaa:operationsHome.callsHandled')}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.appointments_booked ?? 0}</Text>
                <Text style={styles.metricLabel}>{t('sanaa:operationsHome.bookedCalls')}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.transfers ?? 0}</Text>
                <Text style={styles.metricLabel}>{t('sanaa:operationsHome.transfers')}</Text>
              </View>
            </View>
            <View style={[styles.metricsRow, styles.rowBorder]}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{formatMoney(summary?.booking_value_cents ?? 0)}</Text>
                <Text style={styles.metricLabel}>{t('sanaa:operationsHome.voiceAiBookingValue')}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {summary?.booking_conversion_percent != null ? `${summary.booking_conversion_percent}%` : t('sanaa:operationsHome.notAvailable')}
                </Text>
                <Text style={styles.metricLabel}>{t('sanaa:operationsHome.conversion')}</Text>
              </View>
            </View>
          </BlurView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sanaa:operationsHome.recentActivity')}</Text>
        {loadingActivity && recentCalls.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="time-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>{t('sanaa:operationsHome.loading')}</Text>
          </View>
        ) : recentCalls.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="time-outline" size={22} color="rgba(255,200,87,0.6)" />
            <Text style={styles.placeholderText}>{t('sanaa:operationsHome.recentCallsWillShowHere')}</Text>
          </View>
        ) : (
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            {recentCalls.map((call, i) => {
              const outcome = outcomeFor(call);
              const who = call.customer_name ?? maskPhone(call.from_number, t('sanaa:operationsHome.unknownNumber'));
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
          <Text style={styles.viewAllText}>{t('sanaa:operationsHome.viewAllCalls')}</Text>
          <Ionicons name="chevron-forward" size={14} color="#F4D77A" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sanaa:operationsHome.manage')}</Text>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          {MANAGEMENT_ROWS.map((row, i) => (
            <TouchableOpacity
              key={i}
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
