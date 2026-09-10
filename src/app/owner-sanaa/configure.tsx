import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import {
  getSanaaConfig, updateSanaaConfig, completeSanaaConfig, SanaaConfigResponse, SanaaOwnerConfig,
  listSanaaFaqs, createSanaaFaq, updateSanaaFaq, deleteSanaaFaq, SanaaFaq,
} from '@/lib/api/ownerSanaaConfig';
import { updateBusiness } from '@/lib/api/ownerBusiness';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatWeekdayLong } from '@/lib/i18n/format';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// business_hours keys are the full English day name ("Sunday".."Saturday"),
// normalized server-side -- a display concern only here (never re-sent),
// so mapped to a locale-aware weekday name for rendering.
const ENGLISH_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const REFERENCE_SUNDAY = new Date(2023, 0, 1);
function weekdayLongForEnglishName(day: string): string {
  const index = ENGLISH_DAY_NAMES.indexOf(day);
  if (index === -1) return day;
  const d = new Date(REFERENCE_SUNDAY);
  d.setDate(REFERENCE_SUNDAY.getDate() + index);
  return formatWeekdayLong(d);
}

// P5 self-service configuration -- reuses the existing sanaa_tenants/
// sanaa_faqs data and the existing /api/owner/business route for the
// cancellation/rescheduling policy fields (same shared field the agency's
// web dashboard already edits, not a duplicate). No raw prompt editor, no
// voice picker -- both explicitly locked out of scope for owners (P5.5/5.11).
export default function SanaaConfigureScreen() {
  const { t } = useTranslation(['sanaa']);
  const HEADER_OPTIONS = {
    headerStyle: { backgroundColor: '#0B0712' },
    headerTintColor: '#F4D77A',
    headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
    title: t('sanaa:configureScreen.headerTitle'),
    headerBackTitle: t('sanaa:configureScreen.headerBackTitle'),
  };
  const TONES: { key: SanaaOwnerConfig['tone']; label: string }[] = [
    { key: 'warm_casual', label: t('sanaa:configureScreen.toneWarmCasual') },
    { key: 'professional_formal', label: t('sanaa:configureScreen.toneProfessional') },
    { key: 'upbeat_energetic', label: t('sanaa:configureScreen.toneUpbeat') },
  ];
  // Phase 2C — salon-configurable, same canonical backend values the web
  // owner UI offers (AgencySanaaTab.tsx). Global runtime internals
  // (STT model/language, interruption thresholds, noise suppression, LLM,
  // voice, prompt behavior) are never exposed here or anywhere in this app.
  const SLOT_PRIORITIES: { key: SanaaOwnerConfig['slot_priority']; label: string; description: string }[] = [
    { key: 'cluster_both_ends', label: t('sanaa:configureScreen.slotPriorityCluster'), description: t('sanaa:configureScreen.slotPriorityClusterDescription') },
    { key: 'morning_forward', label: t('sanaa:configureScreen.slotPriorityMorning'), description: t('sanaa:configureScreen.slotPriorityMorningDescription') },
    { key: 'largest_gap', label: t('sanaa:configureScreen.slotPriorityGaps'), description: t('sanaa:configureScreen.slotPriorityGapsDescription') },
  ];
  const SLOT_OFFER_COUNTS: SanaaOwnerConfig['slot_offer_count'][] = [1, 2, 3];
  function formatHours(hours: SanaaConfigResponse['business']['business_hours']): string[] {
    if (!hours) return [t('sanaa:configureScreen.hoursNotConfigured')];
    const lines: string[] = [];
    for (const [day, val] of Object.entries(hours)) {
      const dayLabel = weekdayLongForEnglishName(day);
      if (!val?.open) lines.push(`${dayLabel}: ${t('sanaa:configureScreen.closed')}`);
      else if (val.start && val.end) lines.push(`${dayLabel}: ${val.start} – ${val.end}`);
    }
    return lines.length > 0 ? lines : [t('sanaa:configureScreen.hoursNotConfigured')];
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SanaaOwnerConfig | null>(null);
  const [business, setBusiness] = useState<SanaaConfigResponse['business'] | null>(null);
  const [transferInput, setTransferInput] = useState('');
  const [cancellationInput, setCancellationInput] = useState('');
  const [reschedulingInput, setReschedulingInput] = useState('');

  const [faqs, setFaqs] = useState<SanaaFaq[]>([]);
  const [addingFaq, setAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [faqWarning, setFaqWarning] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [configResult, faqResult] = await Promise.all([getSanaaConfig(), listSanaaFaqs()]);
    if (configResult.ok) {
      setConfig(configResult.data.config);
      setBusiness(configResult.data.business);
      setTransferInput(configResult.data.config.transfer_number);
      setCancellationInput(configResult.data.business.cancellation_policy);
      setReschedulingInput(configResult.data.business.rescheduling_policy);
    } else {
      setLoadError(configResult.error);
    }
    if (faqResult.ok) setFaqs(faqResult.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveConfig(patch: Partial<SanaaOwnerConfig>) {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const result = await updateSanaaConfig(patch);
    setSaving(false);
    if (!result.ok) Alert.alert(t('sanaa:configureScreen.couldNotSaveTitle'), result.error);
  }

  async function savePolicies() {
    setSaving(true);
    const result = await updateBusiness({
      cancellation_policy: cancellationInput,
      rescheduling_policy: reschedulingInput,
    });
    setSaving(false);
    if (!result.ok) Alert.alert(t('sanaa:configureScreen.couldNotSaveTitle'), result.error);
    else Alert.alert(t('sanaa:configureScreen.savedTitle'), t('sanaa:configureScreen.cancellationReschedulingSavedMessage'));
  }

  async function saveTransferNumber() {
    setSaving(true);
    const result = await updateSanaaConfig({ transfer_number: transferInput });
    setSaving(false);
    if (!result.ok) Alert.alert(t('sanaa:configureScreen.couldNotSaveTitle'), result.error);
    else Alert.alert(t('sanaa:configureScreen.savedTitle'), t('sanaa:configureScreen.transferNumberSavedMessage'));
  }

  async function saveAndContinue() {
    setSaving(true);
    const result = await completeSanaaConfig();
    setSaving(false);
    if (!result.ok) { Alert.alert(t('sanaa:configureScreen.couldNotContinueTitle'), result.error); return; }
    router.push('/owner-sanaa/phone');
  }

  async function addFaq() {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const result = await createSanaaFaq({ question: newQuestion.trim(), answer: newAnswer.trim() });
    if (!result.ok) { Alert.alert(t('sanaa:configureScreen.couldNotAddFaqTitle'), result.error); return; }
    setFaqs((prev) => [...prev, result.data.data]);
    setFaqWarning(result.data.warning);
    setNewQuestion('');
    setNewAnswer('');
    setAddingFaq(false);
  }

  async function toggleFaqActive(faq: SanaaFaq) {
    const result = await updateSanaaFaq(faq.id, { active: !faq.active });
    if (!result.ok) { Alert.alert(t('sanaa:configureScreen.couldNotUpdateTitle'), result.error); return; }
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? result.data.data : f)));
  }

  async function removeFaq(faq: SanaaFaq) {
    Alert.alert(t('sanaa:configureScreen.deleteFaqTitle'), faq.question, [
      { text: t('sanaa:configureScreen.cancel'), style: 'cancel' },
      {
        text: t('sanaa:configureScreen.delete'), style: 'destructive', onPress: async () => {
          const result = await deleteSanaaFaq(faq.id);
          if (!result.ok) { Alert.alert(t('sanaa:configureScreen.couldNotDeleteTitle'), result.error); return; }
          setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <BreathingHeart size={40} color="#F4D77A" />
      </View>
    );
  }

  if (loadError || !config || !business) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <ErrorState message={loadError ?? undefined} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={HEADER_OPTIONS} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* What SANAA already knows -- read-only, sourced from the same data SANAA's live calls already use */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.whatSanaaKnows')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <View style={styles.knownRow}>
              <Text style={styles.knownLabel}>{t('sanaa:configureScreen.business')}</Text>
              <Text style={styles.knownValue}>{business.business_name ?? '—'}</Text>
            </View>
            <View style={[styles.knownRow, styles.rowBorder]}>
              <Text style={styles.knownLabel}>{t('sanaa:configureScreen.services')}</Text>
              <Text style={styles.knownValue}>{t('sanaa:configureScreen.activeCount', { count: business.service_count })}</Text>
            </View>
            <View style={[styles.knownRow, styles.rowBorder]}>
              <Text style={styles.knownLabel}>{t('sanaa:configureScreen.staff')}</Text>
              <Text style={styles.knownValue}>{t('sanaa:configureScreen.activeCount', { count: business.staff_count })}</Text>
            </View>
            <View style={[styles.knownHoursBlock, styles.rowBorder]}>
              <Text style={styles.knownLabel}>{t('sanaa:configureScreen.hours')}</Text>
              {formatHours(business.business_hours).map((line) => (
                <Text key={line} style={styles.knownHoursLine}>{line}</Text>
              ))}
            </View>
          </BlurView>
          <Text style={styles.hint}>{t('sanaa:configureScreen.knownHint')}</Text>
        </View>

        {/* Tone & behavior */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.toneBehavior')}</Text>
          <View style={styles.toneRow}>
            {TONES.map((tone) => (
              <TouchableOpacity
                key={tone.key}
                style={[styles.toneChip, config.tone === tone.key && styles.toneChipActive]}
                onPress={() => saveConfig({ tone: tone.key })}
              >
                <Text style={[styles.toneChipText, config.tone === tone.key && styles.toneChipTextActive]}>{tone.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <SwitchRow
              label={t('sanaa:configureScreen.answerAfterHours')}
              value={config.after_hours_booking}
              onValueChange={(v) => saveConfig({ after_hours_booking: v })}
            />
            <SwitchRow
              label={t('sanaa:configureScreen.suggestAddOns')}
              value={config.upsell_enabled}
              onValueChange={(v) => saveConfig({ upsell_enabled: v })}
              bordered
            />
            <SwitchRow
              label={t('sanaa:configureScreen.notifyPush')}
              value={config.notify_owner_bell}
              onValueChange={(v) => saveConfig({ notify_owner_bell: v })}
              bordered
            />
            <SwitchRow
              label={t('sanaa:configureScreen.notifyEmail')}
              value={config.notify_owner_email}
              onValueChange={(v) => saveConfig({ notify_owner_email: v })}
              bordered
            />
          </BlurView>
        </View>

        {/* Human transfer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.humanTransfer')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <TextInput
              style={styles.input}
              value={transferInput}
              onChangeText={setTransferInput}
              placeholder={t('sanaa:configureScreen.transferPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="phone-pad"
            />
          </BlurView>
          <Text style={styles.hint}>{t('sanaa:configureScreen.transferHint')}</Text>
          <TouchableOpacity style={styles.saveSmallButton} onPress={saveTransferNumber} disabled={saving}>
            <Text style={styles.saveSmallButtonText}>{t('sanaa:configureScreen.saveTransferNumber')}</Text>
          </TouchableOpacity>
        </View>

        {/* SmartFill -- salon-configurable ranking/offer-count only; global
            runtime internals (STT/interruption/voice/model) never appear here */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.smartFill')}</Text>
          <Text style={styles.hint}>{t('sanaa:configureScreen.smartFillDescription')}</Text>
          <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>{t('sanaa:configureScreen.slotPriorityLabel')}</Text>
          <View style={styles.toneRow}>
            {SLOT_PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.toneChip, config.slot_priority === p.key && styles.toneChipActive]}
                onPress={() => saveConfig({ slot_priority: p.key })}
              >
                <Text style={[styles.toneChipText, config.slot_priority === p.key && styles.toneChipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            {SLOT_PRIORITIES.find((p) => p.key === config.slot_priority)?.description ?? ''}
          </Text>
          <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>{t('sanaa:configureScreen.slotOfferCountLabel')}</Text>
          <View style={styles.toneRow}>
            {SLOT_OFFER_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.toneChip, config.slot_offer_count === n && styles.toneChipActive]}
                onPress={() => saveConfig({ slot_offer_count: n })}
              >
                <Text style={[styles.toneChipText, config.slot_offer_count === n && styles.toneChipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{t('sanaa:configureScreen.slotOfferCountHint')}</Text>
        </View>

        {/* Policies -- same shared field as owner-settings/business.tsx, not a duplicate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.cancellationReschedulingPolicy')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <Text style={styles.fieldLabel}>{t('sanaa:configureScreen.cancellationPolicyLabel')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={cancellationInput}
              onChangeText={setCancellationInput}
              multiline
              placeholder={t('sanaa:configureScreen.cancellationPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
            <Text style={[styles.fieldLabel, styles.rowBorder]}>{t('sanaa:configureScreen.reschedulingPolicyLabel')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={reschedulingInput}
              onChangeText={setReschedulingInput}
              multiline
              placeholder={t('sanaa:configureScreen.reschedulingPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
          </BlurView>
          <Text style={styles.hint}>{t('sanaa:configureScreen.policyHint')}</Text>
          <TouchableOpacity style={styles.saveSmallButton} onPress={savePolicies} disabled={saving}>
            <Text style={styles.saveSmallButtonText}>{t('sanaa:configureScreen.savePolicies')}</Text>
          </TouchableOpacity>
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sanaa:configureScreen.faqs')}</Text>
          <BlurView intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            {faqs.length === 0 && !addingFaq && (
              <Text style={styles.emptyText}>{t('sanaa:configureScreen.noFaqsYet')}</Text>
            )}
            {faqs.map((faq, i) => (
              <View key={faq.id} style={[styles.faqRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Text style={styles.faqAnswer} numberOfLines={2}>{faq.answer}</Text>
                </View>
                <Switch
                  value={faq.active}
                  onValueChange={() => toggleFaqActive(faq)}
                  trackColor={{ true: '#F4D77A' }}
                />
                <TouchableOpacity onPress={() => removeFaq(faq)} hitSlop={8} style={styles.faqDelete}>
                  <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            ))}
          </BlurView>

          {faqWarning && (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>{faqWarning}</Text>
            </View>
          )}

          {addingFaq ? (
            <BlurView intensity={90} tint="dark" style={[styles.card, { marginTop: Spacing.sm }]}>
              <CardOverlay />
              <TextInput
                style={styles.input}
                value={newQuestion}
                onChangeText={setNewQuestion}
                placeholder={t('sanaa:configureScreen.questionPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              <TextInput
                style={[styles.input, styles.multiline, styles.rowBorder]}
                value={newAnswer}
                onChangeText={setNewAnswer}
                placeholder={t('sanaa:configureScreen.answerPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                maxLength={300}
              />
              <Text style={styles.charCount}>{newAnswer.length}/300</Text>
              <View style={styles.faqAddActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setAddingFaq(false)}>
                  <Text style={styles.cancelButtonText}>{t('sanaa:configureScreen.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveSmallButton} onPress={addFaq}>
                  <Text style={styles.saveSmallButtonText}>{t('sanaa:configureScreen.addFaq')}</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <TouchableOpacity style={styles.addFaqButton} onPress={() => { setAddingFaq(true); setFaqWarning(null); }}>
              <Ionicons name="add" size={16} color="#FFC857" />
              <Text style={styles.addFaqButtonText}>{t('sanaa:configureScreen.addFaq')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={saveAndContinue} disabled={saving}>
          <Text style={styles.continueButtonText}>{t('sanaa:configureScreen.saveAndContinue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SwitchRow({ label, value, onValueChange, bordered }: { label: string; value: boolean; onValueChange: (v: boolean) => void; bordered?: boolean }) {
  return (
    <View style={[styles.switchRow, bordered && styles.rowBorder]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#F4D77A' }} />
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
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', marginTop: Spacing.xs, paddingTop: Spacing.sm },
  hint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)', marginLeft: Spacing.xs },

  knownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  knownLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  knownValue: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  knownHoursBlock: { paddingVertical: 8, gap: 2 },
  knownHoursLine: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },

  toneRow: { flexDirection: 'row', gap: 8 },
  toneChip: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.full, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  toneChipActive: { backgroundColor: 'rgba(255,200,87,0.9)', borderColor: '#FFC857' },
  toneChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)' },
  toneChipTextActive: { color: '#09000F' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  switchLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },

  input: {
    fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF',
    paddingVertical: 8,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  fieldLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  charCount: { fontFamily: FontFamily.sora, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'right' },

  saveSmallButton: {
    alignSelf: 'flex-start', backgroundColor: '#F4D77A', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
  },
  continueButton: {
    borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 16, alignItems: 'center',
  },
  continueButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
  saveSmallButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#09000F' },
  cancelButton: { paddingHorizontal: Spacing.md, paddingVertical: 9, justifyContent: 'center' },
  cancelButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  faqAddActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },

  emptyText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: Spacing.sm },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  faqQuestion: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  faqAnswer: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  faqDelete: { padding: 4 },
  addFaqButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  addFaqButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFC857' },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: BorderRadius.md, padding: Spacing.sm,
  },
  warningText: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: '#F59E0B', lineHeight: FontSize.xs * 1.5 },
});
