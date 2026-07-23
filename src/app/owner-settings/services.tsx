import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { listServices, createService, archiveService, getServiceStaff, setServiceStaff, Service } from '@/lib/api/ownerServices';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

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
  const [commissionRates, setCommissionRates] = useState<Record<string, number | null>>({});
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
    if (result.ok) {
      setAssignedStaffIds(new Set(result.data.staff_ids));
      setCommissionRates(result.data.commission_rates ?? {});
    } else {
      Alert.alert('Could not load staff assignments', result.error);
    }
  }

  async function handleToggleStaffMember(serviceId: string, staffId: string) {
    const next = new Set(assignedStaffIds);
    if (next.has(staffId)) next.delete(staffId);
    else next.add(staffId);
    setAssignedStaffIds(next);
    setStaffSaving(true);
    const result = await setServiceStaff(serviceId, Array.from(next), commissionRates);
    setStaffSaving(false);
    if (!result.ok) {
      Alert.alert('Could not save', result.error);
      setAssignedStaffIds(assignedStaffIds);
    }
  }

  async function handleSetCommissionRate(serviceId: string, staffId: string, value: string) {
    const pct = value.trim() ? parseFloat(value) : null;
    if (value.trim() && (isNaN(pct as number) || (pct as number) < 0 || (pct as number) > 100)) {
      Alert.alert('Invalid rate', 'Enter a percentage between 0 and 100.');
      return;
    }
    const next = { ...commissionRates, [staffId]: pct };
    setCommissionRates(next);
    const result = await setServiceStaff(serviceId, Array.from(assignedStaffIds), next);
    if (!result.ok) Alert.alert('Could not save rate', result.error);
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
      <DualBreathingBackground />
      <Stack.Screen options={{
        title: 'Services',
        headerBackTitle: 'More',
        headerStyle: { backgroundColor: '#0B0712' },
        headerTintColor: '#F4D77A',
        headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
      }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {services.length === 0 && !adding && (
            <Text style={styles.emptyHint}>Your services list starts here.</Text>
          )}
          {services.map(s => (
            <BlurView key={s.id} intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceMeta}>
                    {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}{s.price_is_from ? ' & up' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleStaffPanel(s.id)} hitSlop={8} style={styles.staffBtn}>
                  <Ionicons name="people-outline" size={16} color="#F4D77A" />
                  <Text style={styles.staffBtnText}>Staff</Text>
                  <Ionicons name={expandedServiceId === s.id ? 'chevron-up' : 'chevron-down'} size={14} color="#F4D77A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleArchive(s.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#F09595" />
                </TouchableOpacity>
              </View>

              {expandedServiceId === s.id && (
                <View style={styles.staffPanel}>
                  {staffLoading ? (
                    <BreathingHeart size={18} color="#F4D77A" />
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
                          <View key={member.id} style={styles.staffRow}>
                            <TouchableOpacity
                              style={styles.staffRowMain}
                              disabled={staffSaving}
                              onPress={() => handleToggleStaffMember(s.id, member.id)}>
                              <Ionicons
                                name={isAssigned ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={isAssigned ? '#F4D77A' : 'rgba(255,255,255,0.35)'}
                              />
                              <Text style={styles.staffRowText}>{member.name}</Text>
                            </TouchableOpacity>
                            {isAssigned && (
                              <TextInput
                                style={styles.staffRateInput}
                                placeholder="Default"
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                defaultValue={commissionRates[member.id] != null ? String(commissionRates[member.id]) : ''}
                                onEndEditing={(e) => handleSetCommissionRate(s.id, member.id, e.nativeEvent.text)}
                                keyboardType="decimal-pad"
                              />
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </BlurView>
          ))}

          {adding ? (
            <BlurView intensity={90} tint="dark" style={styles.addCard}>
              <CardOverlay />
              <TextInput style={styles.input} placeholder="Service name" placeholderTextColor="rgba(255,255,255,0.4)" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Duration (minutes)" placeholderTextColor="rgba(255,255,255,0.4)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              <TextInput style={styles.input} placeholder="Price ($)" placeholderTextColor="rgba(255,255,255,0.4)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Bookable online</Text>
                <Switch value={bookableOnline} onValueChange={setBookableOnline} trackColor={{ true: '#F4D77A' }} />
              </View>
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <BreathingHeart size={18} color="#F4D77A" /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color="#F4D77A" />
              <Text style={styles.addRowText}>Add service</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.sm },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  serviceName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#FFFFFF' },
  serviceMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  staffBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  staffBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  staffPanel: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', gap: Spacing.xs },
  staffPanelHint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.xs },
  staffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  staffRowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  staffRowText: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
  staffRateInput: {
    width: 64, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: BorderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 6, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', textAlign: 'right',
  },
  addCard: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#F4D77A' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)' },
});
