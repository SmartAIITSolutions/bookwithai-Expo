import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, Pressable, Linking, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { OwnerBooking, createBooking } from '@/lib/api/ownerBookings';
import { getCheckoutPreview, submitCheckout, CheckoutPreview, Tender, ProductLine, sendBalancePaymentEmail, sendBalancePaymentPush, sendRebookNudge } from '@/lib/api/ownerCheckout';
import { getStoreCredit } from '@/lib/api/ownerCheckout';
import { validateGiftCard } from '@/lib/api/giftCards';
import { listProducts, Product } from '@/lib/api/ownerProducts';
import { listServices, Service } from '@/lib/api/ownerServices';
import { StaffMember } from '@/lib/api/ownerStaff';
import { RebookDateTimeModal } from '@/components/owner/RebookDateTimeModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorState } from '@/components/ErrorState';
import { cardChargeFromVisitDueCents } from '@/lib/stripe/fees';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatCentsUSD, formatWeekdayMonthDay, formatTimeShort } from '@/lib/i18n/format';
import i18n from '@/lib/i18n';

function money(cents: number) { return formatCentsUSD(cents); }

// YYYY-MM-DD / HH:mm in the device's actual local time. `toISOString()`
// always converts to UTC first, which silently shows the wrong calendar
// day whenever the device's timezone offset crosses midnight relative to
// UTC -- a real bug, not just a style choice, so built from the local
// getters instead.
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toLocalTimeStr(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatRebookDateTime(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(d.getTime())) return `${dateStr} ${timeStr}`;
  return `${formatWeekdayMonthDay(d)} ${i18n.t('owner:appointmentDetail.at')} ${formatTimeShort(d)}`;
}


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
  // Only rendered as a "Performed by" picker when there's more than one
  // active staff member -- lets the salon correct who actually did the
  // service if it differs from who the booking was originally scheduled
  // with, so commission credits the right person.
  staff?: StaffMember[];
}

export interface CheckoutSheetHandle {
  present: () => void;
  dismiss: () => void;
}

