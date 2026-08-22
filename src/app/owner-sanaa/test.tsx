import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, AppState, AppStateStatus, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import {
  startSanaaTest,
  getSanaaTestStatus,
  confirmSanaaTest,
  SanaaTestState,
  SanaaTestCallEvidence,
} from '@/lib/api/ownerSanaaTest';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#0B0712' },
  headerTintColor: '#F4D77A',
  headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
  title: 'Test SANAA',
  headerBackTitle: 'SANAA',
};

const CHECKLIST = [
  'Ask about the business — hours, services, or location',
  'Try an appointment conversation — book, reschedule, or cancel',
  'Ask to speak to a human — confirm the transfer works',
];

function formatPhoneDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = digits.length === 11 ? digits.slice(1) : digits;
  if (local.length !== 10) return number;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

// P7 real Test flow. Completion requires two independent things to both be
// true: a real Telnyx-answered call verified server-side (never trusted
// from this screen), AND the owner's explicit confirmation tap. Pressing
// "Start Test Call" alone, or "Yes — Continue" alone, can never complete
// Test on their own -- see /api/owner/sanaa/test/confirm.
export default function SanaaTestScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<SanaaTestState>('not_started');
  const [telnyxNumber, setTelnyxNumber] = useState<string | null>(null);
  const [call, setCall] = useState<SanaaTestCallEvidence | null>(null);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const awaitingReturn = useRef(false);

  const refreshStatus = useCallback(async () => {
    const result = await getSanaaTestStatus();
    if (result.ok) {
      setState(result.data.state);
      setTelnyxNumber(result.data.telnyx_number);
      setCall(result.data.call);
      return true;
    }
    setLoadError(result.error);
    return false;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    await refreshStatus();
    setLoading(false);
  }, [refreshStatus]);

  useEffect(() => { load(); }, [load]);

  // When the owner comes back from the phone app after a Start Test Call
  // tap, surface the "Check Call Status" step automatically instead of
  // requiring an extra manual pull -- still just a read, no auto-complete.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && awaitingReturn.current) {
        awaitingReturn.current = false;
        refreshStatus();
      }
    });
    return () => sub.remove();
  }, [refreshStatus]);

  async function handleStartTest() {
    setStarting(true);
    const result = await startSanaaTest();
    setStarting(false);
    if (!result.ok) {
      Alert.alert('Could not start test', result.error);
      return;
    }
    setState('test_started');
    setTelnyxNumber(result.data.telnyx_number);
    setCall(null);
    awaitingReturn.current = true;
    const dialUrl = `tel:${result.data.telnyx_number}`;
    const canOpen = await Linking.canOpenURL(dialUrl);
    if (!canOpen) {
      Alert.alert('Could not open dialer', `Call ${formatPhoneDisplay(result.data.telnyx_number)} manually to test SANAA.`);
      return;
    }
    Linking.openURL(dialUrl);
  }

  async function handleCheckStatus() {
    setChecking(true);
    const ok = await refreshStatus();
    setChecking(false);
    if (!ok) return;
  }

  async function handleConfirm() {
    setConfirming(true);
    const result = await confirmSanaaTest();
    setConfirming(false);
    if (!result.ok) {
      Alert.alert('Not confirmed yet', result.error);
      await refreshStatus();
      return;
    }
    setState('test_completed');
  }

  async function handleTestAgain() {
    setCall(null);
    await handleStartTest();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <BreathingHeart size={40} color="#F4D77A" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <ErrorState message={loadError} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={HEADER_OPTIONS} />
      <ScrollView contentContainerStyle={styles.content}>
        {state === 'test_completed' ? (
          <View style={styles.section}>
            <View style={styles.hero}>
              <Ionicons name="checkmark-circle" size={48} color="#4ADE80" />
              <Text style={styles.heroTitle}>✓ Test Complete</Text>
              <Text style={styles.heroBody}>SANAA is ready for your customers.</Text>
              <Text style={styles.heroBody}>
                Your test call was successful. SANAA is live and ready to answer your customers.
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(owner)/sanaa' as never)}>
              <Text style={styles.primaryButtonText}>Go to SANAA</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Test Your SANAA</Text>
              <Text style={styles.heroBody}>
                She's connected. Now let's make sure she's ready for your customers.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your SANAA Number</Text>
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <View style={styles.statusRow}>
                  <Ionicons name="call-outline" size={20} color="#F4D77A" />
                  <Text style={styles.numberText}>
                    {telnyxNumber ? formatPhoneDisplay(telnyxNumber) : 'Not available'}
                  </Text>
                </View>
              </BlurView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>While You're On The Call</Text>
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                {CHECKLIST.map((item, i) => (
                  <View key={item} style={[styles.checklistRow, i > 0 && styles.rowBorder]}>
                    <Ionicons name="ellipse-outline" size={14} color="#F4D77A" />
                    <Text style={styles.checklistText}>{item}</Text>
                  </View>
                ))}
              </BlurView>
              <Text style={styles.hint}>
                This is a real test call — SANAA will answer like she would for any customer, but nothing here counts as a real booking unless you make one.
              </Text>
            </View>

            {state === 'not_started' && (
              <TouchableOpacity
                style={[styles.primaryButton, starting && styles.buttonDisabled]}
                onPress={handleStartTest}
                disabled={starting}
              >
                <Text style={styles.primaryButtonText}>{starting ? 'Starting…' : 'Start Test Call'}</Text>
              </TouchableOpacity>
            )}

            {state === 'test_started' && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.primaryButton, checking && styles.buttonDisabled]}
                  onPress={handleCheckStatus}
                  disabled={checking}
                >
                  <Text style={styles.primaryButtonText}>{checking ? 'Checking…' : 'Check Call Status'}</Text>
                </TouchableOpacity>
                <Text style={styles.hint}>
                  We haven't confirmed a completed SANAA call yet. Finish the call, then check again.
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleStartTest} disabled={starting}>
                  <Text style={styles.secondaryButtonText}>Call SANAA Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {state === 'call_verified' && (
              <View style={styles.section}>
                <View style={styles.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                  <Text style={styles.verifiedText}>SANAA answered ✓</Text>
                </View>
                {call?.duration_seconds != null && (
                  <Text style={styles.hint}>Call lasted {Math.round(call.duration_seconds / 60) || 1} min.</Text>
                )}
                <Text style={styles.confirmPrompt}>Did SANAA sound and behave correctly?</Text>
                <TouchableOpacity
                  style={[styles.primaryButton, confirming && styles.buttonDisabled]}
                  onPress={handleConfirm}
                  disabled={confirming}
                >
                  <Text style={styles.primaryButtonText}>{confirming ? 'Confirming…' : 'Yes — Continue'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleTestAgain} disabled={starting}>
                  <Text style={styles.secondaryButtonText}>Test Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  heroTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: '#FFFFFF', marginTop: Spacing.sm, textAlign: 'center' },
  heroBody: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  numberText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  checklistText: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
  hint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.xs },
  primaryButton: {
    borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 16, alignItems: 'center',
  },
  primaryButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
  buttonDisabled: { opacity: 0.6 },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  verifiedText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.lg, color: '#4ADE80' },
  confirmPrompt: {
    fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF', textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
