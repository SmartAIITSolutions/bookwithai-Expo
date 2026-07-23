import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Share, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { getCheckoutPreview, submitCheckout, CheckoutPreview, Tender, ProductLine } from '@/lib/api/ownerCheckout';
import { getStoreCredit } from '@/lib/api/ownerCheckout';
import { validateGiftCard } from '@/lib/api/giftCards';
import { listProducts, Product } from '@/lib/api/ownerProducts';
import { listServices, Service } from '@/lib/api/ownerServices';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

interface CheckoutSheetProps {
  booking: OwnerBooking | null;
  onDone: () => void;
}

export interface CheckoutSheetHandle {
  present: () => void;
  dismiss: () => void;
}

// Phase 0.6 Checkout Mode. Deliberately not a separate POS screen — this
// sheet is what the appointment sheet hands off to when the sticky bar
// reaches "READY FOR CHECKOUT."
//
// Built on React Native's own Modal rather than @gorhom/bottom-sheet --
// the library silently failed to open here (present() called, ref valid,
// data loaded, but the modal's internal state never transitioned; matches
// known open issues in @gorhom/bottom-sheet v5 around animation-timing
// races). Plain Modal has no such issue and needs no external library.
export const CheckoutSheet = forwardRef<CheckoutSheetHandle, CheckoutSheetProps>(
  function CheckoutSheet({ booking, onDone }, ref) {
    const [visible, setVisible] = useState(false);
    useImperativeHandle(ref, () => ({
      present: () => setVisible(true),
      dismiss: () => setVisible(false),
    }), []);

    const { clientId } = useAuth();
    const [preview, setPreview] = useState<CheckoutPreview | null>(null);
    const [catalog, setCatalog] = useState<Product[]>([]);
    const [products, setProducts] = useState<ProductLine[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [upgradedService, setUpgradedService] = useState<Service | null>(null);
    const [showServicePicker, setShowServicePicker] = useState(false);
    const [discountCents, setDiscountCents] = useState(0);
    const [tipCents, setTipCents] = useState(0);
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [addingTender, setAddingTender] = useState(false);
    const [tenderMethod, setTenderMethod] = useState<Tender['method']>('cash');
    const [tenderAmount, setTenderAmount] = useState('');
    const [giftCode, setGiftCode] = useState('');
    const [giftBalance, setGiftBalance] = useState<number | null>(null);
    const [storeCreditBalance, setStoreCreditBalance] = useState(0);
    const [sendEmail, setSendEmail] = useState(true);
    const [sendSms, setSendSms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ status: 'completed' | 'awaiting_card_payment'; payment_url?: string } | null>(null);
    const [bookNext, setBookNext] = useState(false);

    const load = useCallback(async () => {
      if (!booking) return;
      const [previewResult, productsResult, servicesResult] = await Promise.all([
        getCheckoutPreview(booking.id),
        listProducts(),
        listServices(),
      ]);
      if (previewResult.ok) setPreview(previewResult.data);
      if (productsResult.ok) setCatalog(productsResult.data.data);
      if (servicesResult.ok) setServices(servicesResult.data.data.filter(s => s.active && s.id !== booking.service_id));
      if (booking.customer_id) {
        const credit = await getStoreCredit(booking.customer_id);
        if (credit.ok) setStoreCreditBalance(credit.data.balance_cents);
      }
    }, [booking]);

    useEffect(() => {
      if (booking) {
        setResult(null); setTenders([]); setProducts([]); setDiscountCents(0); setTipCents(0); setUpgradedService(null);
        load();
      }
    }, [booking, load]);

    if (!booking || !preview) {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="60%">
          <View style={styles.centered}><ActivityIndicator color="#F4D77A" /></View>
        </SheetModal>
      );
    }

    const serviceBaseCents = upgradedService ? upgradedService.price_cents : preview.subtotal_cents;
    const productTotal = products.reduce((s, p) => s + p.quantity * p.price_cents_each, 0);
    const subtotal = serviceBaseCents + productTotal;
    // Recomputed reactively, not frozen from the initial preview call --
    // tax must reflect products/discount chosen during this checkout.
    const taxableBase = Math.max(0, subtotal - discountCents);
    const taxCents = preview.tax.inclusive ? 0 : Math.round(taxableBase * (preview.tax.rate_percent / 100));
    const total = subtotal - discountCents + taxCents + tipCents;
    const tenderedTotal = tenders.reduce((s, t) => s + t.amount_cents, 0);
    const remaining = total - tenderedTotal;

    function addProduct(p: Product) {
      setProducts(list => {
        const existing = list.find(x => x.product_id === p.id);
        if (existing) return list.map(x => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
        return [...list, { product_id: p.id, product_name: p.name, quantity: 1, price_cents_each: p.price_cents }];
      });
    }

    async function handleValidateGift() {
      if (!clientId || !giftCode.trim()) return;
      const r = await validateGiftCard(clientId, giftCode.trim());
      if (r.ok) setGiftBalance(r.balance_cents);
      else Alert.alert('Invalid gift card', r.error);
    }

    function addTender() {
      const amount = Math.round(parseFloat(tenderAmount || '0') * 100);
      if (!amount || amount <= 0) { Alert.alert('Enter an amount'); return; }
      if (tenderMethod === 'gift_card') {
        if (giftBalance == null) { Alert.alert('Validate the gift card first'); return; }
        if (amount > giftBalance) { Alert.alert('Amount exceeds gift card balance'); return; }
        setTenders(t => [...t, { method: 'gift_card', amount_cents: amount, gift_card_code: giftCode.trim() }]);
        setGiftCode(''); setGiftBalance(null);
      } else if (tenderMethod === 'store_credit') {
        if (amount > storeCreditBalance) { Alert.alert('Amount exceeds store credit balance'); return; }
        setTenders(t => [...t, { method: 'store_credit', amount_cents: amount }]);
      } else {
        setTenders(t => [...t, { method: tenderMethod, amount_cents: amount }]);
      }
      setTenderAmount(''); setAddingTender(false);
    }

    async function handleSubmit() {
      if (!booking || !preview) return;
      if (remaining !== 0) { Alert.alert('Payments must add up to the total due.'); return; }
      setSubmitting(true);
      const res = await submitCheckout(booking.id, {
        tip_cents: tipCents, discount_cents: discountCents, tax_cents: taxCents,
        products, tenders, send_receipt_email: sendEmail, send_receipt_sms: sendSms,
        upgraded_service_id: upgradedService?.id, upgraded_price_cents: upgradedService?.price_cents,
      });
      setSubmitting(false);
      if (!res.ok) { Alert.alert('Checkout failed', res.error); return; }
      setResult(res.data);
      if (res.data.status === 'completed') {
        setTimeout(onDone, 2200);
      }
    }

    async function shareLink(url: string) {
      await Share.share({ message: `Please complete your payment here: ${url}` });
    }

    if (result?.status === 'awaiting_card_payment' && result.payment_url) {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="50%">
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Card payment</Text>
            <Text style={styles.hint}>Send this link to the customer to complete payment on their own device.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => shareLink(result.payment_url!)}>
              <Text style={styles.primaryButtonText}>Share Payment Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneRow} onPress={onDone}>
              <Text style={styles.doneText}>Done for now</Text>
            </TouchableOpacity>
          </View>
        </SheetModal>
      );
    }

    if (result?.status === 'completed') {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="45%">
          <View style={styles.content}>
            <Text style={styles.successTitle}>✅ Payment collected</Text>
            <Text style={styles.successLine}>✅ Receipt sent</Text>
            <Text style={styles.successLine}>✅ Loyalty updated</Text>
            <Text style={styles.successLine}>{preview.rebook_suggestion ? '✅ Next appointment suggested' : 'Not booked'}</Text>
          </View>
        </SheetModal>
      );
    }

    return (
      <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="90%">
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Checkout</Text>

          {preview.checklist.every(c => c.ok) ? (
            <Text style={styles.checklistOk}>Everything looks good.</Text>
          ) : (
            <View style={styles.checklistCard}>
              {preview.checklist.filter(c => !c.ok).map((c, i) => <Text key={i} style={styles.checklistItem}>⚠ {c.label}</Text>)}
            </View>
          )}

          <Section title="Service">
            {upgradedService ? (
              <View style={styles.tenderRow}>
                <Text style={styles.tenderText}>Upgraded to {upgradedService.name} — {money(upgradedService.price_cents)}</Text>
                <TouchableOpacity onPress={() => setUpgradedService(null)}><Ionicons name="close" size={16} color="#F09595" /></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addRow} onPress={() => setShowServicePicker(v => !v)}>
                <Ionicons name="arrow-up-circle-outline" size={16} color="#F4D77A" />
                <Text style={styles.linkText}>Upgrade service</Text>
              </TouchableOpacity>
            )}
            {showServicePicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {services.map(s => (
                  <TouchableOpacity key={s.id} style={styles.chip} onPress={() => { setUpgradedService(s); setShowServicePicker(false); }}>
                    <Text style={styles.chipText}>{s.name} · {money(s.price_cents)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Section>

          <Section title="Products">
            {products.map(p => (
              <Text key={p.product_id} style={styles.lineItem}>{p.quantity}× {p.product_name} — {money(p.quantity * p.price_cents_each)}</Text>
            ))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {catalog.map(p => (
                <TouchableOpacity key={p.id} style={styles.chip} onPress={() => addProduct(p)}>
                  <Text style={styles.chipText}>+ {p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>

          <Section title="Discount">
            <View style={styles.chipRow}>
              {[10, 15, 20].map(pct => (
                <TouchableOpacity key={pct} style={styles.chip} onPress={() => setDiscountCents(Math.round(subtotal * pct / 100))}>
                  <Text style={styles.chipText}>{pct}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.chip} onPress={() => setDiscountCents(0)}>
                <Text style={styles.chipText}>None</Text>
              </TouchableOpacity>
            </View>
          </Section>

          <Section title="Tip">
            <View style={styles.chipRow}>
              {[18, 20, 25].map(pct => (
                <TouchableOpacity key={pct} style={[styles.chip, tipCents === Math.round(subtotal * pct / 100) && styles.chipActive]} onPress={() => setTipCents(Math.round(subtotal * pct / 100))}>
                  <Text style={[styles.chipText, tipCents === Math.round(subtotal * pct / 100) && styles.chipTextActive]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.chip, tipCents === 0 && styles.chipActive]} onPress={() => setTipCents(0)}>
                <Text style={[styles.chipText, tipCents === 0 && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
            </View>
          </Section>

          <BlurView intensity={90} tint="dark" style={styles.totalsCard}>
            <CardOverlay />
            <TotalRow label="Subtotal" value={subtotal} />
            <TotalRow label="Discount" value={-discountCents} />
            <TotalRow label={preview.tax.label} value={taxCents} />
            <TotalRow label="Tip" value={tipCents} />
            <TotalRow label="Total" value={total} bold />
            <TotalRow label="Remaining" value={remaining} bold color={remaining === 0 ? '#4ADE80' : '#F09595'} />
          </BlurView>

          <Section title="Payment">
            {tenders.map((t, i) => (
              <View key={i} style={styles.tenderRow}>
                <Text style={styles.tenderText}>{t.method} — {money(t.amount_cents)}</Text>
                <TouchableOpacity onPress={() => setTenders(list => list.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close" size={16} color="#F09595" />
                </TouchableOpacity>
              </View>
            ))}
            {addingTender ? (
              <BlurView intensity={90} tint="dark" style={styles.addCard}>
                <CardOverlay />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(['cash', 'card', 'venmo', 'zelle', 'cashapp', 'gift_card', 'store_credit', 'other'] as const).map(m => (
                    <TouchableOpacity key={m} style={[styles.chip, tenderMethod === m && styles.chipActive]} onPress={() => setTenderMethod(m)}>
                      <Text style={[styles.chipText, tenderMethod === m && styles.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {tenderMethod === 'gift_card' && (
                  <View style={styles.giftRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="Gift card code" placeholderTextColor="rgba(255,255,255,0.4)" value={giftCode} onChangeText={setGiftCode} autoCapitalize="characters" />
                    <TouchableOpacity onPress={handleValidateGift}><Text style={styles.linkText}>Check</Text></TouchableOpacity>
                  </View>
                )}
                {tenderMethod === 'gift_card' && giftBalance != null && (
                  <Text style={styles.hint}>Balance: {money(giftBalance)}</Text>
                )}
                {tenderMethod === 'store_credit' && (
                  <Text style={styles.hint}>Available: {money(storeCreditBalance)}</Text>
                )}
                <TextInput style={styles.input} placeholder="Amount ($)" placeholderTextColor="rgba(255,255,255,0.4)" value={tenderAmount} onChangeText={setTenderAmount} keyboardType="decimal-pad" />
                <View style={styles.inlineActions}>
                  <TouchableOpacity onPress={() => setAddingTender(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={addTender}><Text style={styles.linkText}>Add</Text></TouchableOpacity>
                </View>
              </BlurView>
            ) : (
              <TouchableOpacity style={styles.addRow} onPress={() => setAddingTender(true)}>
                <Ionicons name="add" size={16} color="#F4D77A" />
                <Text style={styles.linkText}>Add payment method</Text>
              </TouchableOpacity>
            )}
          </Section>

          {preview.rebook_suggestion && (
            <Section title="Rebook">
              <TouchableOpacity style={styles.rebookCard} onPress={() => setBookNext(v => !v)}>
                <Ionicons name={bookNext ? 'checkbox' : 'square-outline'} size={18} color="#F4D77A" />
                <Text style={styles.rebookText}>
                  Suggest next visit — {new Date(preview.rebook_suggestion.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (usually every {preview.rebook_suggestion.interval_days} days)
                </Text>
              </TouchableOpacity>
            </Section>
          )}

          <Section title="Receipt">
            <View style={styles.chipRow}>
              <TouchableOpacity style={[styles.chip, sendEmail && styles.chipActive]} onPress={() => setSendEmail(v => !v)}><Text style={[styles.chipText, sendEmail && styles.chipTextActive]}>Email</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.chip, sendSms && styles.chipActive]} onPress={() => setSendSms(v => !v)}><Text style={[styles.chipText, sendSms && styles.chipTextActive]}>SMS</Text></TouchableOpacity>
            </View>
          </Section>

          <TouchableOpacity style={[styles.primaryButton, remaining !== 0 && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={submitting || remaining !== 0}>
            {submitting ? <ActivityIndicator color="#09000F" /> : <Text style={styles.primaryButtonText}>Complete Checkout</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SheetModal>
    );
  }
);

// Plain-Modal bottom sheet: dark backdrop (tap to dismiss) + a rounded
// panel sliding up from the bottom, capped at maxHeight so short content
// (loading/success states) doesn't stretch to fill the screen.
function SheetModal({ visible, onRequestClose, maxHeight, children }: {
  visible: boolean; onRequestClose: () => void; maxHeight: `${number}%`; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onRequestClose} />
        <View style={[styles.sheetPanel, { maxHeight }]}>
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.subTitle}>{title}</Text>{children}</View>;
}

function TotalRow({ label, value, bold, color }: { label: string; value: number; bold?: boolean; color?: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalBold, color ? { color } : null]}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetPanel: { backgroundColor: '#0B0712', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingTop: Spacing.sm },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,175,55,0.4)', alignSelf: 'center', marginBottom: Spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  sectionTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  subTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#F4D77A', marginBottom: 4,
  },
  section: { gap: Spacing.xs },
  checklistOk: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#4ADE80' },
  checklistCard: {
    backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: BorderRadius.sm, padding: Spacing.sm, gap: 4,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  checklistItem: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FBBF24' },
  lineItem: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', marginBottom: 2 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  chipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  chipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12.5, color: '#FFFFFF' },
  chipTextActive: { color: '#09000F' },
  totalsCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: 4,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  totalValue: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  totalBold: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base },
  tenderRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  tenderText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', textTransform: 'capitalize' },
  addCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.sm, gap: Spacing.xs,
  },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF',
  },
  hint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  linkText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rebookCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.sm,
  },
  rebookText: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  primaryButton: { backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center' },
  primaryButtonDisabled: { backgroundColor: 'rgba(212,175,55,0.3)' },
  primaryButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
  doneRow: { alignItems: 'center', paddingTop: Spacing.sm },
  doneText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  successTitle: {
    fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#4ADE80',
    textShadowColor: 'rgba(74,222,128,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  successLine: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
});