// Phase 0.6 Checkout Mode. Deliberately not a separate POS screen — this
// sheet is what the appointment sheet hands off to when the sticky bar
// reaches "READY FOR CHECKOUT."
//
// Built on React Native's own Modal rather than @gorhom/bottom-sheet —
// the library silently failed to open here (present() called, ref valid,
// data loaded, but the modal's internal state never transitioned; matches
// known open issues in @gorhom/bottom-sheet v5 around animation-timing
// races). Plain Modal has no such issue and needs no external library.
export const CheckoutSheet = forwardRef<CheckoutSheetHandle, CheckoutSheetProps>(
  function CheckoutSheet({ booking, onDone, staff = [] }, ref) {
    const { t } = useTranslation(['owner']);
    // Display-only labels for canonical tender methods -- `Tender['method']`
    // values themselves ('cash', 'card', etc.) are never translated: they're
    // submitted to the backend and must stay stable regardless of app language.
    const TENDER_METHOD_LABELS: Record<Tender['method'], string> = {
      cash: t('owner:checkoutSheet.tenderCash'),
      card: t('owner:checkoutSheet.tenderCard'),
      venmo: t('owner:checkoutSheet.tenderVenmo'),
      zelle: t('owner:checkoutSheet.tenderZelle'),
      cashapp: t('owner:checkoutSheet.tenderCashapp'),
      gift_card: t('owner:checkoutSheet.tenderGiftCard'),
      store_credit: t('owner:checkoutSheet.tenderStoreCredit'),
      other: t('owner:checkoutSheet.tenderOther'),
    };
    const [visible, setVisible] = useState(false);
    useImperativeHandle(ref, () => ({
      present: () => setVisible(true),
      dismiss: () => setVisible(false),
    }), []);

    const { clientId } = useAuth();
    const [preview, setPreview] = useState<CheckoutPreview | null>(null);
    // Real bug fixed here: a failed getCheckoutPreview call (network error,
    // 500, anything) previously just fell through with no else branch --
    // `preview` stayed null forever, and the `if (!booking || !preview)`
    // gate below shows nothing but a spinner, so the sheet was stuck
    // loading indefinitely with zero feedback and no way to retry short of
    // closing it. ownerFetch itself is designed to always resolve (never
    // hang/throw), so this was reachable on any real API failure.
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [products, setProducts] = useState<ProductLine[]>([]);
    // Caching pass — reuses the exact same query key calendar.tsx's own
    // servicesQuery already fetches under (['owner-services']), so opening
    // Checkout (often many times a shift) reads the cached list instead of
    // re-fetching it every time; only the per-booking exclusion filter
    // still needs to run fresh each time this sheet opens.
    const servicesQuery = useQuery({ queryKey: ['owner-services'], queryFn: async () => {
      const r = await listServices();
      if (!r.ok) throw new Error(r.error);
      return r.data.data;
    } });
    const services = (servicesQuery.data ?? []).filter(s => s.active && s.id !== booking?.service_id);
    // Same caching pass, same reasoning -- owner-settings/products.tsx
    // already fetches the catalog under this exact key. This used to be its
    // own uncached listProducts() call inside load() below, refetched from
    // scratch on every single Checkout open.
    const productsQuery = useQuery({ queryKey: ['owner-products'], queryFn: async () => {
      const r = await listProducts();
      if (!r.ok) throw new Error(r.error);
      return r.data.data;
    } });
    const catalog = productsQuery.data ?? [];
    const [addedServices, setAddedServices] = useState<Service[]>([]);
    // Invoice-style editable pricing — null/empty means "use the default"
    // (preview.subtotal_cents for the original service, the catalog price
    // for an added one). Editing either doesn't change what's booked/sold,
    // only what this specific visit is charged, mirroring a paper invoice
    // line being crossed out and rewritten.
    const [originalPriceOverrideCents, setOriginalPriceOverrideCents] = useState<number | null>(null);
    const [addedServicePriceOverrides, setAddedServicePriceOverrides] = useState<Record<string, number>>({});
    const [priceEditText, setPriceEditText] = useState<Record<string, string>>({});
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [discountCents, setDiscountCents] = useState(0);
    const [customDiscount, setCustomDiscount] = useState(false);
    const [customDiscountText, setCustomDiscountText] = useState('');
    const [tipCents, setTipCents] = useState(0);
    const [customTip, setCustomTip] = useState(false);
    const [customTipText, setCustomTipText] = useState('');
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [tenderMethod, setTenderMethod] = useState<Tender['method']>('cash');
    const [tenderAmount, setTenderAmount] = useState('');
    const [giftCode, setGiftCode] = useState('');
    const [giftBalance, setGiftBalance] = useState<number | null>(null);
    const [storeCreditBalance, setStoreCreditBalance] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ status: 'completed' | 'awaiting_card_payment'; payment_url?: string } | null>(null);
    // Snapshot of the card tender submitted alongside an awaiting_card_payment
    // result -- the checkout endpoint doesn't echo the grossed-up charge back,
    // so this is recomputed with the same cardChargeFromVisitDueCents call the
    // backend itself uses, purely to render the "Visit balance / Card charge"
    // line the web dashboard shows on its own Collect-card-payment panel.
    const [cardResultInfo, setCardResultInfo] = useState<{ visitDueCents: number; cardTotalCents: number } | null>(null);
    const [emailLinkSending, setEmailLinkSending] = useState(false);
    const [pushLinkSending, setPushLinkSending] = useState(false);
    const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
    const [bookNext, setBookNext] = useState(false);
    const [rebookDate, setRebookDate] = useState('');
    const [rebookTime, setRebookTime] = useState('');
    const [showRebookPicker, setShowRebookPicker] = useState(false);
    const [performedByStaffId, setPerformedByStaffId] = useState<string | null>(null);

    const load = useCallback(async () => {
      if (!booking) return;
      // Real bug fixed here: getStoreCredit used to be a separate `await`
      // sitting AFTER this Promise.all resolved, adding a whole extra
      // network round trip to the critical path of every Checkout open for
      // a booking with a customer_id (i.e. almost all of them) -- not
      // because it depends on the preview result, it doesn't, it was just
      // written sequentially. Folded into the same Promise.all so all three
      // requests actually fire together.
      const [previewResult, creditResult] = await Promise.all([
        getCheckoutPreview(booking.id),
        booking.customer_id ? getStoreCredit(booking.customer_id) : Promise.resolve(null),
      ]);
      if (previewResult.ok) {
        setPreviewError(null);
        setPreview(previewResult.data);
        // Most walk-in/manual checkouts are cash; a booking that already
        // has money on it (an online deposit at booking time) almost
        // always means the rest is being settled the same way it started.
        setTenderMethod(previewResult.data.already_paid_cents > 0 ? 'card' : 'cash');
        if (previewResult.data.rebook_suggestion) {
          const suggested = new Date(previewResult.data.rebook_suggestion.starts_at);
          setRebookDate(toLocalDateStr(suggested));
          setRebookTime(toLocalTimeStr(suggested));
        }
      } else {
        setPreviewError(previewResult.error);
      }
      if (creditResult?.ok) setStoreCreditBalance(creditResult.data.balance_cents);
      // Keyed on booking?.id, not the whole `booking` object -- see the
      // reset effect below for why.
    }, [booking?.id]);

    // Real bug fixed here: this used to depend on the whole `booking` object
    // (and `load`, which itself depended on the whole object too). The
    // calendar screen has its own effect that re-syncs its `selectedBooking`
    // state to a fresh object reference from `bookings` any time that array
    // changes (e.g. a realtime update) -- including while this exact
    // checkout is in progress, since submitting a card tender writes to the
    // booking row to create the Stripe session. That write alone was enough
    // to hand this component a new (but same-id) `booking` object moments
    // after the QR/payment-link screen appeared, wiping `result` back to
    // null and yanking the owner back to the method-picker before anyone
    // could scan it. Keying on `booking?.id` instead means this reset only
    // ever fires when the sheet is genuinely opened for a different booking.
    useEffect(() => {
      if (booking) {
        setResult(null); setCardResultInfo(null); setTenders([]); setProducts([]); setDiscountCents(0); setTipCents(0); setAddedServices([]);
        setPreviewError(null);
        setOriginalPriceOverrideCents(null); setAddedServicePriceOverrides({}); setPriceEditText({});
        setCustomDiscount(false); setCustomDiscountText(''); setCustomTip(false); setCustomTipText('');
        setBookNext(false); setPerformedByStaffId(booking.staff_id);
        load();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: see comment above.
    }, [booking?.id, load]);

    // Derived totals -- computed with safe fallbacks so this can run every
    // render (including before `preview` has loaded), since the effect
    // below it must be called unconditionally, same as every other hook in
    // this component (an early `if (!booking || !preview) return` used to
    // sit above this, which made the tenderAmount-sync effect conditional
    // and threw "rendered more hooks than during the previous render").
    const originalServiceName = booking?.service?.name
      ?? (booking?.service_names && booking.service_names.length > 0 ? booking.service_names.join(' + ') : t('owner:checkoutSheet.service'));
    const originalServicePriceCents = originalPriceOverrideCents ?? preview?.subtotal_cents ?? 0;
    const addedServicesTotal = addedServices.reduce((s, sv) => s + (addedServicePriceOverrides[sv.id] ?? sv.price_cents), 0);
    const serviceBaseCents = originalServicePriceCents + addedServicesTotal;
    const servicePriceEdited = originalPriceOverrideCents !== null || addedServices.length > 0;
    const productTotal = products.reduce((s, p) => s + p.quantity * p.price_cents_each, 0);
    const subtotal = serviceBaseCents + productTotal;
    // Recomputed reactively, not frozen from the initial preview call --
    // tax must reflect products/discount chosen during this checkout.
    const taxableBase = Math.max(0, subtotal - discountCents);
    const taxCents = preview?.tax.inclusive ? 0 : Math.round(taxableBase * ((preview?.tax.rate_percent ?? 0) / 100));
    const total = subtotal - discountCents + taxCents + tipCents;
    const tenderedTotal = tenders.reduce((s, t) => s + t.amount_cents, 0);
    // already_paid_cents is non-zero when the customer paid something online
    // at booking time (full payment, or a deposit) -- net it out here or the
    // owner would be prompted to collect it a second time at checkout. Was
    // previously missing entirely, a real gap independent of deposits.
    const alreadyPaidCents = preview?.already_paid_cents ?? 0;
    const remaining = Math.max(0, total - tenderedTotal - alreadyPaidCents);

    // Amount auto-fills with whatever's still due -- only changes when the
    // due amount itself changes (a tender gets added/removed, or the total
    // changes), never while the owner is mid-keystroke in the field.
    useEffect(() => {
      setTenderAmount(remaining > 0 ? (remaining / 100).toFixed(2) : '');
    }, [remaining]);

    // Preview only -- the actual charge is computed the same way, again,
    // server-side (createSalonBalanceCheckoutSession) when the card tender
    // is submitted. This just shows the owner what to expect before they
    // get there, matching the web dashboard's checkout preview.
    const cardFeePreview = preview?.pass_stripe_fee && tenderMethod === 'card' && remaining > 0
      ? cardChargeFromVisitDueCents(remaining, true)
      : null;

    // The picked method + auto-filled amount counts toward the total as
    // soon as it's valid -- the owner shouldn't have to tap "Add payment"
    // just to confirm the single, already-selected tender that's already
    // sized to cover the whole balance. "Add payment" still exists for
    // splitting the balance across more than one method.
    const pendingTenderAmount = Math.round(parseFloat(tenderAmount || '0') * 100) || 0;
    const pendingTenderValid = remaining > 0 && pendingTenderAmount > 0 && (
      tenderMethod === 'gift_card' ? giftBalance != null && pendingTenderAmount <= giftBalance :
      tenderMethod === 'store_credit' ? pendingTenderAmount <= storeCreditBalance :
      true
    );
    const pendingTender: Tender | null = !pendingTenderValid ? null :
      tenderMethod === 'gift_card' ? { method: 'gift_card', amount_cents: pendingTenderAmount, gift_card_code: giftCode.trim() } :
      { method: tenderMethod, amount_cents: pendingTenderAmount };
    const checkoutRemaining = remaining - (pendingTender?.amount_cents ?? 0);

    if (!booking) return null;

    if (previewError && !preview) {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="60%">
          <View style={styles.centered}>
            <ErrorState message={previewError} onRetry={load} />
          </View>
        </SheetModal>
      );
    }

    if (!preview) {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="60%">
          <View style={styles.centered}><ActivityIndicator color="#F4D77A" /></View>
        </SheetModal>
      );
    }

    function addProduct(p: Product) {
      setProducts(list => {
        const existing = list.find(x => x.product_id === p.id);
        if (existing) return list.map(x => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
        return [...list, { product_id: p.id, product_name: p.name, quantity: 1, price_cents_each: p.price_cents }];
      });
    }

    function handleOriginalPriceChange(text: string) {
      setPriceEditText(m => ({ ...m, original: text }));
      setOriginalPriceOverrideCents(Math.round((parseFloat(text) || 0) * 100));
    }

    function handleAddedPriceChange(serviceId: string, text: string) {
      setPriceEditText(m => ({ ...m, [serviceId]: text }));
      setAddedServicePriceOverrides(m => ({ ...m, [serviceId]: Math.round((parseFloat(text) || 0) * 100) }));
    }

    function addServiceFromModal(s: Service) {
      setAddedServices(list => [...list, s]);
      setShowServiceModal(false);
    }

    function removeAddedService(serviceId: string) {
      setAddedServices(list => list.filter(x => x.id !== serviceId));
      setAddedServicePriceOverrides(m => {
        const next = { ...m };
        delete next[serviceId];
        return next;
      });
      setPriceEditText(m => {
        const next = { ...m };
        delete next[serviceId];
        return next;
      });
    }

    async function handleValidateGift() {
      if (!clientId || !giftCode.trim()) return;
      const r = await validateGiftCard(clientId, giftCode.trim());
      if (r.ok) setGiftBalance(r.balance_cents);
      else Alert.alert(t('owner:checkoutSheet.invalidGiftCardTitle'), r.error);
    }

    function addTender() {
      const amount = Math.round(parseFloat(tenderAmount || '0') * 100);
      if (!amount || amount <= 0) { Alert.alert(t('owner:checkoutSheet.enterAnAmountTitle')); return; }
      if (tenderMethod === 'gift_card') {
        if (giftBalance == null) { Alert.alert(t('owner:checkoutSheet.validateGiftCardFirstTitle')); return; }
        if (amount > giftBalance) { Alert.alert(t('owner:checkoutSheet.amountExceedsGiftCardTitle')); return; }
        setTenders(list => [...list, { method: 'gift_card', amount_cents: amount, gift_card_code: giftCode.trim() }]);
        setGiftCode(''); setGiftBalance(null);
      } else if (tenderMethod === 'store_credit') {
        if (amount > storeCreditBalance) { Alert.alert(t('owner:checkoutSheet.amountExceedsStoreCreditTitle')); return; }
        setTenders(list => [...list, { method: 'store_credit', amount_cents: amount }]);
      } else {
        setTenders(list => [...list, { method: tenderMethod, amount_cents: amount }]);
      }
    }

    async function handleSubmit() {
      if (!booking || !preview) return;
      if (checkoutRemaining !== 0) { Alert.alert(t('owner:checkoutSheet.paymentsMustAddUpTitle')); return; }
      const finalTenders = pendingTender ? [...tenders, pendingTender] : tenders;
      setSubmitting(true);
      const res = await submitCheckout(booking.id, {
        tip_cents: tipCents, discount_cents: discountCents, tax_cents: taxCents,
        products, tenders: finalTenders, send_receipt_email: true,
        added_service_ids: addedServices.length > 0 ? addedServices.map(s => s.id) : undefined,
        // Sent whenever either the original service's price was edited or
        // any service was added/priced-in -- the backend treats this as the
        // one combined effective price (see checkout/route.ts), so an edit
        // to just the original line's price has to travel through here too,
        // not only the addedServices-driven case this used to gate on.
        total_service_price_cents: servicePriceEdited ? serviceBaseCents : undefined,
        staff_id: performedByStaffId !== booking.staff_id ? performedByStaffId : undefined,
      });
      setSubmitting(false);
      if (!res.ok) { Alert.alert(t('owner:checkoutSheet.checkoutFailedTitle'), res.error); return; }

      // Rebook -- only attempted after a successful checkout, and only if
      // the owner actually confirmed the (editable) suggested date/time.
      // Always rebooks the original service, not any one-off extras added
      // during this visit.
      let rebooked = false;
      if (bookNext && booking.customer_id && rebookDate && rebookTime) {
        const rebookServiceId = booking.service_id;
        const durationMinutes = booking.service?.duration_minutes ?? 60;
        const startsAt = new Date(`${rebookDate}T${rebookTime}:00`);
        if (rebookServiceId && !isNaN(startsAt.getTime())) {
          const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
          const bookResult = await createBooking({
            customer_id: booking.customer_id, service_id: rebookServiceId,
            staff_id: performedByStaffId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
            source: 'manual',
          });
          if (!bookResult.ok) Alert.alert(t('owner:checkoutSheet.checkoutCompletedRebookFailedTitle'), bookResult.error);
          else rebooked = true;
        }
      }

      // Fallback nudge -- fire-and-forget, must never block/interrupt the
      // checkout-complete UI even if it fails. Only when the salon didn't
      // just rebook the customer inline above.
      if (!rebooked) {
        sendRebookNudge(booking.id).catch(() => {});
      }

      setResult(res.data);
      if (res.data.status === 'awaiting_card_payment') {
        const cardTender = finalTenders.find(t => t.method === 'card');
        if (cardTender) {
          const charge = cardChargeFromVisitDueCents(cardTender.amount_cents, preview.pass_stripe_fee);
          setCardResultInfo({ visitDueCents: cardTender.amount_cents, cardTotalCents: charge.totalChargeCents });
        }
      }
      if (res.data.status === 'completed') {
        setTimeout(onDone, 2200);
      }
    }

    async function copyLink(url: string) {
      await Clipboard.setStringAsync(url);
      setInfoModal({ title: t('owner:checkoutSheet.copiedTitle'), message: t('owner:checkoutSheet.linkCopiedMessage') });
    }

    async function emailLink(url: string) {
      if (!booking || !cardResultInfo) return;
      setEmailLinkSending(true);
      const res = await sendBalancePaymentEmail(booking.id, url, cardResultInfo.visitDueCents, cardResultInfo.cardTotalCents);
      setEmailLinkSending(false);
      if (!res.ok) setInfoModal({ title: t('owner:checkoutSheet.couldNotSendEmailTitle'), message: res.error });
      else setInfoModal({ title: t('owner:checkoutSheet.sentTitle'), message: t('owner:checkoutSheet.linkEmailedMessage') });
    }

    async function pushLink(url: string) {
      if (!booking || !cardResultInfo) return;
      setPushLinkSending(true);
      const res = await sendBalancePaymentPush(booking.id, url, cardResultInfo.cardTotalCents);
      setPushLinkSending(false);
      if (!res.ok) setInfoModal({ title: t('owner:checkoutSheet.couldNotSendNotificationTitle'), message: res.error });
      else setInfoModal({ title: t('owner:checkoutSheet.sentTitle'), message: t('owner:checkoutSheet.pushSentMessage') });
    }

    // Previously mirrored the web dashboard's "Collect card payment" panel
    // exactly, including a Visit balance/Card charge breakdown box -- removed
    // here per explicit request, so this screen now intentionally diverges
    // from the web dashboard's copy. cardResultInfo itself is untouched
    // (still needed by emailLink/pushLink below), only its on-screen
    // breakdown display is gone.
    if (result?.status === 'awaiting_card_payment' && result.payment_url) {
      const url = result.payment_url;
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="90%">
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>{t('owner:checkoutSheet.collectCardPayment')}</Text>
            <Text style={styles.hint}>
              {t('owner:checkoutSheet.collectCardPaymentHint')}
            </Text>

            <View style={styles.cardActionsRow}>
              <TouchableOpacity style={styles.cardActionPrimary} onPress={() => Linking.openURL(url)}>
                <Text style={styles.cardActionPrimaryText}>{t('owner:checkoutSheet.openPaymentPage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardActionSecondary} onPress={() => copyLink(url)}>
                <Text style={styles.cardActionSecondaryText}>{t('owner:checkoutSheet.copyLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardActionSecondary, !booking?.customer?.email && styles.cardActionDisabled]}
                onPress={() => emailLink(url)}
                disabled={!booking?.customer?.email || emailLinkSending}
              >
                <Text style={styles.cardActionSecondaryText}>{emailLinkSending ? t('owner:checkoutSheet.sending') : t('owner:checkoutSheet.emailLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardActionSecondary, !booking?.customer_id && styles.cardActionDisabled]}
                onPress={() => pushLink(url)}
                disabled={!booking?.customer_id || pushLinkSending}
              >
                <Text style={styles.cardActionSecondaryText}>{pushLinkSending ? t('owner:checkoutSheet.sending') : t('owner:checkoutSheet.sendAppNotification')}</Text>
              </TouchableOpacity>
            </View>
            {!booking?.customer?.email && (
              <Text style={styles.hint}>{t('owner:checkoutSheet.saveEmailHint')}</Text>
            )}
            <Text style={styles.hint}>{t('owner:checkoutSheet.appNotificationHint')}</Text>

            <View style={styles.qrBox}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}` }}
                style={styles.qrImage}
              />
              <Text style={styles.qrHint}>{t('owner:checkoutSheet.scanToPay')}</Text>
            </View>

            <TouchableOpacity style={styles.cancelCardRow} onPress={() => { setResult(null); setCardResultInfo(null); }}>
              <Text style={styles.cancelCardText}>{t('owner:checkoutSheet.cancelCardPayment')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneRow} onPress={onDone}>
              <Text style={styles.doneText}>{t('owner:checkoutSheet.doneForNow')}</Text>
            </TouchableOpacity>
          </ScrollView>
          <ConfirmModal
            visible={!!infoModal}
            title={infoModal?.title ?? ''}
            message={infoModal?.message}
            confirmLabel={t('owner:checkoutSheet.ok')}
            hideCancel
            onCancel={() => setInfoModal(null)}
            onConfirm={() => setInfoModal(null)}
          />
        </SheetModal>
      );
    }

    if (result?.status === 'completed') {
      return (
        <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="45%">
          <View style={styles.content}>
            <Text style={styles.successTitle}>{t('owner:checkoutSheet.paymentCollected')}</Text>
            <Text style={styles.successLine}>{t('owner:checkoutSheet.receiptSent')}</Text>
            <Text style={styles.successLine}>{t('owner:checkoutSheet.loyaltyUpdated')}</Text>
            <Text style={styles.successLine}>{bookNext ? t('owner:checkoutSheet.nextAppointmentBooked') : preview.rebook_suggestion ? t('owner:checkoutSheet.notBooked') : ''}</Text>
          </View>
        </SheetModal>
      );
    }

    return (
      <SheetModal visible={visible} onRequestClose={() => setVisible(false)} maxHeight="90%">
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>{t('owner:checkoutSheet.checkoutTitle')}</Text>

          {preview.checklist.every(c => c.ok) ? (
            <Text style={styles.checklistOk}>{t('owner:checkoutSheet.everythingLooksGood')}</Text>
          ) : (
            <View style={styles.checklistCard}>
              {preview.checklist.filter(c => !c.ok).map((c, i) => <Text key={i} style={styles.checklistItem}>⚠ {c.label}</Text>)}
            </View>
          )}

          {staff.filter(s => s.active).length > 1 && (
            <Section title={t('owner:checkoutSheet.performedBy')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {staff.filter(s => s.active).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, performedByStaffId === s.id && styles.chipActive]}
                    onPress={() => setPerformedByStaffId(s.id)}
                  >
                    <Text style={[styles.chipText, performedByStaffId === s.id && styles.chipTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.hint}>{t('owner:checkoutSheet.performedByHint')}</Text>
            </Section>
          )}

          {/* Invoice-style itemization — every service this visit is being
              charged for, each with its own editable price, instead of a
              single opaque "Subtotal" number. The original booked service
              is always the first line and can't be removed (it's what the
              appointment was for), only re-priced; added services get both. */}
          <Section title={t('owner:checkoutSheet.service')}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceItemName} numberOfLines={2}>{originalServiceName}</Text>
              <PriceInput
                value={priceEditText.original ?? (originalServicePriceCents / 100).toFixed(2)}
                onChangeText={handleOriginalPriceChange}
              />
            </View>
            {addedServices.map(s => (
              <View key={s.id} style={styles.invoiceRow}>
                <Text style={styles.invoiceItemName} numberOfLines={2}>+ {s.name}</Text>
                <PriceInput
                  value={priceEditText[s.id] ?? ((addedServicePriceOverrides[s.id] ?? s.price_cents) / 100).toFixed(2)}
                  onChangeText={(v) => handleAddedPriceChange(s.id, v)}
                />
                <TouchableOpacity onPress={() => removeAddedService(s.id)} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#F09595" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addRow} onPress={() => setShowServiceModal(true)}>
              <Ionicons name="add-circle-outline" size={16} color="#F4D77A" />
              <Text style={styles.linkText}>{t('owner:checkoutSheet.addService')}</Text>
            </TouchableOpacity>
          </Section>

          <Section title={t('owner:checkoutSheet.products')}>
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

          <Section title={t('owner:checkoutSheet.discount')}>
            <View style={styles.chipRow}>
              {[10, 15, 20].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.chip, !customDiscount && discountCents === Math.round(subtotal * pct / 100) && styles.chipActive]}
                  onPress={() => { setCustomDiscount(false); setDiscountCents(Math.round(subtotal * pct / 100)); }}
                >
                  <Text style={[styles.chipText, !customDiscount && discountCents === Math.round(subtotal * pct / 100) && styles.chipTextActive]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.chip, !customDiscount && discountCents === 0 && styles.chipActive]} onPress={() => { setCustomDiscount(false); setDiscountCents(0); }}>
                <Text style={[styles.chipText, !customDiscount && discountCents === 0 && styles.chipTextActive]}>{t('owner:checkoutSheet.none')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, customDiscount && styles.chipActive]} onPress={() => setCustomDiscount(true)}>
                <Text style={[styles.chipText, customDiscount && styles.chipTextActive]}>{t('owner:checkoutSheet.custom')}</Text>
              </TouchableOpacity>
            </View>
            {customDiscount && (
              <TextInput
                style={styles.input}
                placeholder={t('owner:checkoutSheet.discountAmountPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={customDiscountText}
                onChangeText={v => { setCustomDiscountText(v); setDiscountCents(Math.round((parseFloat(v) || 0) * 100)); }}
                keyboardType="decimal-pad"
              />
            )}
          </Section>

          <Section title={t('owner:checkoutSheet.tip')}>
            <View style={styles.chipRow}>
              {[18, 20, 25].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.chip, !customTip && tipCents === Math.round(subtotal * pct / 100) && styles.chipActive]}
                  onPress={() => { setCustomTip(false); setTipCents(Math.round(subtotal * pct / 100)); }}
                >
                  <Text style={[styles.chipText, !customTip && tipCents === Math.round(subtotal * pct / 100) && styles.chipTextActive]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.chip, !customTip && tipCents === 0 && styles.chipActive]} onPress={() => { setCustomTip(false); setTipCents(0); }}>
                <Text style={[styles.chipText, !customTip && tipCents === 0 && styles.chipTextActive]}>{t('owner:checkoutSheet.none')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, customTip && styles.chipActive]} onPress={() => setCustomTip(true)}>
                <Text style={[styles.chipText, customTip && styles.chipTextActive]}>{t('owner:checkoutSheet.custom')}</Text>
              </TouchableOpacity>
            </View>
            {customTip && (
              <TextInput
                style={styles.input}
                placeholder={t('owner:checkoutSheet.tipAmountPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={customTipText}
                onChangeText={v => { setCustomTipText(v); setTipCents(Math.round((parseFloat(v) || 0) * 100)); }}
                keyboardType="decimal-pad"
              />
            )}
          </Section>

          <BlurView intensity={90} tint="dark" style={styles.totalsCard}>
            <CardOverlay />
            <TotalRow label={t('owner:checkoutSheet.subtotal')} value={subtotal} />
            <TotalRow label={t('owner:checkoutSheet.discount')} value={-discountCents} />
            {/* Presentation-only: preview.tax.label is agency_clients.tax_label,
                a real per-business setting the owner can customize (see
                booking-app's checkout-preview route), defaulting server-side
                to the literal English string 'Tax'. Translate only that
                known default for display; a customized label (e.g. "VAT",
                "IVA") always passes through untouched. */}
            <TotalRow label={preview.tax.label === 'Tax' ? t('owner:checkoutSheet.taxDefaultLabel') : preview.tax.label} value={taxCents} />
            <TotalRow label={t('owner:checkoutSheet.tip')} value={tipCents} />
            <TotalRow label={t('owner:checkoutSheet.totalLabel')} value={total} bold />
            <TotalRow label={t('owner:checkoutSheet.remaining')} value={checkoutRemaining} bold color={checkoutRemaining === 0 ? '#4ADE80' : '#F09595'} />
          </BlurView>

          <Section title={t('owner:checkoutSheet.payment')}>
            {tenders.map((td, i) => (
              <View key={i} style={styles.tenderRow}>
                <Text style={styles.tenderText}>{TENDER_METHOD_LABELS[td.method]} — {money(td.amount_cents)}</Text>
                <TouchableOpacity onPress={() => setTenders(list => list.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close" size={16} color="#F09595" />
                </TouchableOpacity>
              </View>
            ))}
            {remaining > 0 && (
              <BlurView intensity={90} tint="dark" style={styles.addCard}>
                <CardOverlay />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(['cash', 'card', 'venmo', 'zelle', 'cashapp', 'gift_card', 'store_credit', 'other'] as const).map(m => (
                    <TouchableOpacity key={m} style={[styles.chip, tenderMethod === m && styles.chipActive]} onPress={() => setTenderMethod(m)}>
                      <Text style={[styles.chipText, tenderMethod === m && styles.chipTextActive]}>{TENDER_METHOD_LABELS[m]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {tenderMethod === 'gift_card' && (
                  <View style={styles.giftRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('owner:checkoutSheet.giftCardCodePlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={giftCode} onChangeText={setGiftCode} autoCapitalize="characters" />
                    <TouchableOpacity onPress={handleValidateGift}><Text style={styles.linkText}>{t('owner:checkoutSheet.check')}</Text></TouchableOpacity>
                  </View>
                )}
                {tenderMethod === 'gift_card' && giftBalance != null && (
                  <Text style={styles.hint}>{t('owner:checkoutSheet.balance', { balance: money(giftBalance) })}</Text>
                )}
                {tenderMethod === 'store_credit' && (
                  <Text style={styles.hint}>{t('owner:checkoutSheet.available', { balance: money(storeCreditBalance) })}</Text>
                )}
                <TextInput style={styles.input} placeholder={t('owner:checkoutSheet.amountPlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={tenderAmount} onChangeText={setTenderAmount} keyboardType="decimal-pad" />

                {/* Matches the web dashboard's own "Order Total" card exactly:
                    a separate, payment-method-specific summary, not folded into
                    the Subtotal/Tax/Tip breakdown above. The actual submitted
                    tender amount is still the real visit balance (`remaining`)
                    -- the backend grosses it up the same way the web app's own
                    checkout does; this box only previews what that comes out to. */}
                {cardFeePreview && cardFeePreview.stripeFeesCents > 0 && (
                  <View style={styles.orderTotalCard}>
                    <Text style={styles.orderTotalLabel}>{t('owner:checkoutSheet.orderTotal')}</Text>
                    <View style={styles.tenderRow}>
                      <Text style={styles.tenderTextPlain}>{t('owner:checkoutSheet.service')}</Text>
                      <Text style={styles.tenderTextPlain}>{money(remaining)}</Text>
                    </View>
                    <View style={styles.tenderRow}>
                      <Text style={styles.tenderTextPlain}>{t('owner:checkoutSheet.cardProcessingEstimate')}</Text>
                      <Text style={styles.tenderTextPlain}>+{money(cardFeePreview.stripeFeesCents)}</Text>
                    </View>
                    <View style={styles.orderTotalDueRow}>
                      <Text style={styles.orderTotalDueLabel}>{t('owner:checkoutSheet.totalDue')}</Text>
                      <Text style={styles.orderTotalDueValue}>{money(cardFeePreview.totalChargeCents)}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.inlineActions}>
                  <TouchableOpacity onPress={addTender}><Text style={styles.linkText}>{t('owner:checkoutSheet.addPayment')}</Text></TouchableOpacity>
                </View>
              </BlurView>
            )}
          </Section>

          {preview.rebook_suggestion && (
            <Section title={t('owner:checkoutSheet.rebook')}>
              <TouchableOpacity style={styles.rebookCard} onPress={() => setBookNext(v => !v)}>
                <Ionicons name={bookNext ? 'checkbox' : 'square-outline'} size={18} color="#F4D77A" />
                <Text style={styles.rebookText}>
                  {t('owner:checkoutSheet.suggestNextVisit', { days: preview.rebook_suggestion.interval_days })}
                </Text>
              </TouchableOpacity>
              {bookNext && rebookDate && rebookTime && (
                <TouchableOpacity style={styles.rebookDateRow} onPress={() => setShowRebookPicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color="#F4D77A" />
                  <Text style={styles.rebookDateText}>
                    {formatRebookDateTime(rebookDate, rebookTime)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </Section>
          )}

          <Text style={styles.hint}>{t('owner:checkoutSheet.receiptHint')}</Text>

          <TouchableOpacity style={[styles.primaryButton, checkoutRemaining !== 0 && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={submitting || checkoutRemaining !== 0}>
            {submitting ? <ActivityIndicator color="#09000F" /> : <Text style={styles.primaryButtonText}>{t('owner:checkoutSheet.completeCheckout')}</Text>}
          </TouchableOpacity>
        </ScrollView>

        {rebookDate && rebookTime && clientId && (
          <RebookDateTimeModal
            visible={showRebookPicker}
            initialDate={new Date(`${rebookDate}T${rebookTime}:00`)}
            salonId={clientId}
            serviceId={booking.service_id ?? null}
            staffId={performedByStaffId}
            onCancel={() => setShowRebookPicker(false)}
            onConfirm={(d) => { setRebookDate(toLocalDateStr(d)); setRebookTime(toLocalTimeStr(d)); setShowRebookPicker(false); }}
          />
        )}

        {/* Small popup picker for "Add service" — was an inline horizontal-
            scrolling chip row, which only worked while a salon had a
            handful of services; a real catalog just ran off-screen. A
            proper list in its own sheet scales to any size. Nested Modal
            (on top of this sheet's own Modal) is the same pattern already
            proven by RebookDateTimeModal/ConfirmModal above. */}
        <SheetModal visible={showServiceModal} onRequestClose={() => setShowServiceModal(false)} maxHeight="70%">
          <Text style={styles.sectionTitle}>{t('owner:checkoutSheet.selectServiceTitle')}</Text>
          <ScrollView contentContainerStyle={styles.serviceModalList}>
            {services.filter(s => !addedServices.some(a => a.id === s.id)).map(s => (
              <TouchableOpacity key={s.id} style={styles.serviceModalRow} onPress={() => addServiceFromModal(s)}>
                <Text style={styles.serviceModalName} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.serviceModalPrice}>{money(s.price_cents)}</Text>
              </TouchableOpacity>
            ))}
            {services.filter(s => !addedServices.some(a => a.id === s.id)).length === 0 && (
              <Text style={styles.hint}>{t('owner:checkoutSheet.noMoreServices')}</Text>
            )}
          </ScrollView>
        </SheetModal>
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

function PriceInput({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.priceInputWrap}>
      <Text style={styles.priceInputPrefix}>$</Text>
      <TextInput
        style={styles.priceInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
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
  cardActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cardActionPrimary: {
    backgroundColor: '#4ADE80', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  cardActionPrimaryText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
  cardActionSecondary: {
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  cardActionSecondaryText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  cardActionDisabled: { opacity: 0.4 },
  qrBox: { alignItems: 'center', marginTop: Spacing.sm },
  qrImage: { width: 160, height: 160, borderRadius: 10 },
  qrHint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  cancelCardRow: {
    marginTop: Spacing.xs, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 10,
  },
  cancelCardText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
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
  // Same visual style as tenderText but without textTransform:'capitalize' --
  // that transform title-cases every word, which is correct for a single
  // tender-method name (line ~597) but was incorrectly also applying to full
  // sentence labels in the Order Total breakdown below, turning "Card
  // processing estimate" into "Card Processing Estimate" in English and,
  // worse, "Procesamiento De Tarjeta (Estimado)" in Spanish.
  tenderTextPlain: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  invoiceItemName: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  priceInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.xs, paddingVertical: 4,
  },
  priceInputPrefix: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },
  priceInput: {
    width: 62, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', padding: 0,
  },
  serviceModalList: { gap: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  serviceModalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  serviceModalName: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  serviceModalPrice: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  addCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.sm, gap: Spacing.xs,
  },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orderTotalCard: {
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.sm, gap: 4,
  },
  orderTotalLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 0.6, color: 'rgba(255,255,255,0.45)', marginBottom: 2,
  },
  orderTotalDueRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 2,
    borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.2)',
  },
  orderTotalDueLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  orderTotalDueValue: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#4ADE80' },
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
  rebookDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingVertical: 10, paddingHorizontal: Spacing.sm,
  },
  rebookDateText: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
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
