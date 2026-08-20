import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { getSanaaConfig, provisionSanaaAgent, provisionSanaaNumber } from '@/lib/api/ownerSanaaConfig';
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
  title: 'Phone & Connectivity',
  headerBackTitle: 'SANAA',
};

function formatPhoneDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = digits.length === 11 ? digits.slice(1) : digits;
  if (local.length !== 10) return number;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

// P6: automated Telnyx number provisioning surface. Reads has_agent /
// telnyx_number from the existing /api/owner/sanaa/config (P5) rather than
// duplicating that fetch. Deliberately no live test-call button here --
// that's P7, not this slice.
export default function SanaaPhoneScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
  const [telnyxNumber, setTelnyxNumber] = useState<string | null>(null);
  const [transferNumber, setTransferNumber] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getSanaaConfig();
    if (result.ok) {
      setHasAgent(result.data.has_agent);
      setTelnyxNumber(result.data.telnyx_number);
      setTransferNumber(result.data.config.transfer_number);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // The agent is a prerequisite for a number, not a gate the owner has to
  // clear themselves -- this button creates it (or refreshes it, if one
  // already exists) before requesting a number, all in one tap.
  async function handleProvision() {
    setProvisioning(true);

    if (!hasAgent) {
      const agentResult = await provisionSanaaAgent();
      if (!agentResult.ok) {
        setProvisioning(false);
        Alert.alert('Could not set up SANAA', agentResult.error);
        return;
      }
      setHasAgent(true);
    }

    const result = await provisionSanaaNumber();
    setProvisioning(false);
    if (!result.ok) {
      Alert.alert('Could not get a number', result.error);
      return;
    }
    setTelnyxNumber(result.data.telnyx_number);
    Alert.alert('Number ready', `SANAA now has a dedicated number: ${formatPhoneDisplay(result.data.telnyx_number)}`);
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            {telnyxNumber ? (
              <View style={styles.statusRow}>
                <View style={styles.statusDotConnected} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Connected</Text>
                  <Text style={styles.statusValue}>{formatPhoneDisplay(telnyxNumber)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <View style={styles.statusDotPending} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Not connected yet</Text>
                  <Text style={styles.statusValue}>Choose an option below to give SANAA a number to answer.</Text>
                </View>
              </View>
            )}
          </BlurView>
        </View>

        {!telnyxNumber && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Get a Dedicated SANAA Number</Text>
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.optionBody}>
                  SANAA gets its own phone number, ready to answer calls immediately. Nothing to set up with your phone carrier.
                </Text>
                <TouchableOpacity
                  style={[styles.provisionButton, provisioning && styles.provisionButtonDisabled]}
                  onPress={handleProvision}
                  disabled={provisioning}
                >
                  <Text style={styles.provisionButtonText}>{provisioning ? 'Getting your number…' : 'Get My SANAA Number'}</Text>
                </TouchableOpacity>
              </BlurView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Keep Your Existing Number</Text>
              <BlurView intensity={90} tint="dark" style={styles.card}>
                <CardOverlay />
                <Text style={styles.optionBody}>
                  Forward your current business line to SANAA instead. Most phone carriers let you turn call forwarding on
                  from your phone's settings or by dialing a short code — check with your carrier for the exact steps.
                </Text>
                {transferNumber ? (
                  <Text style={styles.optionHint}>
                    Calls SANAA can't handle will still be sent to your transfer number: {formatPhoneDisplay(transferNumber)}
                  </Text>
                ) : (
                  <Text style={styles.optionHint}>
                    Set a human transfer number in Configure SANAA so callers can always reach a person.
                  </Text>
                )}
              </BlurView>
            </View>
          </>
        )}

        {telnyxNumber && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Human Transfer</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.statusRow}>
                <Ionicons name="call-outline" size={18} color="#F4D77A" />
                <Text style={styles.optionBody}>
                  {transferNumber
                    ? `Calls SANAA can't handle are sent to ${formatPhoneDisplay(transferNumber)}.`
                    : "No transfer number set yet — add one in Configure SANAA so callers can always reach a person."}
                </Text>
              </View>
            </BlurView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
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
  statusDotConnected: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80' },
  statusDotPending: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  statusValue: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  optionBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', lineHeight: FontSize.sm * 1.5 },
  optionHint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.sm },

  provisionButton: {
    marginTop: Spacing.md, alignSelf: 'flex-start', backgroundColor: '#F4D77A', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  provisionButtonDisabled: { opacity: 0.6 },
  provisionButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
});
