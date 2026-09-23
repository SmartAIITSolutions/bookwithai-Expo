import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, Image, useWindowDimensions } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { FontFamily } from '@/constants/Theme';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  getCustomer, updateCustomer, deleteCustomer, addNote, pinNote, deleteNote,
  getCommunications, listMedia, requestMediaUpload, deleteMedia, listAllTags, searchCustomers,
  CustomerDetailResponse, TimelineEntry, MediaItem, CustomerLite,
} from '@/lib/api/ownerCustomers';
import {
  getRelationshipTimeline, getReferrals, setReferredBy, grantReferralReward,
  TimelineEvent, ReferredByInfo, ReferredInfo,
} from '@/lib/api/ownerRelationship';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { CheckoutSheet, CheckoutSheetHandle } from '@/components/owner/CheckoutSheet';
import { SpendingSparkline } from '@/components/owner/SpendingSparkline';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import {
  listMembershipPlans, listCustomerMemberships, purchaseMembership, renewMembership, cancelMembership,
  MembershipPlan, CustomerMembership,
} from '@/lib/api/ownerMemberships';
import {
  listServicePackages, listCustomerPackages, purchaseServicePackage, redeemPackageVisit,
  ServicePackage, CustomerServicePackage,
} from '@/lib/api/ownerPackages';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { formatCentsUSD, formatWeekdayMonthDay, formatMonthDay, formatMonthDayYear } from '@/lib/i18n/format';

const money = formatCentsUSD;
function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return i18n.t('owner:customerDetail.today');
  if (days === 1) return i18n.t('owner:customerDetail.yesterday');
  if (days < 30) return i18n.t('owner:customerDetail.daysAgo', { count: days });
  return i18n.t('owner:customerDetail.monthsAgo', { count: Math.round(days / 30) });
}

