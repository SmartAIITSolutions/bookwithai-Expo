import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Image,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BreathingHeart } from '@/components/BreathingHeart';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchCustomerProfile, upsertCustomerProfile, uploadProfilePhoto,
  type CustomerProfile,
} from '@/lib/api/customerProfile';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

const PRONOUN_OPTIONS = ['She/Her', 'He/Him', 'They/Them', 'Prefer not to say'];

function formatDob(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

// Accepts MM/DD/YYYY, stores as YYYY-MM-DD (date column format).
function parseDob(input: string): string | null {
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState('');
  const [pronouns, setPronouns] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCustomerProfile(user.id)
      .then((p) => {
        if (p) {
          setPhotoUrl(p.photo_url);
          setDobInput(formatDob(p.date_of_birth));
          setPronouns(p.pronouns);
          setTimezone(p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
        } else {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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
      await upsertCustomerProfile(user.id, { date_of_birth: dob, pronouns, timezone });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Profile', headerBackTitle: 'Account' }} />
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Profile', headerBackTitle: 'Account' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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
                <BreathingHeart size={16} color={Colors.white} />
              ) : (
                <Ionicons name="camera" size={14} color={Colors.white} />
              )}
            </View>
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.label}>Birthday</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={Colors.textDisabled}
              value={dobInput}
              onChangeText={setDobInput}
              keyboardType="number-pad"
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
            {saving ? <BreathingHeart size={18} color={Colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.xl, gap: Spacing.xl, alignItems: 'center' },

  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
  },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.backgroundMain,
  },

  section: { width: '100%', gap: Spacing.sm },
  label: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sora,
    color: Colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.backgroundLavender },
  chipText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextSelected: { fontFamily: FontFamily.soraSemiBold, color: Colors.primary },

  timezoneValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  timezoneHint: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
  },

  saveBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.button,
  },
  saveBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
