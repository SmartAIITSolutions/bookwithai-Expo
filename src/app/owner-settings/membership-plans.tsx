import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { FontFamily } from '@/constants/Theme';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { listMembershipPlans, createMembershipPlan, updateMembershipPlan, MembershipPlan, BillingMode, BillingInterval } from '@/lib/api/ownerMemberships';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

export default function MembershipPlansScreen() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [interval, setInterval_] = useState<BillingInterval>('monthly');
  const [billingMode, setBillingMode] = useState<BillingMode>('manual');
  const [discountPct, setDiscountPct] = useState('');
  const [includedVisits, setIncludedVisits] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listMembershipPlans();
    if (result.ok) setPlans(result.data.data.filter(p => p.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const priceNum = parseFloat(price);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      Alert.alert('Missing info', 'Name and price are required.');
      return;
    }
    setSaving(true);
    const result = await createMembershipPlan({
      name: name.trim(),
      price_cents: Math.round(priceNum * 100),
      billing_interval: interval,
      billing_mode: billingMode,
      discount_pct: discountPct.trim() ? parseFloat(discountPct) : null,
      included_visits_per_cycle: includedVisits.trim() ? parseInt(includedVisits, 10) : null,
    });
    setSaving(false);
    if (result.ok) {
      setName(''); setPrice(''); setDiscountPct(''); setIncludedVisits(''); setAdding(false);
      load();
    } else {
      Alert.alert('Could not create plan', result.error);
    }
  }

  async function handleArchive(id: string) {
    const result = await updateMembershipPlan(id, { active: false });
    if (result.ok) setPlans(p => p.filter(x => x.id !== id));
    else Alert.alert('Could not remove', result.error);
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Membership Plans', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {plans.length === 0 && !adding && (
            <Text style={styles.emptyHint}>No membership plans yet.</Text>
          )}
          {plans.map(p => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planMeta}>
                  ${(p.price_cents / 100).toFixed(2)}/{p.billing_interval === 'monthly' ? 'mo' : 'yr'}
                  {' · '}{p.billing_mode === 'stripe_subscription' ? 'Auto-billed' : 'Manual renewal'}
                </Text>
                {(p.discount_pct || p.included_visits_per_cycle) && (
                  <Text style={styles.planBenefits}>
                    {p.discount_pct ? `${p.discount_pct}% off services` : ''}
                    {p.discount_pct && p.included_visits_per_cycle ? ' · ' : ''}
                    {p.included_visits_per_cycle ? `${p.included_visits_per_cycle} visits/cycle` : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleArchive(p.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {adding ? (
            <View style={styles.addCard}>
              <TextInput style={styles.input} placeholder="Plan name" placeholderTextColor={Colors.textDisabled} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Price ($)" placeholderTextColor={Colors.textDisabled} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

              <Text style={styles.fieldLabel}>Billing interval</Text>
              <View style={styles.chipRow}>
                {(['monthly', 'yearly'] as BillingInterval[]).map(i => (
                  <TouchableOpacity key={i} style={[styles.chip, interval === i && styles.chipActive]} onPress={() => setInterval_(i)}>
                    <Text style={[styles.chipText, interval === i && styles.chipTextActive]}>{i === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Billing mode</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, billingMode === 'manual' && styles.chipActive]} onPress={() => setBillingMode('manual')}>
                  <Text style={[styles.chipText, billingMode === 'manual' && styles.chipTextActive]}>Manual renewal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, billingMode === 'stripe_subscription' && styles.chipActive]} onPress={() => setBillingMode('stripe_subscription')}>
                  <Text style={[styles.chipText, billingMode === 'stripe_subscription' && styles.chipTextActive]}>Auto-billed (Stripe)</Text>
                </TouchableOpacity>
              </View>

              <TextInput style={styles.input} placeholder="Discount on services (%, optional)" placeholderTextColor={Colors.textDisabled} value={discountPct} onChangeText={setDiscountPct} keyboardType="decimal-pad" />
              <TextInput style={styles.input} placeholder="Included visits per cycle (optional)" placeholderTextColor={Colors.textDisabled} value={includedVisits} onChangeText={setIncludedVisits} keyboardType="number-pad" />

              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <BreathingHeart size={18} color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add membership plan</Text>
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
  emptyHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle,
  },
  planName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  planMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  planBenefits: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  fieldLabel: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12.5, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.textOnPrimary },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
