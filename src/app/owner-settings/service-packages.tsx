import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { listServicePackages, createServicePackage, updateServicePackage, ServicePackage } from '@/lib/api/ownerPackages';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

export default function ServicePackagesScreen() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [includedVisits, setIncludedVisits] = useState('');
  const [expiresAfterDays, setExpiresAfterDays] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listServicePackages();
    if (result.ok) setPackages(result.data.data.filter(p => p.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const priceNum = parseFloat(price);
    const visitsNum = parseInt(includedVisits, 10);
    if (!name.trim() || !priceNum || priceNum <= 0 || !visitsNum || visitsNum < 1) {
      Alert.alert('Missing info', 'Name, price, and included visits are all required.');
      return;
    }
    setSaving(true);
    const result = await createServicePackage({
      name: name.trim(),
      price_cents: Math.round(priceNum * 100),
      included_visits: visitsNum,
      expires_after_days: expiresAfterDays.trim() ? parseInt(expiresAfterDays, 10) : null,
    });
    setSaving(false);
    if (result.ok) {
      setName(''); setPrice(''); setIncludedVisits(''); setExpiresAfterDays(''); setAdding(false);
      load();
    } else {
      Alert.alert('Could not create package', result.error);
    }
  }

  async function handleArchive(id: string) {
    const result = await updateServicePackage(id, { active: false });
    if (result.ok) setPackages(p => p.filter(x => x.id !== id));
    else Alert.alert('Could not remove', result.error);
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ title: 'Packages', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {packages.length === 0 && !adding && (
            <Text style={styles.emptyHint}>No packages yet — sell a prepaid bundle of visits.</Text>
          )}
          {packages.map(p => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pkgName}>{p.name}</Text>
                <Text style={styles.pkgMeta}>
                  ${(p.price_cents / 100).toFixed(2)} · {p.included_visits} visits
                  {p.expires_after_days ? ` · expires in ${p.expires_after_days}d` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleArchive(p.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {adding ? (
            <View style={styles.addCard}>
              <TextInput style={styles.input} placeholder="Package name" placeholderTextColor={Colors.textDisabled} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Price ($)" placeholderTextColor={Colors.textDisabled} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <TextInput style={styles.input} placeholder="Included visits" placeholderTextColor={Colors.textDisabled} value={includedVisits} onChangeText={setIncludedVisits} keyboardType="number-pad" />
              <TextInput style={styles.input} placeholder="Expires after (days, optional)" placeholderTextColor={Colors.textDisabled} value={expiresAfterDays} onChangeText={setExpiresAfterDays} keyboardType="number-pad" />
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
              <Text style={styles.addRowText}>Add package</Text>
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
  pkgName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  pkgMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
