import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { fetchLatestAppVersion, isVersionNewer } from '@/lib/api/appVersion';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const DISMISSED_VERSION_KEY = 'bwa_update_nag_dismissed_version';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6793853590',
  android: 'market://details?id=app.bookwithai.app',
  default: '',
});
const STORE_URL_FALLBACK = 'https://play.google.com/store/apps/details?id=app.bookwithai.app';

// App-wide "a newer version exists" nudge — dismissible, checked once per
// launch. Fails open (no modal) on any network/parse error so a version-check
// outage can never block the app itself. Remembers the dismissed version so
// it doesn't re-nag every single launch once someone's said "Later".
export function UpdateNagModal() {
  const [visible, setVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
    if (!platform) return;

    const installed = Application.nativeApplicationVersion;
    if (!installed) return;

    const info = await fetchLatestAppVersion(platform);
    if (!info || !isVersionNewer(info.latest_version, installed)) return;

    const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
    if (dismissedVersion === info.latest_version) return;

    setLatestVersion(info.latest_version);
    setReleaseNotes(info.release_notes);
    setVisible(true);
  }

  async function handleLater() {
    if (latestVersion) {
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion);
    }
    setVisible(false);
  }

  async function handleUpdate() {
    if (!STORE_URL) return;
    const canOpen = await Linking.canOpenURL(STORE_URL);
    await Linking.openURL(canOpen ? STORE_URL : STORE_URL_FALLBACK);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name="sparkles" size={24} color="#F4D77A" />
          </View>

          <Text style={styles.title}>A new version is available</Text>
          <Text style={styles.subtitle}>
            {releaseNotes?.trim() || 'Update to the latest version for the newest fixes and features.'}
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.laterBtn} onPress={handleLater}>
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
            <Pressable style={styles.updateBtn} onPress={handleUpdate}>
              <Text style={styles.updateText}>Update Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0D0620',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
    marginBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  laterBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  laterText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  updateBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4D77A',
  },
  updateText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#09000F',
  },
});
