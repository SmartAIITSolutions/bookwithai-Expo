import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { getBusiness } from '@/lib/api/ownerBusiness';
import {
  getStripeConnectStatus,
  getStripeConnectUrl,
  disconnectStripe,
  StripeConnectStatus,
} from '@/lib/api/ownerStripeConnect';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Mirrors web's PayoutsView ConnectSection (src/components/client/PayoutsView.tsx)
// and reuses the exact backend endpoints the owner-signup wizard already
// wires up for mobile (from=mobile -> Stripe's return_url lands on the web
// app's static /signup/mobile-done page; there's no session to resume into,
// so we just re-poll status once the in-app browser closes).
export default function PaymentsScreen() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const loadStatus = useCallback(async (id: string) => {
    const result = await getStripeConnectStatus(id);
    if (result.ok) setStatus(result.data);
  }, []);

  useEffect(() => {
    (async () => {
      const result = await getBusiness();
      if (result.ok) {
        setClientId(result.data.business.id);
        await loadStatus(result.data.business.id);
      }
      setLoading(false);
    })();
  }, [loadStatus]);

  async function handleConnect() {
    if (!clientId) return;
    setConnectLoading(true);
    const result = await getStripeConnectUrl(clientId);
    if (!result.ok) {
      Alert.alert('Could not start Stripe connection', result.error);
      setConnectLoading(false);
      return;
    }
    await WebBrowser.openBrowserAsync(result.data.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#09000F',
      controlsColor: '#F4D77A',
    });
    await loadStatus(clientId);
    setConnectLoading(false);
  }

  function handleDisconnect() {
    if (!clientId) return;
    Alert.alert(
      'Disconnect Stripe?',
      'This unlinks your payout account. You can reconnect any time, but online card payments will stop working until you do.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnectLoading(true);
            const result = await disconnectStripe(clientId);
            if (!result.ok) Alert.alert('Could not disconnect', result.error);
            else await loadStatus(clientId);
            setDisconnectLoading(false);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <DualBreathingBackground />
        <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Payments', headerBackTitle: 'More' }} />
        <View style={styles.centerFill}>
          <ActivityIndicator color="#F4D77A" />
        </View>
      </View>
    );
  }

  const isConnected = status?.has_account && status.onboarding_complete;
  const isPending = status?.has_account && !status.onboarding_complete;

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Payments', headerBackTitle: 'More' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stripe Connect</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />

            <Text style={styles.statusText}>
              {isConnected
                ? '✓ Bank connected'
                : isPending
                ? 'Setup incomplete — continue onboarding'
                : 'Not connected yet'}
            </Text>
            <Text style={styles.emptyHint}>
              {isConnected
                ? 'Payouts and online card payments go directly to your bank.'
                : 'Connect a bank account with Stripe to accept online card payments and receive payouts.'}
            </Text>

            {!status?.has_account ? (
              <TouchableOpacity style={styles.saveButton} onPress={handleConnect} disabled={connectLoading}>
                {connectLoading ? (
                  <ActivityIndicator color="#09000F" />
                ) : (
                  <Text style={styles.saveButtonText}>Connect bank account</Text>
                )}
              </TouchableOpacity>
            ) : isPending ? (
              <>
                <TouchableOpacity style={styles.saveButton} onPress={handleConnect} disabled={connectLoading}>
                  {connectLoading ? (
                    <ActivityIndicator color="#09000F" />
                  ) : (
                    <Text style={styles.saveButtonText}>Continue Stripe setup</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDisconnect} disabled={disconnectLoading}>
                  <Text style={styles.disconnectText}>
                    {disconnectLoading ? 'Disconnecting…' : 'Disconnect and start over'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={handleDisconnect} disabled={disconnectLoading}>
                <Text style={styles.disconnectText}>
                  {disconnectLoading ? 'Disconnecting…' : 'Disconnect bank'}
                </Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  section: { gap: Spacing.xs },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.md,
  },
  statusText: { fontFamily: FontFamily.soraSemiBold, fontSize: 15, color: '#FFFFFF' },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  saveButton: {
    backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  saveButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
  disconnectText: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 13, color: '#F09595', textAlign: 'center',
  },
});
