import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listServices, createService, archiveService, Service } from '@/lib/api/ownerServices';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

export default function ServicesScreen() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [bookableOnline, setBookableOnline] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listServices();
    if (result.ok) setServices(result.data.data.filter(s => s.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{s.name}</Text>
                <Text style={styles.serviceMeta}>
                  {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}{s.price_is_from ? ' & up' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleArchive(s.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle,
  },
  serviceName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  serviceMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
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
