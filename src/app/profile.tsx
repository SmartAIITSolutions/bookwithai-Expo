import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Image,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchCustomerProfile, upsertCustomerProfile, uploadProfilePhoto, linkCustomerIdentity,
  type CustomerProfile,
} from '@/lib/api/customerProfile';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function isValidPhone(v: string) {
  return v.replace(/\D/g, '').length >= 10;
}

const PRONOUN_OPTIONS = ['She/Her', 'He/Him', 'They/Them', 'Prefer not to say'];

function formatDob(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

// Auto-inserts the "/" separators as the user types digits -- the field
// uses keyboardType="number-pad" (so the numeric keypad shows for a date),
// but that keypad has no "/" key at all, so a user could never satisfy the
// strict MM/DD/YYYY format parseDob requires below without this. Confirmed
// live: every birthday entry attempt failed with "Invalid date" and the
// only way to get through the profile-completeness gate was to leave it
// blank.
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '/' + digits.slice(2, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 8);
  return out;
}

// Accepts MM/DD/YYYY, stores as YYYY-MM-DD (date column format).
function parseDob(input: string): string | null {
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { required } = useLocalSearchParams<{ required?: string }>();
  const isRequired = required === 'true';
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState('');
  const [pronouns, setPronouns] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchCustomerProfile(user.id)
      .then((p) => {
        if (p) {
          setPhotoUrl(p.photo_url);
          setDobInput(formatDob(p.date_of_birth));
          setPronouns(p.pronouns);
          setTimezone(p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
          setPhone(p.phone ?? '');
          setEmail(p.email ?? user.email ?? '');
        } else {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
          setEmail(user.email ?? '');
          setPhone(typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '');
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handlePickPhoto() {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.id, result.assets[0].uri);
      await upsertCustomerProfile(user.id, { photo_url: url });
      setPhotoUrl(url);
    } catch (e: any) {
      Alert.alert('Could not upload photo', e.message || 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!isValidPhone(phone)) {
      Alert.alert('Phone required', 'Enter a valid phone number.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Email required', 'Enter a valid email address.');
      return;
    }
    let dob: string | null = null;
    if (dobInput.trim()) {
      dob = parseDob(dobInput.trim());
      if (!dob) {
        Alert.alert('Invalid date', 'Enter your birthday as MM/DD/YYYY.');
        return;
      }
    }
    setSaving(true);
    try {
      await upsertCustomerProfile(user.id, {
        date_of_birth: dob, pronouns, timezone,
        phone: phone.trim(), email: email.trim(),
      });
      // Covers a customer adding/changing phone or email later, not just
      // completing the mandatory gate at signup -- a salon's pre-existing
      // record might only match after this edit.
      const linkResult = await linkCustomerIdentity(phone.trim(), email.trim());
      if (isRequired) {
        router.replace('/(tabs)/book' as never);
      }
      // This phone/email already belongs to a *different*, already-linked
      // account -- most often someone who ended up with two accounts (e.g.
      // Apple Sign-In's private-relay email confused them into signing up
      // again with their real email). Auto-merging isn't safe here (it'd
      // mean handing over booking history to whoever claims a phone/email
      // next), so just point them back to their original account instead
      // of leaving them stuck on an empty one with no explanation.
      if (linkResult.existing_account_detected) {
        Alert.alert(
          'You may already have an account',
          "This phone or email is linked to another account of yours. If your bookings or favorites are missing, try signing out and signing back in the same way you did the first time (for example, Sign in with Apple)."
        );
      } else if (!isRequired) {
        Alert.alert('Saved', 'Your profile has been updated.');
      }
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const headerOptions = {
    headerStyle: { backgroundColor: '#0B0712' },
    headerTintColor: '#F4D77A',
    headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
    title: 'Profile',
    headerBackTitle: 'Account',
    headerBackVisible: !isRequired,
    gestureEnabled: !isRequired,
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={headerOptions} />
          <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {isRequired && (
              <View style={styles.requiredBanner}>
                <Text style={styles.requiredBannerText}>
                  Phone and email are required to book appointments. Add them below to continue.
                </Text>
              </View>
            )}

            <Pressable style={styles.photoWrap} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>
                    {(user?.user_metadata?.full_name || user?.email || 'G')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                {uploadingPhoto ? (
                  <BreathingHeart size={16} color="#09000F" />
                ) : (
                  <Ionicons name="camera" size={14} color="#09000F" />
                )}
              </View>
            </Pressable>

            <View style={styles.section}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Birthday</Text>
              <TextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={dobInput}
                onChangeText={(t) => setDobInput(formatDobInput(t))}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Pronouns</Text>
              <View style={styles.chipRow}>
                {PRONOUN_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.chip, pronouns === opt && styles.chipSelected]}
                    onPress={() => setPronouns(pronouns === opt ? null : opt)}>
                    <Text style={[styles.chipText, pronouns === opt && styles.chipTextSelected]}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Timezone</Text>
              <Text style={styles.timezoneValue}>{timezone}</Text>
              <Text style={styles.timezoneHint}>Detected automatically from your device.</Text>
            </View>

            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>

            {isRequired && (
              <Pressable onPress={() => signOut()}>
                <Text style={styles.signOutLink}>Sign out instead</Text>
              </Pressable>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.xl, gap: Spacing.xl, alignItems: 'center' },

  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(212,175,55,0.5)' },
  photoPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 2, borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: '#F4D77A',
  },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F4D77A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#040108',
  },

  section: { width: '100%', gap: Spacing.sm },
  label: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sora,
    color: '#FFFFFF',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipSelected: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.15)' },
  chipText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  chipTextSelected: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },

  timezoneValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  timezoneHint: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.45)',
  },

  requiredBanner: {
    width: '100%',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    padding: Spacing.md,
  },
  requiredBannerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: 19,
    textAlign: 'center',
  },
  signOutLink: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'underline',
  },
  saveBtn: {
    width: '100%',
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
