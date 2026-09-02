import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { listServices, createService, archiveService, getServiceStaff, setServiceStaff, updateService, Service } from '@/lib/api/ownerServices';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatCentsUSD } from '@/lib/i18n/format';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function ServicesScreen() {
  const { t } = useTranslation(['owner']);
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

  const [depositExpandedId, setDepositExpandedId] = useState<string | null>(null);
  const [depositPercentInput, setDepositPercentInput] = useState('');
  const [depositAmountInput, setDepositAmountInput] = useState('');
  const [depositSaving, setDepositSaving] = useState(false);

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
      Alert.alert(t('owner:servicesScreen.couldNotLoadStaffTitle'), result.error);
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
      Alert.alert(t('owner:servicesScreen.couldNotSaveTitle'), result.error);
      setAssignedStaffIds(assignedStaffIds);
    }
  }

  async function handleSetCommissionRate(serviceId: string, staffId: string, value: string) {
    const pct = value.trim() ? parseFloat(value) : null;
    if (value.trim() && (isNaN(pct as number) || (pct as number) < 0 || (pct as number) > 100)) {
      Alert.alert(t('owner:servicesScreen.invalidRateTitle'), t('owner:servicesScreen.invalidRateMessage'));
      return;
    }
    const next = { ...commissionRates, [staffId]: pct };
    setCommissionRates(next);
    const result = await setServiceStaff(serviceId, Array.from(assignedStaffIds), next);
    if (!result.ok) Alert.alert(t('owner:servicesScreen.couldNotSaveRateTitle'), result.error);
  }

  async function handleAdd() {
    const durationNum = parseInt(duration, 10);
    const priceNum = parseFloat(price);
    if (!name.trim() || !durationNum || isNaN(priceNum)) {
      Alert.alert(t('owner:servicesScreen.missingInfoTitle'), t('owner:servicesScreen.missingInfoMessage'));
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
      Alert.alert(t('owner:servicesScreen.couldNotAddServiceTitle'), result.error);
    }
  }

  function toggleDepositPanel(s: Service) {
    if (depositExpandedId === s.id) { setDepositExpandedId(null); return; }
    setDepositExpandedId(s.id);
    setDepositPercentInput(s.deposit_percent != null ? String(s.deposit_percent) : '');
    setDepositAmountInput(s.deposit_amount_cents != null ? (s.deposit_amount_cents / 100).toFixed(2) : '');
  }

  async function handleSetDepositType(s: Service, type: Service['deposit_type']) {
    setDepositSaving(true);
    const result = await updateService(s.id, { deposit_type: type });
    setDepositSaving(false);
    if (result.ok) {
      setServices(list => list.map(x => x.id === s.id ? { ...x, deposit_type: type } : x));
    } else {
      Alert.alert(t('owner:servicesScreen.couldNotSaveTitle'), result.error);
    }
  }

  async function handleSaveDepositAmount(s: Service) {
    setDepositSaving(true);
    const patch = s.deposit_type === 'percent'
      ? { deposit_percent: parseFloat(depositPercentInput) || 0 }
      : { deposit_amount_cents: Math.round((parseFloat(depositAmountInput) || 0) * 100) };
    const result = await updateService(s.id, patch);
    setDepositSaving(false);
    if (result.ok) {
      setServices(list => list.map(x => x.id === s.id ? { ...x, ...patch } : x));
    } else {
      Alert.alert(t('owner:servicesScreen.couldNotSaveTitle'), result.error);
    }
  }

  async function handleArchive(id: string) {
    const result = await archiveService(id);
    if (result.ok) setServices(s => s.filter(x => x.id !== id));
    else Alert.alert(t('owner:servicesScreen.couldNotRemoveTitle'), result.error);
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{
        title: t('owner:servicesScreen.headerTitle'),
        headerBackTitle: t('owner:servicesScreen.headerBackTitle'),
        headerStyle: { backgroundColor: '#0B0712' },
        headerTintColor: '#F4D77A',
        headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
      }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {services.length === 0 && !adding && (
            <Text style={styles.emptyHint}>{t('owner:servicesScreen.emptyHint')}</Text>
          )}
          {services.map(s => (
            <BlurView key={s.id} intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceMeta}>
                    {t('owner:servicesScreen.durationAndPrice', { duration: s.duration_minutes, price: formatCentsUSD(s.price_cents) })}{s.price_is_from ? t('owner:servicesScreen.andUp') : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => toggleDepositPanel(s)} hitSlop={8} style={styles.staffBtn}>
                  <Ionicons name="cash-outline" size={16} color="#F4D77A" />
                  <Text style={styles.staffBtnText}>{t('owner:servicesScreen.deposit')}</Text>
                  <Ionicons name={depositExpandedId === s.id ? 'chevron-up' : 'chevron-down'} size={14} color="#F4D77A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleToggleStaffPanel(s.id)} hitSlop={8} style={styles.staffBtn}>
                  <Ionicons name="people-outline" size={16} color="#F4D77A" />
                  <Text style={styles.staffBtnText}>{t('owner:servicesScreen.staff')}</Text>
                  <Ionicons name={expandedServiceId === s.id ? 'chevron-up' : 'chevron-down'} size={14} color="#F4D77A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleArchive(s.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#F09595" />
                </TouchableOpacity>
              </View>

              {depositExpandedId === s.id && (
                <View style={styles.staffPanel}>
                  <Text style={styles.staffPanelHint}>{t('owner:servicesScreen.depositHint')}</Text>
                  <View style={styles.depositTypeRow}>
                    {([null, 'none', 'percent', 'fixed'] as const).map(dt => (
                      <TouchableOpacity
                        key={dt ?? 'inherit'}
                        style={[styles.depositTypeChip, s.deposit_type === dt && styles.depositTypeChipActive]}
                        disabled={depositSaving}
                        onPress={() => handleSetDepositType(s, dt)}>
                        <Text style={[styles.depositTypeChipText, s.deposit_type === dt && styles.depositTypeChipTextActive]}>
                          {dt === null ? t('owner:servicesScreen.depositSalonDefault') : dt === 'none' ? t('owner:servicesScreen.depositFullPayment') : dt === 'percent' ? t('owner:servicesScreen.depositPercentage') : t('owner:servicesScreen.depositFixedAmount')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {s.deposit_type === 'percent' && (
                    <View style={styles.depositInputRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t('owner:servicesScreen.depositPercentPlaceholder')}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={depositPercentInput}
                        onChangeText={setDepositPercentInput}
                        onEndEditing={() => handleSaveDepositAmount(s)}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.depositInputSuffix}>%</Text>
                    </View>
                  )}
                  {s.deposit_type === 'fixed' && (
                    <View style={styles.depositInputRow}>
                      <Text style={styles.depositInputSuffix}>$</Text>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t('owner:servicesScreen.depositAmountPlaceholder')}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={depositAmountInput}
                        onChangeText={setDepositAmountInput}
                        onEndEditing={() => handleSaveDepositAmount(s)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  )}
                </View>
              )}

              {expandedServiceId === s.id && (
                <View style={styles.staffPanel}>
                  {staffLoading ? (
                    <BreathingHeart size={18} color="#F4D77A" />
                  ) : staff.length === 0 ? (
                    <Text style={styles.staffPanelHint}>{t('owner:servicesScreen.addStaffFirstHint')}</Text>
                  ) : (
                    <>
                      <Text style={styles.staffPanelHint}>
                        {assignedStaffIds.size === 0
                          ? t('owner:servicesScreen.anyStaffCanPerform')
                          : t('owner:servicesScreen.onlySelectedStaffCanPerform')}
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
                                placeholder={t('owner:servicesScreen.commissionRatePlaceholder')}
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
              <TextInput style={styles.input} placeholder={t('owner:servicesScreen.namePlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder={t('owner:servicesScreen.durationPlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              <TextInput style={styles.input} placeholder={t('owner:servicesScreen.pricePlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>{t('owner:servicesScreen.bookableOnline')}</Text>
                <Switch value={bookableOnline} onValueChange={setBookableOnline} trackColor={{ true: '#F4D77A' }} />
              </View>
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={styles.cancelText}>{t('owner:servicesScreen.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <BreathingHeart size={18} color="#F4D77A" /> : <Text style={styles.addRowText}>{t('owner:servicesScreen.save')}</Text>}
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color="#F4D77A" />
              <Text style={styles.addRowText}>{t('owner:servicesScreen.addService')}</Text>
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
  depositTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.xs },
  depositTypeChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  depositTypeChipActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.15)' },
  depositTypeChipText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  depositTypeChipTextActive: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },
  depositInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  depositInputSuffix: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)' },
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