export default function CustomerDetailScreen() {
  const { t } = useTranslation(['owner', 'common']);
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<CustomerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [comms, setComms] = useState<TimelineEntry[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const checkoutRef = useRef<CheckoutSheetHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);
  const [notesSectionY, setNotesSectionY] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pickingStaff, setPickingStaff] = useState(false);
  const [memberships, setMemberships] = useState<CustomerMembership[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerServicePackage[]>([]);
  const [availablePackages, setAvailablePackages] = useState<ServicePackage[]>([]);
  const [tagsCatalog, setTagsCatalog] = useState<string[]>([]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [referredBy, setReferredByState] = useState<ReferredByInfo | null>(null);
  const [referred, setReferred] = useState<ReferredInfo[]>([]);
  const [pickingReferrer, setPickingReferrer] = useState(false);
  const [referrerQuery, setReferrerQuery] = useState('');
  const [referrerResults, setReferrerResults] = useState<CustomerLite[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const [detail, commResult, mediaResult, membershipResult, packageResult, timelineResult, referralsResult] = await Promise.all([
      getCustomer(id), getCommunications(id), listMedia(id), listCustomerMemberships(id), listCustomerPackages(id),
      getRelationshipTimeline(id), getReferrals(id),
    ]);
    if (detail.ok) setData(detail.data);
    if (commResult.ok) setComms(commResult.data.data);
    if (mediaResult.ok) setMedia(mediaResult.data.data);
    if (membershipResult.ok) setMemberships(membershipResult.data.data);
    if (packageResult.ok) setCustomerPackages(packageResult.data.data);
    if (timelineResult.ok) setTimeline(timelineResult.data.data);
    if (referralsResult.ok) { setReferredByState(referralsResult.data.referred_by); setReferred(referralsResult.data.referred); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listStaff().then(r => { if (r.ok) setStaff(r.data.data.filter(s => s.active)); }); }, []);
  useEffect(() => { listMembershipPlans().then(r => { if (r.ok) setMembershipPlans(r.data.data.filter(p => p.active)); }); }, []);
  useEffect(() => { listServicePackages().then(r => { if (r.ok) setAvailablePackages(r.data.data.filter(p => p.active)); }); }, []);
  useEffect(() => { listAllTags().then(r => { if (r.ok) setTagsCatalog(r.data.data); }); }, []);

  async function handleAddTag(tag: string) {
    if (!id || !data || !tag.trim()) return;
    const next = Array.from(new Set([...(data.customer.tags ?? []), tag.trim()]));
    const result = await updateCustomer(id, { tags: next });
    if (result.ok) { setNewTagText(''); setAddingTag(false); load(); }
    else Alert.alert(t('owner:customerDetail.couldNotAddTagTitle'), result.error);
  }

  async function handleRemoveTag(tag: string) {
    if (!id || !data) return;
    const next = (data.customer.tags ?? []).filter(t => t !== tag);
    const result = await updateCustomer(id, { tags: next });
    if (result.ok) load();
    else Alert.alert(t('owner:customerDetail.couldNotRemoveTagTitle'), result.error);
  }

  async function handleSearchReferrer(q: string) {
    setReferrerQuery(q);
    if (!q.trim()) { setReferrerResults([]); return; }
    const result = await searchCustomers(q.trim());
    if (result.ok) setReferrerResults(result.data.data.filter(c => c.id !== id));
  }

  async function handleSetReferrer(referrerCustomerId: string) {
    if (!id) return;
    const result = await setReferredBy(id, referrerCustomerId);
    if (result.ok) { setPickingReferrer(false); setReferrerQuery(''); setReferrerResults([]); load(); }
    else Alert.alert(t('owner:customerDetail.couldNotSaveTitle'), result.error);
  }

  async function handleGrantReward(referralId: string) {
    Alert.alert(t('owner:customerDetail.grantReferralRewardTitle'), t('owner:customerDetail.grantReferralRewardMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('owner:customerDetail.grant15Off'),
        onPress: async () => {
          const result = await grantReferralReward(id!, referralId, 'percent', 15);
          if (result.ok) load();
          else Alert.alert(t('owner:customerDetail.couldNotGrantRewardTitle'), result.error);
        },
      },
    ]);
  }

  async function handlePurchaseMembership(planId: string) {
    if (!id) return;
    const result = await purchaseMembership(id, planId);
    if (!result.ok) { Alert.alert(t('owner:customerDetail.couldNotPurchaseTitle'), result.error); return; }
    if (result.data.activated) {
      Alert.alert(t('owner:customerDetail.membershipActivatedTitle'));
      load();
    } else if (result.data.checkout_url) {
      Alert.alert(
        t('owner:customerDetail.sendCheckoutLinkTitle'),
        t('owner:customerDetail.sendCheckoutLinkMessage'),
        [
          { text: t('owner:customerDetail.notNow'), style: 'cancel' },
          { text: t('owner:customerDetail.open'), onPress: () => Linking.openURL(result.data.checkout_url!) },
        ]
      );
    }
  }

  async function handleRenewMembership(membershipId: string) {
    if (!id) return;
    const result = await renewMembership(id, membershipId);
    if (result.ok) load();
    else Alert.alert(t('owner:customerDetail.couldNotRenewTitle'), result.error);
  }

  async function handleCancelMembership(membershipId: string) {
    if (!id) return;
    Alert.alert(t('owner:customerDetail.cancelMembershipTitle'), t('owner:customerDetail.cannotBeUndone'), [
      { text: t('owner:customerDetail.keepIt'), style: 'cancel' },
      {
        text: t('owner:customerDetail.cancelMembershipButton'), style: 'destructive',
        onPress: async () => {
          const result = await cancelMembership(id, membershipId);
          if (result.ok) load();
          else Alert.alert(t('owner:customerDetail.couldNotCancelTitle'), result.error);
        },
      },
    ]);
  }

  async function handlePurchasePackage(packageId: string) {
    if (!id) return;
    const result = await purchaseServicePackage(id, packageId);
    if (result.ok) { Alert.alert(t('owner:customerDetail.packageGrantedTitle')); load(); }
    else Alert.alert(t('owner:customerDetail.couldNotGrantPackageTitle'), result.error);
  }

  async function handleRedeemVisit(purchaseId: string) {
    if (!id) return;
    const result = await redeemPackageVisit(id, purchaseId);
    if (result.ok) load();
    else Alert.alert(t('owner:customerDetail.couldNotRedeemTitle'), result.error);
  }

  async function handleSetPreferredStaff(staffId: string | null) {
    if (!id) return;
    setPickingStaff(false);
    const result = await updateCustomer(id, { preferred_staff_id: staffId });
    if (result.ok) load();
    else Alert.alert(t('owner:customerDetail.couldNotUpdateTitle'), result.error);
  }

  async function handleAddNote() {
    if (!id || !newNote.trim()) return;
    const result = await addNote(id, newNote.trim());
    if (result.ok) { setNewNote(''); load(); }
    else Alert.alert(t('owner:customerDetail.couldNotAddNoteTitle'), result.error);
  }

  async function handlePin(noteId: string, pinned: boolean) {
    if (!id) return;
    await pinNote(id, noteId, !pinned);
    load();
  }

  async function handleDeleteNote(noteId: string) {
    if (!id) return;
    await deleteNote(id, noteId);
    load();
  }

  async function handleTogglePriority() {
    if (!id || !data) return;
    const result = await updateCustomer(id, { priority: !data.customer.priority });
    if (result.ok) load();
  }

  async function handleDelete() {
    if (!id) return;
    Alert.alert(t('owner:customerDetail.deleteCustomerTitle'), t('owner:customerDetail.deleteCustomerMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('owner:customerDetail.delete'), style: 'destructive', onPress: async () => {
        const result = await deleteCustomer(id);
        if (result.ok) router.back();
        else Alert.alert(t('owner:customerDetail.couldNotDeleteTitle'), result.error);
      }},
    ]);
  }

  async function pickAndUpload(kind: 'photo' | 'document') {
    if (!id) return;
    let uri: string, fileName: string;

    if (kind === 'photo') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('owner:customerDetail.permissionNeededTitle'), t('owner:customerDetail.photoPermissionMessage')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      uri = result.assets[0].uri;
      fileName = uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;
      uri = result.assets[0].uri;
      fileName = result.assets[0].name;
    }

    const req = await requestMediaUpload(id, kind, fileName);
    if (!req.ok) { Alert.alert(t('owner:customerDetail.couldNotStartUploadTitle'), req.error); return; }

    try {
      const blob = await (await fetch(uri)).blob();
      const { error } = await supabase.storage.from('customer-media').uploadToSignedUrl(req.data.data.path, req.data.data.token, blob);
      if (error) throw error;
      load();
    } catch (e) {
      await deleteMedia(id, req.data.data.id);
      Alert.alert(t('owner:customerDetail.uploadFailedTitle'), t('owner:customerDetail.uploadFailedMessage'));
    }
  }

  async function handleRemoveMedia(mediaId: string) {
    if (!id) return;
    const result = await deleteMedia(id, mediaId);
    if (result.ok) setMedia(m => m.filter(x => x.id !== mediaId));
  }

  function openAppointment(b: import('@/lib/api/ownerCustomers').CustomerBookingRow) {
    if (!data) return;
    setSelectedBooking({
      ...b,
      customer: { id: data.customer.id, name: data.customer.name, email: data.customer.email, phone: data.customer.phone },
    });
    sheetRef.current?.present();
  }

  function focusNotes() {
    scrollRef.current?.scrollTo({ y: notesSectionY, animated: true });
    setTimeout(() => noteInputRef.current?.focus(), 300);
  }

  if (loading || !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: t('owner:customerDetail.headerTitleFallback') }} />
        <BreathingHeart size={40} color={'#F4D77A'} />
      </View>
    );
  }

  const { customer, health, insights, snapshot, upcoming, past, notes, rewards } = data;
  const spendingPoints = [...past].reverse()
    .filter(b => b.status === 'completed')
    .map(b => b.total_charged_cents ?? b.price_cents ?? 0);

  const healthColor = health.score >= 75 ? '#8FE3A6' : health.score >= 45 ? '#F5B95C' : '#F09595';

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: customer.name, headerBackTitle: t('owner:customerDetail.headerBackTitle') }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer.name}</Text>
            <View style={styles.badgeRow}>
              {(customer.total_bookings ?? 0) >= 5 && <Badge label={t('owner:customerDetail.vip')} color={'#F4D77A'} />}
              {customer.blocked && <Badge label={t('owner:customerDetail.blocked')} color={'#F09595'} />}
              <TouchableOpacity onPress={handleTogglePriority}>
                <Badge label={customer.priority ? t('owner:customerDetail.priority') : t('owner:customerDetail.addPriority')} color={customer.priority ? '#F4D77A' : 'rgba(255,255,255,0.35)'} />
              </TouchableOpacity>
            </View>
            <View style={styles.tagRow}>
              {(customer.tags ?? []).map(tag => (
                <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => handleRemoveTag(tag)}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={12} color={'#F4D77A'} />
                </TouchableOpacity>
              ))}
              {addingTag ? (
                <TextInput
                  style={styles.tagInput}
                  placeholder={t('owner:customerDetail.newTagPlaceholder')}
                  placeholderTextColor={'rgba(255,255,255,0.35)'}
                  value={newTagText}
                  onChangeText={setNewTagText}
                  onSubmitEditing={() => handleAddTag(newTagText)}
                  autoFocus
                />
              ) : (
                <TouchableOpacity style={styles.tagAddChip} onPress={() => setAddingTag(true)}>
                  <Ionicons name="add" size={13} color={'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              )}
            </View>
            {addingTag && tagsCatalog.filter(t => !(customer.tags ?? []).includes(t)).length > 0 && (
              <View style={styles.tagSuggestRow}>
                {tagsCatalog.filter(t => !(customer.tags ?? []).includes(t)).slice(0, 6).map(t => (
                  <TouchableOpacity key={t} style={styles.tagSuggestChip} onPress={() => handleAddTag(t)}>
                    <Text style={styles.tagSuggestText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => setHealthExpanded(v => !v)} style={[styles.healthPill, { borderColor: healthColor }]}>
            <Text style={[styles.healthScore, { color: healthColor }]}>{health.score}</Text>
            <Text style={styles.healthLabel}>{health.label}</Text>
          </TouchableOpacity>
        </View>
        {healthExpanded && (
          <View style={styles.healthReasons}>
            {health.reasons.map((r, i) => <Text key={i} style={styles.healthReasonText}>• {r}</Text>)}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction
            icon="calendar-outline"
            label={t('owner:customerDetail.book')}
            onPress={() => router.push({
              pathname: '/(owner)/calendar',
              params: {
                bookCustomerId: customer.id,
                bookCustomerName: customer.name,
                bookCustomerPhone: customer.phone ?? '',
                bookCustomerEmail: customer.email ?? '',
              },
            } as never)}
          />
          <QuickAction icon="call-outline" label={t('owner:customerDetail.call')} onPress={() => customer.phone && Linking.openURL(`tel:${customer.phone}`)} disabled={!customer.phone} />
          <QuickAction icon="chatbubble-outline" label={t('owner:customerDetail.message')} onPress={() => customer.phone && Linking.openURL(`sms:${customer.phone}`)} disabled={!customer.phone} />
          <QuickAction icon="create-outline" label={t('owner:customerDetail.notes')} onPress={focusNotes} />
          <QuickAction icon="ellipsis-horizontal" label={t('owner:customerDetail.more')} onPress={handleDelete} />
        </View>

        {/* AI Insights */}
        {insights.length > 0 && (
          <View style={styles.insightsCard}>
            {insights.map((ins, i) => <Text key={i} style={styles.insightText}>{ins}</Text>)}
          </View>
        )}

        {/* Snapshot */}
        <Section title={t('owner:customerDetail.snapshot')}>
          <View style={styles.snapshotGrid}>
            <SnapshotStat label={t('owner:customerDetail.lifetimeSpend')} value={money(snapshot.lifetime_spend_cents)} />
            <SnapshotStat label={t('owner:customerDetail.visits')} value={String(snapshot.visits)} />
            <SnapshotStat label={t('owner:customerDetail.avgTicket')} value={money(snapshot.average_ticket_cents)} />
            <SnapshotStat label={t('owner:customerDetail.avgTip')} value={money(snapshot.average_tip_cents)} />
            <SnapshotStat label={t('owner:customerDetail.lastVisit')} value={timeAgo(snapshot.last_visit)} />
            <SnapshotStat label={t('owner:customerDetail.yearsAsCustomer')} value={`${snapshot.years_as_customer}`} />
            <SnapshotStat label={t('owner:customerDetail.cancellationRate')} value={`${Math.round(snapshot.cancellation_rate * 100)}%`} />
            <SnapshotStat label={t('owner:customerDetail.noShowRate')} value={`${Math.round(snapshot.no_show_rate * 100)}%`} />
          </View>
          <TouchableOpacity style={styles.preferredStaffRow} onPress={() => setPickingStaff(true)}>
            <Text style={styles.preferredStaffLabel}>{t('owner:customerDetail.preferredStaff')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.preferredStaffValue}>{customer.preferred_staff?.name ?? t('owner:customerDetail.notSet')}</Text>
              <Ionicons name="chevron-forward" size={14} color={'rgba(255,255,255,0.35)'} />
            </View>
          </TouchableOpacity>
          {pickingStaff && (
            <View style={styles.staffPicker}>
              <TouchableOpacity style={styles.staffPickerRow} onPress={() => handleSetPreferredStaff(null)}>
                <Text style={styles.staffPickerText}>{t('owner:customerDetail.noPreference')}</Text>
              </TouchableOpacity>
              {staff.map(s => (
                <TouchableOpacity key={s.id} style={styles.staffPickerRow} onPress={() => handleSetPreferredStaff(s.id)}>
                  <Text style={styles.staffPickerText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <Section title={t('owner:customerDetail.upcomingAppointment')}>
            {upcoming.slice(0, 1).map(b => (
              <TouchableOpacity key={b.id} style={styles.card} onPress={() => openAppointment(b)}>
                <Text style={styles.cardTitle}>{formatWeekdayMonthDay(new Date(b.starts_at))}</Text>
                <Text style={styles.cardMeta}>{b.service?.name ?? t('common:serviceFallback')}{b.staff?.name ? ` · ${b.staff.name}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Service Timeline */}
        <Section title={t('owner:customerDetail.serviceTimeline')}>
          {past.length === 0 ? <Text style={styles.emptyHint}>{t('owner:customerDetail.noPastVisits')}</Text> : (
            <View style={styles.timeline}>
              {past.slice(0, 10).map(b => (
                <View key={b.id} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineService}>{b.service?.name ?? t('common:serviceFallback')}</Text>
                    <Text style={styles.timelineDate}>{formatMonthDayYear(new Date(b.starts_at))}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Spending Timeline */}
        <Section title={t('owner:customerDetail.spendingTimeline')}>
          <View style={styles.chartCard}>
            <SpendingSparkline points={spendingPoints} width={300} height={70} />
          </View>
        </Section>

        {/* Membership */}
        <Section title={t('owner:customerDetail.membership')}>
          {memberships.filter(m => m.status !== 'cancelled' && m.status !== 'expired').length === 0 ? (
            <Text style={styles.emptyHint}>{t('owner:customerDetail.noActiveMembership')}</Text>
          ) : memberships.filter(m => m.status !== 'cancelled' && m.status !== 'expired').map(m => (
            <View key={m.id} style={styles.membershipCard}>
              <Text style={styles.membershipName}>{m.membership_plans?.name ?? t('owner:customerDetail.membershipFallback')}</Text>
              <Text style={styles.membershipMeta}>
                {m.status === 'active' ? t('owner:customerDetail.active') : t('owner:customerDetail.pastDue')} · {t('owner:customerDetail.renewsOn', { date: formatMonthDay(new Date(m.current_period_end)) })}
              </Text>
              <View style={styles.membershipActions}>
                {m.membership_plans?.billing_mode === 'manual' && (
                  <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleRenewMembership(m.id)}>
                    <Text style={styles.smallActionBtnText}>{t('owner:customerDetail.renew')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.smallActionBtnDanger} onPress={() => handleCancelMembership(m.id)}>
                  <Text style={styles.smallActionBtnDangerText}>{t('common:cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {membershipPlans.length > 0 && (
            <View style={styles.chipRow}>
              {membershipPlans.map(p => (
                <TouchableOpacity key={p.id} style={styles.addChip} onPress={() => handlePurchaseMembership(p.id)}>
                  <Ionicons name="add" size={14} color={'#F4D77A'} />
                  <Text style={styles.addChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Packages */}
        <Section title={t('owner:customerDetail.packages')}>
          {customerPackages.filter(p => p.visits_remaining > 0).length === 0 ? (
            <Text style={styles.emptyHint}>{t('owner:customerDetail.noActivePackages')}</Text>
          ) : customerPackages.filter(p => p.visits_remaining > 0).map(p => (
            <View key={p.id} style={styles.membershipCard}>
              <Text style={styles.membershipName}>{p.service_packages?.name ?? t('owner:customerDetail.packageFallback')}</Text>
              <Text style={styles.membershipMeta}>{t('owner:customerDetail.visitsRemaining', { count: p.visits_remaining })}</Text>
              <View style={styles.membershipActions}>
                <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleRedeemVisit(p.id)}>
                  <Text style={styles.smallActionBtnText}>{t('owner:customerDetail.redeemVisit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {availablePackages.length > 0 && (
            <View style={styles.chipRow}>
              {availablePackages.map(p => (
                <TouchableOpacity key={p.id} style={styles.addChip} onPress={() => handlePurchasePackage(p.id)}>
                  <Ionicons name="add" size={14} color={'#F4D77A'} />
                  <Text style={styles.addChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Rewards */}
        <Section title={t('owner:customerDetail.rewards')}>
          {rewards.length === 0 ? <Text style={styles.emptyHint}>{t('owner:customerDetail.noActiveRewards')}</Text> : rewards.map(r => (
            <View key={r.id} style={styles.rewardRow}>
              <Text style={styles.rewardCode}>{r.code}</Text>
              <Text style={styles.rewardMeta}>{r.type === 'percent' ? t('owner:customerDetail.percentOff', { value: r.value }) : money(r.value * 100)}{r.active ? '' : t('owner:customerDetail.usedSuffix')}</Text>
            </View>
          ))}
        </Section>

        {/* Notes */}
        <View onLayout={(e) => setNotesSectionY(e.nativeEvent.layout.y)}>
        <Section title={t('owner:customerDetail.notes')}>
          {notes.map(n => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteDate}>{formatMonthDay(new Date(n.created_at))}</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity onPress={() => handlePin(n.id, n.pinned)}>
                    <Ionicons name={n.pinned ? 'pin' : 'pin-outline'} size={15} color={n.pinned ? '#F4D77A' : 'rgba(255,255,255,0.6)'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
                    <Ionicons name="trash-outline" size={15} color={'#F09595'} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.noteBody}>{n.body}</Text>
            </View>
          ))}
          <View style={styles.addNoteRow}>
            <TextInput
              ref={noteInputRef}
              style={styles.noteInput}
              placeholder={t('owner:customerDetail.addNotePlaceholder')}
              placeholderTextColor={'rgba(255,255,255,0.35)'}
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <TouchableOpacity onPress={handleAddNote}><Text style={styles.addRowText}>{t('owner:customerDetail.save')}</Text></TouchableOpacity>
          </View>
        </Section>
        </View>

        {/* Photos */}
        <Section title={t('owner:customerDetail.photos')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {media.filter(m => m.kind === 'photo').map(m => (
              <TouchableOpacity key={m.id} onLongPress={() => handleRemoveMedia(m.id)} style={styles.photoThumb}>
                {m.url && <Image source={{ uri: m.url }} style={styles.photoImage} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPhotoButton} onPress={() => pickAndUpload('photo')}>
              <Ionicons name="camera-outline" size={22} color={'#F4D77A'} />
            </TouchableOpacity>
          </ScrollView>
        </Section>

        {/* Documents */}
        <Section title={t('owner:customerDetail.documents')}>
          {media.filter(m => m.kind === 'document').map(m => (
            <View key={m.id} style={styles.docRow}>
              <Text style={styles.docName}>{m.label ?? m.storage_path.split('/').pop()}</Text>
              <TouchableOpacity onPress={() => handleRemoveMedia(m.id)}>
                <Ionicons name="trash-outline" size={16} color={'#F09595'} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRow} onPress={() => pickAndUpload('document')}>
            <Ionicons name="add" size={18} color={'#F4D77A'} />
            <Text style={styles.addRowText}>{t('owner:customerDetail.addDocument')}</Text>
          </TouchableOpacity>
        </Section>

        {/* Communication timeline */}
        <Section title={t('owner:customerDetail.communication')}>
          {comms.length === 0 ? <Text style={styles.emptyHint}>{t('owner:customerDetail.nothingLoggedYet')}</Text> : comms.slice(0, 20).map(c => (
            <View key={c.id} style={styles.commRow}>
              <Ionicons
                name={c.channel === 'call' ? 'call-outline' : c.channel === 'push' ? 'notifications-outline' : c.channel === 'sms' ? 'chatbubble-outline' : 'mail-outline'}
                size={15} color={'rgba(255,255,255,0.6)'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.commSummary}>{c.summary}</Text>
                <Text style={styles.commDate}>{timeAgo(c.at)}</Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Referrals */}
        <Section title={t('owner:customerDetail.referrals')}>
          <Text style={styles.fieldLabel}>{t('owner:customerDetail.referredBy')}</Text>
          {referredBy ? (
            <Text style={styles.timelineService}>{referredBy.referrer?.name ?? t('owner:customerDetail.unknown')}</Text>
          ) : pickingReferrer ? (
            <View>
              <TextInput
                style={styles.tagInput}
                placeholder={t('owner:customerDetail.searchCustomersPlaceholder')}
                placeholderTextColor={'rgba(255,255,255,0.35)'}
                value={referrerQuery}
                onChangeText={handleSearchReferrer}
                autoFocus
              />
              {referrerResults.map(c => (
                <TouchableOpacity key={c.id} style={styles.referrerResultRow} onPress={() => handleSetReferrer(c.id)}>
                  <Text style={styles.timelineService}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setPickingReferrer(true)}>
              <Ionicons name="add" size={16} color={'#F4D77A'} />
              <Text style={styles.addRowText}>{t('owner:customerDetail.setReferrer')}</Text>
            </TouchableOpacity>
          )}

          {referred.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>{t('owner:customerDetail.referredByThisCustomer')}</Text>
              {referred.map(r => (
                <View key={r.id} style={styles.membershipCard}>
                  <Text style={styles.membershipName}>{r.referred?.name ?? t('owner:customerDetail.customerFallback')}</Text>
                  <Text style={styles.membershipMeta}>
                    {r.reward_status === 'granted' ? t('owner:customerDetail.rewardGranted') : r.reward_status === 'pending' ? t('owner:customerDetail.rewardPending') : t('owner:customerDetail.noRewardYet')}
                  </Text>
                  {r.reward_status !== 'granted' && (
                    <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleGrantReward(r.id)}>
                      <Text style={styles.smallActionBtnText}>{t('owner:customerDetail.grantReward')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}
        </Section>

        {/* Relationship Timeline */}
        <Section title={t('owner:customerDetail.relationshipTimeline')}>
          {timeline.length === 0 ? <Text style={styles.emptyHint}>{t('owner:customerDetail.noHistoryYet')}</Text> : (
            <View style={styles.timeline}>
              {timeline.map((e, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineService}>{e.label}</Text>
                    <Text style={styles.timelineDate}>{formatMonthDayYear(new Date(e.at))}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>

      <AppointmentSheet
        ref={sheetRef}
        booking={selectedBooking}
        onChanged={() => { sheetRef.current?.dismiss(); load(); }}
        onReadyForCheckout={() => checkoutRef.current?.present()}
      />
      <CheckoutSheet
        ref={checkoutRef}
        booking={selectedBooking}
        onDone={() => { checkoutRef.current?.dismiss(); sheetRef.current?.dismiss(); load(); }}
        onChanged={load}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}><Text style={styles.badgeText}>{label}</Text></View>
  );
}

function QuickAction({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={disabled ? 'rgba(255,255,255,0.35)' : '#F4D77A'} />
      <Text style={[styles.quickActionLabel, disabled && { color: 'rgba(255,255,255,0.35)' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapshotStat}>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={styles.snapshotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  healthPill: { alignItems: 'center', borderWidth: 2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  healthScore: { fontSize: 20, fontWeight: '800' },
  healthLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  healthReasons: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  healthReasonText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  quickAction: { alignItems: 'center', gap: 4, flex: 1 },
  quickActionLabel: { fontSize: 11, color: '#F4D77A', fontWeight: '600' },
  insightsCard: { backgroundColor: 'rgba(244,215,122,0.1)', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  insightText: { fontSize: 13, color: '#FFFFFF' },
  section: { gap: Spacing.xs },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  snapshotStat: { width: '47%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  snapshotValue: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  snapshotLabel: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  preferredStaffRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  preferredStaffLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  preferredStaffValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  staffPicker: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  staffPickerRow: { padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.25)' },
  staffPickerText: { fontSize: 14, color: '#FFFFFF' },
  card: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cardMeta: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  emptyHint: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)' },
  timeline: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4D77A', marginTop: 5 },
  timelineService: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  timelineDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  chartCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  rewardCode: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  rewardMeta: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  membershipCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.xs, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  membershipName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  membershipMeta: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  membershipActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  smallActionBtn: { backgroundColor: 'rgba(244,215,122,0.1)', borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  smallActionBtnText: { fontSize: 12.5, fontWeight: '600', color: '#F4D77A' },
  smallActionBtnDanger: { backgroundColor: 'rgba(240,149,149,0.12)', borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  smallActionBtnDangerText: { fontSize: 12.5, fontWeight: '600', color: '#F09595' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#F4D77A', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 12.5, fontWeight: '600', color: '#F4D77A' },
  noteCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  noteDate: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  noteBody: { fontSize: 13.5, color: '#FFFFFF' },
  addNoteRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  noteInput: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: 14, color: '#FFFFFF', minHeight: 40 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: '#F4D77A', fontWeight: '600' },
  fieldLabel: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(244,215,122,0.1)', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontWeight: '600', color: '#F4D77A' },
  tagAddChip: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  tagInput: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: 13, color: '#FFFFFF', minWidth: 100,
  },
  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagSuggestChip: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  tagSuggestText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  referrerResultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.25)' },
  photoThumb: { width: 64, height: 64, borderRadius: BorderRadius.sm, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  addPhotoButton: { width: 64, height: 64, borderRadius: BorderRadius.sm, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderStyle: 'dashed' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.25)' },
  docName: { fontSize: 13.5, color: '#FFFFFF' },
  commRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 6, alignItems: 'flex-start' },
  commSummary: { fontSize: 13.5, color: '#FFFFFF' },
  commDate: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)' },
});
