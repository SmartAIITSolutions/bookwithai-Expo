import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getBusinessStatus, setBusinessStatus, BusinessStatus,
  getChecklist, saveChecklist,
  listAnnouncements, postAnnouncement, dismissAnnouncement, Announcement,
} from '@/lib/api/ownerDailyOps';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

const STATUS_META: Record<BusinessStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: Colors.success },
  closed: { label: 'Closed', color: Colors.textSecondary },
  interrupted: { label: 'Interrupted', color: Colors.error },
};

// Phase 2 Daily Business Controls (status/interruptions/announcements) +
// Opening & Closing checklists, bundled into one dashboard card.
export function DailyOpsCard() {
  const [status, setStatus] = useState<BusinessStatus>('open');
  const [pickingStatus, setPickingStatus] = useState(false);
  const [checklistType, setChecklistType] = useState<'opening' | 'closing'>('opening');
  const [items, setItems] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<BusinessStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [posting, setPosting] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  const todayKey = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const [statusResult, checklistResult, announcementsResult] = await Promise.all([
      getBusinessStatus(), getChecklist(checklistType, todayKey), listAnnouncements(),
    ]);
    if (statusResult.ok) setStatus(statusResult.data.business_status);
    if (checklistResult.ok) { setItems(checklistResult.data.items); setCompleted(checklistResult.data.completed_items); }
    if (announcementsResult.ok) setAnnouncements(announcementsResult.data.data);
  }, [checklistType, todayKey]);

  useEffect(() => { load(); }, [load]);

  function handleSetStatus(next: BusinessStatus) {
    setPickingStatus(false);
    if (next === 'interrupted' || next === 'closed') {
      setPendingStatus(next); // ask for an optional reason via inline input, not Alert.prompt (iOS-only)
    } else {
      setBusinessStatus(next);
      setStatus(next);
    }
  }

  async function confirmPendingStatus() {
    if (!pendingStatus) return;
    await setBusinessStatus(pendingStatus, statusReason.trim() || undefined);
    setStatus(pendingStatus);
    setPendingStatus(null);
    setStatusReason('');
  }

  async function toggleItem(item: string) {
    const next = completed.includes(item) ? completed.filter(i => i !== item) : [...completed, item];
    setCompleted(next);
    await saveChecklist(checklistType, todayKey, next);
  }

  async function handlePost() {
    if (!newMessage.trim()) return;
    setPosting(true);
    const result = await postAnnouncement(newMessage.trim());
    setPosting(false);
    if (result.ok) { setNewMessage(''); load(); }
  }

  async function handleDismiss(id: string) {
    await dismissAnnouncement(id);
    setAnnouncements(list => list.filter(a => a.id !== id));
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {/* Business status */}
      <TouchableOpacity style={styles.statusRow} onPress={() => setPickingStatus(v => !v)}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_META[status].color }]} />
        <Text style={styles.statusText}>{STATUS_META[status].label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>
      {pickingStatus && (
        <View style={styles.statusPicker}>
          {(Object.keys(STATUS_META) as BusinessStatus[]).map(s => (
            <TouchableOpacity key={s} style={styles.statusOption} onPress={() => handleSetStatus(s)}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_META[s].color }]} />
              <Text style={styles.statusText}>{STATUS_META[s].label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {pendingStatus && (
        <View style={styles.statusPicker}>
          <TextInput
            style={styles.reasonInput}
            placeholder={`Reason for ${STATUS_META[pendingStatus].label.toLowerCase()} (optional)`}
            placeholderTextColor={Colors.textDisabled}
            value={statusReason}
            onChangeText={setStatusReason}
          />
          <View style={styles.postRow}>
            <TouchableOpacity onPress={() => setPendingStatus(null)}><Text style={styles.statusText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={confirmPendingStatus}><Text style={styles.postButton}>Confirm</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Announcements */}
      {announcements.map(a => (
        <View key={a.id} style={styles.announcementCard}>
          <Text style={styles.announcementText}>{a.message}</Text>
          <TouchableOpacity onPress={() => handleDismiss(a.id)}><Ionicons name="close" size={16} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
      ))}
      <View style={styles.postRow}>
        <TextInput
          style={styles.postInput}
          placeholder="Post an announcement..."
          placeholderTextColor={Colors.textDisabled}
          value={newMessage}
          onChangeText={setNewMessage}
        />
        <TouchableOpacity onPress={handlePost} disabled={posting}><Text style={styles.postButton}>Post</Text></TouchableOpacity>
      </View>

      {/* Checklist */}
      <View style={styles.checklistCard}>
        <View style={styles.checklistTabs}>
          <TouchableOpacity onPress={() => setChecklistType('opening')}>
            <Text style={[styles.checklistTab, checklistType === 'opening' && styles.checklistTabActive]}>Opening</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setChecklistType('closing')}>
            <Text style={[styles.checklistTab, checklistType === 'closing' && styles.checklistTabActive]}>Closing</Text>
          </TouchableOpacity>
        </View>
        {items.map(item => (
          <TouchableOpacity key={item} style={styles.checklistRow} onPress={() => toggleItem(item)}>
            <Ionicons name={completed.includes(item) ? 'checkbox' : 'square-outline'} size={18} color={completed.includes(item) ? Colors.success : Colors.textSecondary} />
            <Text style={[styles.checklistText, completed.includes(item) && styles.checklistTextDone]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  statusPicker: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, gap: Spacing.xs, ...Shadows.subtle },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reasonInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary },
  announcementCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  announcementText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  postRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  postInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary },
  postButton: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  checklistCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  checklistTabs: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xs },
  checklistTab: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', paddingBottom: 4 },
  checklistTabActive: { color: Colors.primary, borderBottomWidth: 2, borderBottomColor: Colors.primary },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  checklistText: { fontSize: 13.5, color: Colors.textPrimary, flex: 1 },
  checklistTextDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
});
