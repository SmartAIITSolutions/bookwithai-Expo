import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listServices, createService, archiveService, getServiceStaff, setServiceStaff, Service } from '@/lib/api/ownerServices';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

export default function ServicesScreen() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [bookableOnline, setBookableOnline] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [assignedStaffIds, setAssignedStaffIds] = useState<Set<string>>(new Set());
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);

  const load = useCallback(async () => {
    const [servicesResult, staffResult] = await Promise.all([listServices(), listStaff()]);
    if (servicesResult.ok) setServices(servicesResult.data.data.filter(s => s.active));
    if (staffResult.ok) setStaff(staffResult.data.data.filter(s => s.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleStaffPanel(serviceId: string) {
    if (expandedServiceId === serviceId) {
      setExpandedServiceId(null);
      return;
    }
    setExpandedServiceId(serviceId);
    setStaffLoading(true);
    const result = await getServiceStaff(serviceId);
    setStaffLoading(false);
    if (result.ok) setAssignedStaffIds(new Set(result.data.staff_ids));
    else Alert.alert('Could not load staff assignments', result.error);
  }

  async function handleToggleStaffMember(serviceId: string, staffId: string) {
    const next = new Set(assignedStaffIds);
    if (next.has(staffId)) next.delete(staffId);
    else next.add(staffId);
    setAssignedStaffIds(next);
    setStaffSaving(true);
    const result = await setServiceStaff(serviceId, Array.from(next));
    setStaffSaving(false);
    if (!result.ok) {
      Alert.alert('Could not save', result.error);
      setAssignedStaffIds(assignedStaffIds);
    }
  }

  async function handleAdd() {
    const durationNum = parseInt(duration, 10);
    const priceNum = parseFloat(price);
    if (!name.trim() || !durationNum || isNaN(priceNum)) {
      Alert.alert('Missing info', 'Name, duration (minutes), and price are all required.');
      return;
    }
    setSaving(true);
    const result = await createService({
      name: name.trim(),
      duration_minutes: durationNum,
      price_cents: Math.round(priceNum * 100),
      bookable_online: bookableOnline,
    });
    setSaving(false);
    if (result.ok) {
      setName(''); setDuration(''); setPrice(''); setBookableOnline(true); setAdding(false);
      load();
    } else {
      Alert.alert('Could not add service', result.error);
    }
  }

  async function handleArchive(id: string) {
    const result = await archiveService(id);
    if (result.ok) setServices(s => s.filter(x => x.id !== id));
    else Alert.alert('Could not remove', result.error);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Services', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {services.length === 0 && !adding && (
            <Text style={styles.emptyHint}>Your services list starts here.</Text>
          )}
          {services.map(s => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceMeta}>
                    {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}{s.price_is_from ? ' & up' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleStaffPanel(s.id)} hitSlop={8} style={styles.staffBtn}>
                  <Ionicons name="people-outline" size={16} color={Colors.primary} />
                  <Text style={styles.staffBtnText}>Staff</Text>
                  <Ionicons name={expandedServiceId === s.id ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleArchive(s.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>

              {expandedServiceId === s.id && (
                <View style={styles.staffPanel}>
                  {staffLoading ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : staff.length === 0 ? (
                    <Text style={styles.staffPanelHint}>Add staff members first to assign them here.</Text>
                  ) : (
                    <>
                      <Text style={styles.staffPanelHint}>
                        {assignedStaffIds.size === 0
                          ? 'Any staff member can perform this service.'
                          : 'Only the selected staff can perform this service.'}
                      </Text>
                      {staff.map(member => {
                        const isAssigned = assignedStaffIds.has(member.id);
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={styles.staffRow}
                            disabled={staffSaving}
                            onPress={() => handleToggleStaffMember(s.id, member.id)}>
                            <Ionicons
                              name={isAssigned ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isAssigned ? Colors.primary : Colors.textDisabled}
                            />
                            <Text style={styles.staffRowText}>{member.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </View>
          ))}

          {adding ? (
            <View style={styles.addCard}>
              <TextInput style={styles.input} placeholder="Service name" placeholderTextColor={Colors.textDisabled} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Duration (minutes)" placeholderTextColor={Colors.textDisabled} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              <TextInput style={styles.input} placeholder="Price ($)" placeholderTextColor={Colors.textDisabled} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Bookable online</Text>
                <Switch value={bookableOnline} onValueChange={setBookableOnline} trackColor={{ true: Colors.primary }} />
              </View>
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add service</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  serviceName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  serviceMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  staffBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  staffBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  staffPanel: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.xs },
  staffPanelHint: { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.xs },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  staffRowText: { fontSize: 14, color: Colors.textPrimary },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
