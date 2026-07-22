import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { listProducts, createProduct, archiveProduct, Product } from '@/lib/api/ownerProducts';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

// Minimal product catalog — just enough for Checkout's product line items
// (Sprint 4). Full Inventory (stock counts, receiving, alerts) is a
// separate, still-unbuilt feature.
export default function ProductsScreen() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listProducts();
    if (result.ok) setProducts(result.data.data.filter(p => p.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum)) { Alert.alert('Missing info', 'Name and price are required.'); return; }
    setSaving(true);
    const result = await createProduct(name.trim(), Math.round(priceNum * 100));
    setSaving(false);
    if (result.ok) { setName(''); setPrice(''); setAdding(false); load(); }
    else Alert.alert('Could not add product', result.error);
  }

  async function handleArchive(id: string) {
    const result = await archiveProduct(id);
    if (result.ok) setProducts(p => p.filter(x => x.id !== id));
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ title: 'Products', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {products.length === 0 && !adding && <Text style={styles.emptyHint}>Your retail products start here.</Text>}
          {products.map(p => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>${(p.price_cents / 100).toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleArchive(p.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {adding ? (
            <View style={styles.addCard}>
              <TextInput style={styles.input} placeholder="Product name" placeholderTextColor={Colors.textDisabled} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Price ($)" placeholderTextColor={Colors.textDisabled} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <View style={styles.inlineActions}>
                <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <BreathingHeart size={18} color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add product</Text>
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
  emptyHint: { fontSize: 14, color: Colors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
