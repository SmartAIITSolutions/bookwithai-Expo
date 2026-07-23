import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  Alert, KeyboardAvoidingView, Platform, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { isValidEmail, isValidPhone, getPasswordError } from '@/lib/validation';
import { API_BASE } from '@/lib/config';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
const HOW_HEARD_REFERRAL = 'Friends referral';

type Step = 1 | 2 | 3 | 4;
type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type DayHours = { open: boolean; start: string; end: string };

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_HOURS: Record<DayKey, DayHours> = {
  Mon: { open: true,  start: '09:00', end: '18:00' },
  Tue: { open: true,  start: '09:00', end: '18:00' },
  Wed: { open: true,  start: '09:00', end: '18:00' },
  Thu: { open: true,  start: '09:00', end: '18:00' },
  Fri: { open: true,  start: '09:00', end: '18:00' },
  Sat: { open: true,  start: '09:00', end: '17:00' },
  Sun: { open: false, start: '10:00', end: '15:00' },
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function ProgressDots({ step }: { step: Step }) {
  return (
    <View style={styles.dotsRow}>
      {([1, 2, 3, 4] as Step[]).map((s) => (
        <View
          key={s}
          style={[
            styles.dot,
            s === step && styles.dotActive,
            s < step && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, selected && styles.pillSelected]} onPress={onPress}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function OwnerSignupInner() {
  const { refreshProfile } = useAuth();
  const stripe = useStripe();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dupChecking, setDupChecking] = useState(false);

  // Step 1 — business + account + address
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName]       = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity]                 = useState('');
  const [stateVal, setStateVal]         = useState('');
  const [postalCode, setPostalCode]     = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Step 2 — business profile
  const [bizType, setBizType]     = useState('');
  const [staffCount, setStaffCount] = useState('');
  const [howHeard, setHowHeard]   = useState('');
  const [referralFriendName, setReferralFriendName] = useState('');
  const [referralFriendBusiness, setReferralFriendBusiness] = useState('');

  // Step 3 — booking page + hours + account creation
  const [slug, setSlug]     = useState('');
  const [hours, setHours]   = useState<Record<DayKey, DayHours>>(DEFAULT_HOURS);
  const [clientId, setClientId] = useState<string | null>(null);

  // Step 4 — Stripe Connect + card on file
  const [connectStatus, setConnectStatus] = useState<'loading' | 'none' | 'pending' | 'complete'>('none');
  const [connectLoading, setConnectLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardSaving, setCardSaving]     = useState(false);
  const [cardSaved, setCardSaved]       = useState(false);

  useEffect(() => {
    setSlug(slugify(businessName));
  }, [businessName]);

  useEffect(() => {
    setGeoStatus('idle');
    setGeoCoords(null);
  }, [addressLine1, addressLine2, city, stateVal, postalCode]);

  async function checkStripeStatus(id: string) {
    setConnectStatus('loading');
    const headers = await authHeaders();
    if (!headers) { setConnectStatus('none'); return; }
    try {
      const res  = await fetch(`${API_BASE}/api/stripe/connect/status?client_id=${id}`, { headers });
      const json = await res.json() as { has_account?: boolean; onboarding_complete?: boolean };
      if (!res.ok) { setConnectStatus('none'); return; }
      if (json.onboarding_complete) setConnectStatus('complete');
      else if (json.has_account) setConnectStatus('pending');
      else setConnectStatus('none');
    } catch {
      setConnectStatus('none');
    }
  }

  useEffect(() => {
    if (step === 4 && clientId) void checkStripeStatus(clientId);
  }, [step, clientId]);

  function toggleDay(day: DayKey) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: !prev[day].open } }));
  }
  function updateHour(day: DayKey, field: 'start' | 'end', value: string) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  function validateStep1(): string | null {
    if (!businessName.trim()) return 'Business name is required.';
    if (!ownerName.trim())    return 'Your name is required.';
    if (!isValidEmail(email)) return 'A valid email is required.';
    if (!isValidPhone(phone)) return 'A valid phone number is required.';
    const pwError = getPasswordError(password);
    if (pwError) return pwError;
    if (!addressLine1.trim()) return 'Street address is required.';
    if (!city.trim())         return 'City is required.';
    if (!stateVal.trim())     return 'State is required.';
    if (!postalCode.trim())   return 'ZIP code is required.';
    if (geoStatus !== 'verified') return 'Please verify your address before continuing.';
    return null;
  }

  async function handleVerifyAddress() {
    if (!addressLine1.trim() || !city.trim() || !stateVal.trim() || !postalCode.trim()) {
      setError('Fill in the address fields before verifying.');
      return;
    }
    setError('');
    setGeoStatus('checking');
    try {
      // Android's Geocoder silently returns an empty result (rather than
      // throwing) when the app doesn't hold location permission -- request
      // it first so a real "address not found" isn't confused with a
      // permission gap.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to verify your address. Please allow it and try again.');
        setGeoStatus('failed');
        return;
      }
      const full = `${addressLine1.trim()}, ${addressLine2.trim() ? addressLine2.trim() + ', ' : ''}${city.trim()}, ${stateVal.trim()} ${postalCode.trim()}`;
      const results = await Location.geocodeAsync(full);
      if (results.length > 0) {
        setGeoCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
        setGeoStatus('verified');
      } else {
        setGeoStatus('failed');
      }
    } catch (e) {
      console.error('[owner-signup] address geocode failed:', e);
      setGeoStatus('failed');
    }
  }

  function openInMaps() {
    if (!geoCoords) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${geoCoords.latitude},${geoCoords.longitude}`);
  }

  async function handleStep1Continue() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setDupChecking(true);
    try {
      const res  = await fetch(`${API_BASE}/api/signup/check-duplicate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), phone }),
      });
      const json = await res.json() as { duplicate?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not verify — try again.'); setDupChecking(false); return; }
      if (json.duplicate) {
        setError('An account may already exist for this email or phone. Please sign in instead.');
        setDupChecking(false);
        return;
      }
    } catch {
      setError('Could not verify — check your connection and try again.');
      setDupChecking(false);
      return;
    }
    setDupChecking(false);
    setStep(2);
  }

  function validateStep2(): string | null {
    if (!bizType)    return 'Please select your business type.';
    if (!staffCount) return 'Please select your team size.';
    if (!howHeard)   return 'Please tell us how you heard about us.';
    if (howHeard === HOW_HEARD_REFERRAL) {
      if (!referralFriendName.trim())     return "Please enter your friend's name.";
      if (!referralFriendBusiness.trim()) return "Please enter your friend's business name.";
    }
    return null;
  }

  function handleStep2Continue() {
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError('');
    setStep(3);
  }

  async function handleCreateAccount() {
    setError('');
    setLoading(true);
    // Wrapped in try/catch/finally (matching handleConnectStripe below) --
    // without it, a thrown exception anywhere in this chain (a real network
    // failure, not just a Supabase-shaped {error} response) would skip every
    // setLoading(false) call below and leave the wizard's Continue button
    // spinning forever with no way to retry.
    try {
      const howHeardStored = howHeard === HOW_HEARD_REFERRAL
        ? `${HOW_HEARD_REFERRAL} — Friend: ${referralFriendName.trim()}, Business: ${referralFriendBusiness.trim()}`
        : howHeard;

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authErr || !authData.user) {
        setError(authErr?.message ?? 'Could not create account. Email may already be in use.');
        return;
      }

      const bonusExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: clientData, error: clientErr } = await supabase
        .from('agency_clients')
        .insert({
          user_id:                 authData.user.id,
          business_name:           businessName.trim(),
          owner_name:              ownerName.trim(),
          owner_email:             email.trim().toLowerCase(),
          owner_phone:             phone.trim(),
          address_line1:           addressLine1.trim(),
          address_line2:           addressLine2.trim() || null,
          city:                    city.trim(),
          state:                   stateVal.trim(),
          postal_code:             postalCode.trim(),
          slug,
          plan_tier:               1,
          status:                  'active',
          theme:                   'nebula',
          is_beta:                 false,
          signup_bonus_expires_at: bonusExpiry,
          business_hours:          hours,
          business_type:           bizType,
          staff_count:             staffCount,
          how_they_heard:          howHeardStored,
          require_online_payment: true,
          pass_stripe_fee:        true,
        })
        .select('id')
        .single();

      if (clientErr || !clientData) {
        await supabase.auth.signOut();
        setError(clientErr?.message ?? 'Account could not be saved. Please try again or contact support@bookwithai.app');
        return;
      }

      // profiles.role defaults to 'customer' via a DB trigger on every new
      // auth.users row -- flip it to 'owner' and link the salon now, so this
      // account routes to the owner dashboard everywhere role is checked.
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'owner', client_id: clientData.id })
        .eq('id', authData.user.id);
      if (profileErr) {
        console.error('Failed to set owner role on profiles row:', profileErr.message);
      }

      setClientId(clientData.id as string);
      await refreshProfile();
      setStep(4);

      void (async () => {
        const headers = await authHeaders();
        if (!headers) return;
        fetch(`${API_BASE}/api/signup/welcome-email`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ client_id: clientData.id }),
        }).catch(() => { /* welcome email is best-effort */ });
      })();
    } catch {
      setError('Could not create account. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectStripe() {
    if (!clientId) return;
    setConnectLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      if (!headers) { setError('Not signed in.'); setConnectLoading(false); return; }
      const res  = await fetch(`${API_BASE}/api/stripe/connect?client_id=${clientId}&from=mobile`, { headers });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Could not start Stripe connection');
        setConnectLoading(false);
        return;
      }
      await WebBrowser.openBrowserAsync(json.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#09000F',
        controlsColor: '#F4D77A',
      });
      await checkStripeStatus(clientId);
    } catch {
      setError('Could not reach Stripe. Please try again.');
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleSaveCard() {
    if (!clientId) return;
    setCardSaving(true);
    setError('');
    try {
      const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({
        paymentMethodType: 'Card',
      });
      if (pmErr || !paymentMethod) {
        setError(pmErr?.message ?? 'Card validation failed');
        return;
      }
      const headers = await authHeaders();
      if (!headers) { setError('Not signed in.'); return; }
      const res  = await fetch(`${API_BASE}/api/stripe/save-card`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ client_id: clientId, payment_method_id: paymentMethod.id }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not save card');
        return;
      }
      setCardSaved(true);
    } catch {
      setError('Could not reach Stripe. Please try again.');
    } finally {
      setCardSaving(false);
    }
  }

  function handleFinish() {
    router.replace('/(owner)/dashboard');
  }

  function handleBack() {
    if (step === 1) { router.back(); return; }
    setError('');
    setStep((step - 1) as Step);
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <View style={styles.header}>
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#F4D77A" />
              </Pressable>
              <Text style={styles.title}>Set Up Your Business</Text>
              <View style={styles.backBtn} />
            </View>

            <ProgressDots step={step} />

            {/* ── STEP 1 — Business + Account + Address ── */}
            {step === 1 && (
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.stepLabel}>Step 1 of 4 — Your Business</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Business name *</Text>
                  <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Glamour Studio" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="words" />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Your full name *</Text>
                  <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Sarah Johnson" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="words" />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email *</Text>
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@salon.com" placeholderTextColor="rgba(255,255,255,0.4)" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone *</Text>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(901) 555-0100" placeholderTextColor="rgba(255,255,255,0.4)" keyboardType="phone-pad" />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password *</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min. 8 characters"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.sectionDivider}>Business Address</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Street address *</Text>
                  <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="123 Main St" placeholderTextColor="rgba(255,255,255,0.4)" />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Suite / unit (optional)</Text>
                  <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Suite 200" placeholderTextColor="rgba(255,255,255,0.4)" />
                </View>
                <View style={styles.row3}>
                  <View style={[styles.fieldGroup, { flex: 1.4 }]}>
                    <Text style={styles.label}>City *</Text>
                    <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Memphis" placeholderTextColor="rgba(255,255,255,0.4)" />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>State *</Text>
                    <TextInput style={styles.input} value={stateVal} onChangeText={setStateVal} placeholder="TN" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="characters" />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>ZIP *</Text>
                    <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="38103" placeholderTextColor="rgba(255,255,255,0.4)" keyboardType="number-pad" />
                  </View>
                </View>

                <Pressable style={styles.verifyBtn} onPress={handleVerifyAddress} disabled={geoStatus === 'checking'}>
                  {geoStatus === 'checking'
                    ? <BreathingHeart size={16} color="#F4D77A" />
                    : <Ionicons name="location-outline" size={16} color="#F4D77A" />
                  }
                  <Text style={styles.verifyBtnText}>
                    {geoStatus === 'checking' ? 'Verifying…' : 'Verify address'}
                  </Text>
                </Pressable>

                {geoStatus === 'verified' && (
                  <View style={styles.geoBannerOk}>
                    <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                    <Text style={styles.geoBannerOkText}>Address verified</Text>
                    <Pressable onPress={openInMaps} style={{ marginLeft: 'auto' }}>
                      <Text style={styles.geoMapLink}>View on map</Text>
                    </Pressable>
                  </View>
                )}
                {geoStatus === 'failed' && (
                  <View style={styles.geoBannerWarn}>
                    <Ionicons name="warning-outline" size={16} color="#FBBF24" />
                    <Text style={styles.geoBannerWarnText}>Couldn't verify this address — please double-check it.</Text>
                  </View>
                )}

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={[styles.primaryBtn, dupChecking && { opacity: 0.7 }]} onPress={handleStep1Continue} disabled={dupChecking}>
                  {dupChecking ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.primaryBtnText}>Continue →</Text>}
                </Pressable>
              </BlurView>
            )}

            {/* ── STEP 2 — Business Profile ── */}
            {step === 2 && (
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.stepLabel}>Step 2 of 4 — Your Setup</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Business type *</Text>
                  <View style={styles.pillRow}>
                    {['Salon', 'Spa', 'Barbershop', 'Other'].map((t) => (
                      <Pill key={t} label={t} selected={bizType === t} onPress={() => setBizType(t)} />
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Team size *</Text>
                  <View style={styles.pillRow}>
                    {['Just me', '2–3', '4–6', '7+'].map((t) => (
                      <Pill key={t} label={t} selected={staffCount === t} onPress={() => setStaffCount(t)} />
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>How did you hear about us? *</Text>
                  <View style={styles.pillRow}>
                    {['Facebook', 'Instagram', 'Google', 'Other', HOW_HEARD_REFERRAL].map((t) => (
                      <Pill
                        key={t}
                        label={t === HOW_HEARD_REFERRAL ? 'Friend referral' : t}
                        selected={howHeard === t}
                        onPress={() => {
                          setHowHeard(t);
                          if (t !== HOW_HEARD_REFERRAL) {
                            setReferralFriendName('');
                            setReferralFriendBusiness('');
                          }
                        }}
                      />
                    ))}
                  </View>
                </View>

                {howHeard === HOW_HEARD_REFERRAL && (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Friend's name *</Text>
                      <TextInput style={styles.input} value={referralFriendName} onChangeText={setReferralFriendName} placeholder="Full name" placeholderTextColor="rgba(255,255,255,0.4)" />
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Friend's business name *</Text>
                      <TextInput style={styles.input} value={referralFriendBusiness} onChangeText={setReferralFriendBusiness} placeholder="Salon or business they run" placeholderTextColor="rgba(255,255,255,0.4)" />
                    </View>
                  </>
                )}

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={styles.primaryBtn} onPress={handleStep2Continue}>
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </Pressable>
              </BlurView>
            )}

            {/* ── STEP 3 — Booking Page + Hours ── */}
            {step === 3 && (
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.stepLabel}>Step 3 of 4 — Your Booking Page</Text>

                <View style={styles.linkPreview}>
                  <Text style={styles.linkPreviewLabel}>Your booking link</Text>
                  <Text style={styles.linkPreviewValue}>
                    bookwithai.app/<Text style={{ color: '#F4D77A', fontFamily: FontFamily.soraSemiBold }}>{slug || '...'}</Text>
                  </Text>
                  <Text style={styles.linkPreviewHint}>Customize this after signing up from your dashboard.</Text>
                </View>

                <Text style={styles.label}>Business hours *</Text>
                {DAYS.map((day) => (
                  <View key={day} style={styles.dayRow}>
                    <Switch
                      value={hours[day].open}
                      onValueChange={() => toggleDay(day)}
                      trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(244,215,122,0.5)' }}
                      thumbColor={hours[day].open ? '#F4D77A' : '#f4f3f4'}
                    />
                    <Text style={styles.dayLabel}>{day}</Text>
                    {hours[day].open ? (
                      <View style={styles.dayTimeRow}>
                        <TextInput
                          style={styles.timeInput}
                          value={hours[day].start}
                          onChangeText={(v) => updateHour(day, 'start', v)}
                          placeholder="09:00"
                          placeholderTextColor="rgba(255,255,255,0.35)"
                        />
                        <Text style={styles.dayTo}>to</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={hours[day].end}
                          onChangeText={(v) => updateHour(day, 'end', v)}
                          placeholder="18:00"
                          placeholderTextColor="rgba(255,255,255,0.35)"
                        />
                      </View>
                    ) : (
                      <Text style={styles.dayClosed}>Closed</Text>
                    )}
                  </View>
                ))}

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleCreateAccount} disabled={loading}>
                  {loading ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.primaryBtnText}>Create Account →</Text>}
                </Pressable>
              </BlurView>
            )}

            {/* ── STEP 4 — Stripe Connect + Card on File ── */}
            {step === 4 && (
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.stepLabel}>Step 4 of 4 — One Last Thing</Text>
                <Text style={styles.stepSub}>You can set these up anytime from your dashboard.</Text>

                <View style={styles.stripeBox}>
                  <View style={styles.stripeBoxHeader}>
                    <View style={styles.stripeIconWrap}>
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stripeTitle}>Stripe Connect</Text>
                      <Text style={styles.stripeSub}>Payouts go directly to your bank</Text>
                    </View>
                    {connectStatus === 'complete' && (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>✓ Connected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.stripeDesc}>
                    Securely connect your bank account to start collecting payments automatically. A 1% platform fee applies per transaction.
                  </Text>
                  {connectStatus === 'loading' && (
                    <Text style={styles.stripeChecking}>Checking Stripe status…</Text>
                  )}
                  {(connectStatus === 'none' || connectStatus === 'pending') && (
                    <Pressable style={styles.stripeConnectBtn} onPress={handleConnectStripe} disabled={connectLoading}>
                      {connectLoading
                        ? <BreathingHeart size={16} color="#FFFFFF" />
                        : <Text style={styles.stripeConnectBtnText}>
                            {connectStatus === 'pending' ? 'Continue Stripe setup →' : 'Connect with Stripe →'}
                          </Text>
                      }
                    </Pressable>
                  )}
                </View>

                <View style={[styles.cardBox, cardSaved && styles.cardBoxSaved]}>
                  <View style={styles.stripeBoxHeader}>
                    <Text style={styles.stripeTitle}>Add a card on file</Text>
                    {cardSaved && <Text style={styles.connectedBadgeText}>✓ Saved</Text>}
                  </View>
                  <Text style={styles.stripeDesc}>Used for unlocking features and add-ons. Not charged today.</Text>

                  {!cardSaved && (
                    <>
                      <CardField
                        postalCodeEnabled={false}
                        style={{ width: '100%', height: 44, marginBottom: Spacing.sm }}
                        cardStyle={{ backgroundColor: '#1A1220', textColor: '#FFFFFF', borderRadius: 10 }}
                        onCardChange={(details) => setCardComplete(details.complete)}
                      />
                      <Pressable
                        style={[styles.saveCardBtn, (!cardComplete || cardSaving) && { opacity: 0.5 }]}
                        onPress={handleSaveCard}
                        disabled={!cardComplete || cardSaving}>
                        {cardSaving ? <BreathingHeart size={16} color="#FFFFFF" /> : <Text style={styles.saveCardBtnText}>Save card</Text>}
                      </Pressable>
                    </>
                  )}
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={styles.primaryBtn} onPress={handleFinish}>
                  <Text style={styles.primaryBtnText}>Finish setup →</Text>
                </Pressable>
                <Pressable style={styles.skipBtn} onPress={handleFinish}>
                  <Text style={styles.skipBtnText}>Set up from dashboard later</Text>
                </Pressable>
              </BlurView>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export default function OwnerSignupScreen() {
  return (
    <StripeProvider publishableKey={STRIPE_PK}>
      <OwnerSignupInner />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  dotsRow: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 18, backgroundColor: '#F4D77A' },
  dotDone: { backgroundColor: '#4ADE80' },

  card: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    gap: Spacing.md,
  },
  stepLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#F4D77A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: -Spacing.sm,
  },

  fieldGroup: { gap: Spacing.xs },
  label: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, justifyContent: 'center' },

  sectionDivider: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#F4D77A',
    marginTop: Spacing.xs,
  },
  row3: { flexDirection: 'row', gap: Spacing.sm },

  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
  },
  verifyBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },

  geoBannerOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  geoBannerOkText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#4ADE80' },
  geoMapLink: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A', textDecorationLine: 'underline' },
  geoBannerWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  geoBannerWarnText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FBBF24', flex: 1 },

  errorText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#F09595' },

  primaryBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },

  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipBtnText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillSelected: { borderColor: '#F4D77A', backgroundColor: 'rgba(244,215,122,0.15)' },
  pillText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.68)' },
  pillTextSelected: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },

  linkPreview: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    gap: 2,
  },
  linkPreviewLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkPreviewValue: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
  linkPreviewHint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)' },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF', width: 34 },
  dayTimeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayTo: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  dayClosed: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },

  stripeBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(99,91,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,91,255,0.3)',
    gap: Spacing.sm,
  },
  stripeBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stripeIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#635BFF',
    alignItems: 'center', justifyContent: 'center',
  },
  stripeTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  stripeSub: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  stripeDesc: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', lineHeight: FontSize.xs * 1.5 },
  stripeChecking: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)' },
  stripeConnectBtn: {
    backgroundColor: '#635BFF',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  stripeConnectBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  connectedBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  connectedBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#4ADE80' },

  cardBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: Spacing.sm,
  },
  cardBoxSaved: { borderColor: 'rgba(74,222,128,0.4)' },
  saveCardBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  saveCardBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
});
