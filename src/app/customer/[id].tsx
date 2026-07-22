import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, Image, useWindowDimensions } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
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
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default function CustomerDetailScreen() {
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
    const next = Array.from(new Set([...data.customer.tags, tag.trim()]));
    const result = await updateCustomer(id, { tags: next });
    if (result.ok) { setNewTagText(''); setAddingTag(false); load(); }
    else Alert.alert('Could not add tag', result.error);
  }

  async function handleRemoveTag(tag: string) {
    if (!id || !data) return;
    const next = data.customer.tags.filter(t => t !== tag);
    const result = await updateCustomer(id, { tags: next });
    if (result.ok) load();
    else Alert.alert('Could not remove tag', result.error);
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
    else Alert.alert('Could not save', result.error);
  }

  async function handleGrantReward(referralId: string) {
    Alert.alert('Grant referral reward', 'Give the referrer 15% off their next visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Grant 15% off',
        onPress: async () => {
          const result = await grantReferralReward(id!, referralId, 'percent', 15);
          if (result.ok) load();
          else Alert.alert('Could not grant reward', result.error);
        },
      },
    ]);
  }

  async function handlePurchaseMembership(planId: string) {
    if (!id) return;
    const result = await purchaseMembership(id, planId);
    if (!result.ok) { Alert.alert('Could not purchase', result.error); return; }
    if (result.data.activated) {
      Alert.alert('Membership activated');
      load();
    } else if (result.data.checkout_url) {
      Alert.alert(
        'Send checkout link',
        'The customer completes payment on their own device. Open the link now to share it?',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open', onPress: () => Linking.openURL(result.data.checkout_url!) },
        ]
      );
    }
  }

  async function handleRenewMembership(membershipId: string) {
    if (!id) return;
    const result = await renewMembership(id, membershipId);
    if (result.ok) load();
    else Alert.alert('Could not renew', result.error);
  }

  async function handleCancelMembership(membershipId: string) {
    if (!id) return;
    Alert.alert('Cancel membership?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Membership', style: 'destructive',
        onPress: async () => {
          const result = await cancelMembership(id, membershipId);
          if (result.ok) load();
          else Alert.alert('Could not cancel', result.error);
        },
      },
    ]);
  }

  async function handlePurchasePackage(packageId: string) {
    if (!id) return;
    const result = await purchaseServicePackage(id, packageId);
    if (result.ok) { Alert.alert('Package granted'); load(); }
    else Alert.alert('Could not grant package', result.error);
  }

  async function handleRedeemVisit(purchaseId: string) {
    if (!id) return;
    const result = await redeemPackageVisit(id, purchaseId);
    if (result.ok) load();
    else Alert.alert('Could not redeem', result.error);
  }

  async function handleSetPreferredStaff(staffId: string | null) {
    if (!id) return;
    setPickingStaff(false);
    const result = await updateCustomer(id, { preferred_staff_id: staffId });
    if (result.ok) load();
    else Alert.alert('Could not update', result.error);
  }

  async function handleAddNote() {
    if (!id || !newNote.trim()) return;
    const result = await addNote(id, newNote.trim());
    if (result.ok) { setNewNote(''); load(); }
    else Alert.alert('Could not add note', result.error);
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
    Alert.alert('Delete customer?', 'Bookings stay on record but unlinked. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const result = await deleteCustomer(id);
        if (result.ok) router.back();
        else Alert.alert('Could not delete', result.error);
      }},
    ]);
  }

  async function pickAndUpload(kind: 'photo' | 'document') {
    if (!id) return;
    let uri: string, fileName: string;

    if (kind === 'photo') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
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
    if (!req.ok) { Alert.alert('Could not start upload', req.error); return; }

    try {
      const blob = await (await fetch(uri)).blob();
      const { error } = await supabase.storage.from('customer-media').uploadToSignedUrl(req.data.data.path, req.data.data.token, blob);
      if (error) throw error;
      load();
    } catch (e) {
      await deleteMedia(id, req.data.data.id);
      Alert.alert('Upload failed', 'Please try again.');
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
        <Stack.Screen options={{ title: 'Customer' }} />
        <BreathingHeart size={40} color={Colors.primary} />
      </View>
    );
  }

  const { customer, health, insights, snapshot, upcoming, past, notes, rewards } = data;
  const spendingPoints = [...past].reverse()
    .filter(b => b.status === 'completed')
    .map(b => b.total_charged_cents ?? b.price_cents ?? 0);

  const healthColor = health.score >= 75 ? Colors.success : health.score >= 45 ? Colors.warning : Colors.error;

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ title: customer.name, headerBackTitle: 'Customers' }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer.name}</Text>
            <View style={styles.badgeRow}>
              {(customer.total_bookings ?? 0) >= 5 && <Badge label="VIP" color={Colors.gold} />}
              {customer.blocked && <Badge label="Blocked" color={Colors.error} />}
              <TouchableOpacity onPress={handleTogglePriority}>
                <Badge label={customer.priority ? '★ Priority' : '+ Priority'} color={customer.priority ? Colors.gold : Colors.textDisabled} />
              </TouchableOpacity>
            </View>
            <View style={styles.tagRow}>
              {customer.tags.map(tag => (
                <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => handleRemoveTag(tag)}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={12} color={Colors.primary} />
                </TouchableOpacity>
              ))}
              {addingTag ? (
                <TextInput
                  style={styles.tagInput}
                  placeholder="New tag"
                  placeholderTextColor={Colors.textDisabled}
                  value={newTagText}
                  onChangeText={setNewTagText}
                  onSubmitEditing={() => handleAddTag(newTagText)}
                  autoFocus
                />
              ) : (
                <TouchableOpacity style={styles.tagAddChip} onPress={() => setAddingTag(true)}>
                  <Ionicons name="add" size={13} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {addingTag && tagsCatalog.filter(t => !customer.tags.includes(t)).length > 0 && (
              <View style={styles.tagSuggestRow}>
                {tagsCatalog.filter(t => !customer.tags.includes(t)).slice(0, 6).map(t => (
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
          <QuickAction icon="calendar-outline" label="Book" onPress={() => router.push('/(owner)/calendar' as never)} />
          <QuickAction icon="call-outline" label="Call" onPress={() => customer.phone && Linking.openURL(`tel:${customer.phone}`)} disabled={!customer.phone} />
          <QuickAction icon="chatbubble-outline" label="Message" onPress={() => customer.phone && Linking.openURL(`sms:${customer.phone}`)} disabled={!customer.phone} />
          <QuickAction icon="create-outline" label="Notes" onPress={focusNotes} />
          <QuickAction icon="ellipsis-horizontal" label="More" onPress={handleDelete} />
        </View>

        {/* AI Insights */}
        {insights.length > 0 && (
          <View style={styles.insightsCard}>
            {insights.map((ins, i) => <Text key={i} style={styles.insightText}>{ins}</Text>)}
          </View>
        )}

        {/* Snapshot */}
        <Section title="Snapshot">
          <View style={styles.snapshotGrid}>
            <SnapshotStat label="Lifetime Spend" value={money(snapshot.lifetime_spend_cents)} />
            <SnapshotStat label="Visits" value={String(snapshot.visits)} />
            <SnapshotStat label="Avg Ticket" value={money(snapshot.average_ticket_cents)} />
            <SnapshotStat label="Avg Tip" value={money(snapshot.average_tip_cents)} />
            <SnapshotStat label="Last Visit" value={timeAgo(snapshot.last_visit)} />
            <SnapshotStat label="Years as Customer" value={`${snapshot.years_as_customer}`} />
            <SnapshotStat label="Cancellation %" value={`${Math.round(snapshot.cancellation_rate * 100)}%`} />
            <SnapshotStat label="No-Show %" value={`${Math.round(snapshot.no_show_rate * 100)}%`} />
          </View>
          <TouchableOpacity style={styles.preferredStaffRow} onPress={() => setPickingStaff(true)}>
            <Text style={styles.preferredStaffLabel}>Preferred Staff</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.preferredStaffValue}>{customer.preferred_staff?.name ?? 'Not set'}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textDisabled} />
            </View>
          </TouchableOpacity>
          {pickingStaff && (
            <View style={styles.staffPicker}>
              <TouchableOpacity style={styles.staffPickerRow} onPress={() => handleSetPreferredStaff(null)}>
                <Text style={styles.staffPickerText}>No preference</Text>
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
          <Section title="Upcoming Appointment">
            {upcoming.slice(0, 1).map(b => (
              <TouchableOpacity key={b.id} style={styles.card} onPress={() => openAppointment(b)}>
                <Text style={styles.cardTitle}>{new Date(b.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                <Text style={styles.cardMeta}>{b.service?.name ?? 'Service'}{b.staff?.name ? ` · ${b.staff.name}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Service Timeline */}
        <Section title="Service Timeline">
          {past.length === 0 ? <Text style={styles.emptyHint}>No past visits yet.</Text> : (
            <View style={styles.timeline}>
              {past.slice(0, 10).map(b => (
                <View key={b.id} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineService}>{b.service?.name ?? 'Service'}</Text>
                    <Text style={styles.timelineDate}>{new Date(b.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Spending Timeline */}
        <Section title="Spending Timeline">
          <View style={styles.chartCard}>
            <SpendingSparkline points={spendingPoints} width={300} height={70} />
          </View>
        </Section>

        {/* Membership */}
        <Section title="Membership">
          {memberships.filter(m => m.status !== 'cancelled' && m.status !== 'expired').length === 0 ? (
            <Text style={styles.emptyHint}>No active membership.</Text>
          ) : memberships.filter(m => m.status !== 'cancelled' && m.status !== 'expired').map(m => (
            <View key={m.id} style={styles.membershipCard}>
              <Text style={styles.membershipName}>{m.membership_plans?.name ?? 'Membership'}</Text>
              <Text style={styles.membershipMeta}>
                {m.status === 'active' ? 'Active' : 'Past due'} · renews {new Date(m.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <View style={styles.membershipActions}>
                {m.membership_plans?.billing_mode === 'manual' && (
                  <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleRenewMembership(m.id)}>
                    <Text style={styles.smallActionBtnText}>Renew</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.smallActionBtnDanger} onPress={() => handleCancelMembership(m.id)}>
                  <Text style={styles.smallActionBtnDangerText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {membershipPlans.length > 0 && (
            <View style={styles.chipRow}>
              {membershipPlans.map(p => (
                <TouchableOpacity key={p.id} style={styles.addChip} onPress={() => handlePurchaseMembership(p.id)}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <Text style={styles.addChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Packages */}
        <Section title="Packages">
          {customerPackages.filter(p => p.visits_remaining > 0).length === 0 ? (
            <Text style={styles.emptyHint}>No active packages.</Text>
          ) : customerPackages.filter(p => p.visits_remaining > 0).map(p => (
            <View key={p.id} style={styles.membershipCard}>
              <Text style={styles.membershipName}>{p.service_packages?.name ?? 'Package'}</Text>
              <Text style={styles.membershipMeta}>{p.visits_remaining} visit{p.visits_remaining === 1 ? '' : 's'} remaining</Text>
              <View style={styles.membershipActions}>
                <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleRedeemVisit(p.id)}>
                  <Text style={styles.smallActionBtnText}>Redeem a visit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {availablePackages.length > 0 && (
            <View style={styles.chipRow}>
              {availablePackages.map(p => (
                <TouchableOpacity key={p.id} style={styles.addChip} onPress={() => handlePurchasePackage(p.id)}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <Text style={styles.addChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Rewards */}
        <Section title="Rewards">
          {rewards.length === 0 ? <Text style={styles.emptyHint}>No active rewards.</Text> : rewards.map(r => (
            <View key={r.id} style={styles.rewardRow}>
              <Text style={styles.rewardCode}>{r.code}</Text>
              <Text style={styles.rewardMeta}>{r.type === 'percent' ? `${r.value}% off` : money(r.value * 100)}{r.active ? '' : ' · used'}</Text>
            </View>
          ))}
        </Section>

        {/* Notes */}
        <View onLayout={(e) => setNotesSectionY(e.nativeEvent.layout.y)}>
        <Section title="Notes">
          {notes.map(n => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteDate}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity onPress={() => handlePin(n.id, n.pinned)}>
                    <Ionicons name={n.pinned ? 'pin' : 'pin-outline'} size={15} color={n.pinned ? Colors.primary : Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
                    <Ionicons name="trash-outline" size={15} color={Colors.error} />
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
              placeholder="Add a note..."
              placeholderTextColor={Colors.textDisabled}
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <TouchableOpacity onPress={handleAddNote}><Text style={styles.addRowText}>Save</Text></TouchableOpacity>
          </View>
        </Section>
        </View>

        {/* Photos */}
        <Section title="Photos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {media.filter(m => m.kind === 'photo').map(m => (
              <TouchableOpacity key={m.id} onLongPress={() => handleRemoveMedia(m.id)} style={styles.photoThumb}>
                {m.url && <Image source={{ uri: m.url }} style={styles.photoImage} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPhotoButton} onPress={() => pickAndUpload('photo')}>
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </ScrollView>
        </Section>

        {/* Documents */}
        <Section title="Documents">
          {media.filter(m => m.kind === 'document').map(m => (
            <View key={m.id} style={styles.docRow}>
              <Text style={styles.docName}>{m.label ?? m.storage_path.split('/').pop()}</Text>
              <TouchableOpacity onPress={() => handleRemoveMedia(m.id)}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRow} onPress={() => pickAndUpload('document')}>
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addRowText}>Add document</Text>
          </TouchableOpacity>
        </Section>

        {/* Communication timeline */}
        <Section title="Communication">
          {comms.length === 0 ? <Text style={styles.emptyHint}>Nothing logged yet.</Text> : comms.slice(0, 20).map(c => (
            <View key={c.id} style={styles.commRow}>
              <Ionicons
                name={c.channel === 'call' ? 'call-outline' : c.channel === 'push' ? 'notifications-outline' : c.channel === 'sms' ? 'chatbubble-outline' : 'mail-outline'}
                size={15} color={Colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.commSummary}>{c.summary}</Text>
                <Text style={styles.commDate}>{timeAgo(c.at)}</Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Referrals */}
        <Section title="Referrals">
          <Text style={styles.fieldLabel}>Referred by</Text>
          {referredBy ? (
            <Text style={styles.timelineService}>{referredBy.referrer?.name ?? 'Unknown'}</Text>
          ) : pickingReferrer ? (
            <View>
              <TextInput
                style={styles.tagInput}
                placeholder="Search customers..."
                placeholderTextColor={Colors.textDisabled}
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
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addRowText}>Set referrer</Text>
            </TouchableOpacity>
          )}

          {referred.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Referred by this customer</Text>
              {referred.map(r => (
                <View key={r.id} style={styles.membershipCard}>
                  <Text style={styles.membershipName}>{r.referred?.name ?? 'Customer'}</Text>
                  <Text style={styles.membershipMeta}>
                    {r.reward_status === 'granted' ? 'Reward granted' : r.reward_status === 'pending' ? 'Reward pending' : 'No reward yet'}
                  </Text>
                  {r.reward_status !== 'granted' && (
                    <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleGrantReward(r.id)}>
                      <Text style={styles.smallActionBtnText}>Grant reward</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}
        </Section>

        {/* Relationship Timeline */}
        <Section title="Relationship Timeline">
          {timeline.length === 0 ? <Text style={styles.emptyHint}>No history yet.</Text> : (
            <View style={styles.timeline}>
              {timeline.map((e, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineService}>{e.label}</Text>
                    <Text style={styles.timelineDate}>{new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
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
      <Ionicons name={icon} size={20} color={disabled ? Colors.textDisabled : Colors.primary} />
      <Text style={[styles.quickActionLabel, disabled && { color: Colors.textDisabled }]}>{label}</Text>
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
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  healthPill: { alignItems: 'center', borderWidth: 2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  healthScore: { fontSize: 20, fontWeight: '800' },
  healthLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  healthReasons: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4, ...Shadows.subtle },
  healthReasonText: { fontSize: 13, color: Colors.textSecondary },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.sm, ...Shadows.subtle },
  quickAction: { alignItems: 'center', gap: 4, flex: 1 },
  quickActionLabel: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  insightsCard: { backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  insightText: { fontSize: 13, color: Colors.textPrimary },
  section: { gap: Spacing.xs },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.textSecondary },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  snapshotStat: { width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, ...Shadows.subtle },
  snapshotValue: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  snapshotLabel: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  preferredStaffRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, ...Shadows.subtle,
  },
  preferredStaffLabel: { fontSize: 13, color: Colors.textSecondary },
  preferredStaffValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  staffPicker: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, ...Shadows.subtle },
  staffPickerRow: { padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  staffPickerText: { fontSize: 14, color: Colors.textPrimary },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  emptyHint: { fontSize: 13.5, color: Colors.textSecondary },
  timeline: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  timelineService: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  timelineDate: { fontSize: 12, color: Colors.textSecondary },
  chartCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadows.subtle },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: 6, ...Shadows.subtle },
  rewardCode: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  rewardMeta: { fontSize: 13, color: Colors.textSecondary },
  membershipCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.xs, ...Shadows.subtle },
  membershipName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  membershipMeta: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  membershipActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  smallActionBtn: { backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  smallActionBtnText: { fontSize: 12.5, fontWeight: '600', color: Colors.primary },
  smallActionBtnDanger: { backgroundColor: '#FEF2F2', borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  smallActionBtnDangerText: { fontSize: 12.5, fontWeight: '600', color: Colors.error },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addChipText: { fontSize: 12.5, fontWeight: '600', color: Colors.primary },
  noteCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: 6, ...Shadows.subtle },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  noteDate: { fontSize: 11, color: Colors.textSecondary },
  noteBody: { fontSize: 13.5, color: Colors.textPrimary },
  addNoteRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  noteInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: 14, minHeight: 40 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  fieldLabel: { fontSize: 12.5, color: Colors.textSecondary, marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  tagAddChip: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  tagInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: 13, color: Colors.textPrimary, minWidth: 100,
  },
  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagSuggestChip: { backgroundColor: Colors.card, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  tagSuggestText: { fontSize: 12, color: Colors.textSecondary },
  referrerResultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  photoThumb: { width: 64, height: 64, borderRadius: BorderRadius.sm, backgroundColor: Colors.backgroundSection, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  addPhotoButton: { width: 64, height: 64, borderRadius: BorderRadius.sm, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docName: { fontSize: 13.5, color: Colors.textPrimary },
  commRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 6, alignItems: 'flex-start' },
  commSummary: { fontSize: 13.5, color: Colors.textPrimary },
  commDate: { fontSize: 11.5, color: Colors.textSecondary },
});
