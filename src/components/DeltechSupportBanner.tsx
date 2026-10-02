import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchDeltechStatus, recordDeltechAction,
  DeltechActionType, DeltechStatus,
} from '@/lib/api/deltechSupport';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const LINKS: Record<DeltechActionType, string> = {
  // Store-review links auto-pick the right platform per device -- see
  // STORE_REVIEW_URL resolution below.
  store_review: '',
  facebook:  'https://www.facebook.com/profile.php?id=61589122884076',
  instagram: 'https://www.instagram.com/bookwithai.app/',
  tiktok:    'https://www.tiktok.com/@bookwithai.app',
};

const ICONS: Record<DeltechActionType, keyof typeof Ionicons.glyphMap> = {
  store_review: 'star',
  facebook:     'logo-facebook',
  instagram:    'logo-instagram',
  tiktok:       'logo-tiktok',
};

const ORDER: DeltechActionType[] = ['store_review', 'facebook', 'instagram', 'tiktok'];

function isResolved(act?: { confirmed_at: string | null; skipped_at: string | null }) {
  return !!act?.confirmed_at || !!act?.skipped_at;
}

// Forwarded in from RootLayout -- incremented whenever the "we're a DelTech
// finalist" push is tapped, so this always re-expands even if minimized.
interface Props { forceOpenSignal: number }

// Deliberately opens expanded on every app load (no persisted "stay
// minimized" state) -- the X only collapses it to the small ribbon for the
// current session; tapping the ribbon reopens the same session. Once every
// action is resolved (confirmed or skipped), this shows a short thank-you
// instead of the checklist, and the ribbon itself disappears when minimized
// (nothing actionable left to pull the user back to).
export function DeltechSupportBanner({ forceOpenSignal }: Props) {
  const { t } = useTranslation(['deltech']);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<DeltechStatus | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const s = await fetchDeltechStatus();
    setStatus(s);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  useEffect(() => {
    if (forceOpenSignal > 0) setExpanded(true);
  }, [forceOpenSignal]);

  if (!user || !status?.enabled) return null;

  const allResolved = ORDER.every(k => isResolved(status.actions[k]));

  function minimize() { setExpanded(false); }
  function openRibbon() { setExpanded(true); }

  async function handleOpenLink(actionType: DeltechActionType) {
    if (isResolved(status?.actions[actionType])) return;
    let url = LINKS[actionType];
    if (actionType === 'store_review') {
      const { resolveStoreReviewUrl } = await import('@/lib/storeReviewUrl');
      url = await resolveStoreReviewUrl();
    }
    if (!url) return;
    // There's no way to verify a store review or a social follow actually
    // happened, so this doesn't wait for a separate self-report tap --
    // opening the link is treated as the confirmation.
    recordDeltechAction(actionType, 'confirm'); // fire-and-forget
    const now = new Date().toISOString();
    setStatus(prev => prev && {
      ...prev,
      actions: { ...prev.actions, [actionType]: { tapped_at: now, confirmed_at: now, skipped_at: null, skip_reason: null } },
    });
    Linking.openURL(url);
  }

  async function handleSkip(actionType: DeltechActionType) {
    recordDeltechAction(actionType, 'skip', 'no_account'); // fire-and-forget
    const now = new Date().toISOString();
    setStatus(prev => prev && {
      ...prev,
      actions: {
        ...prev.actions,
        [actionType]: { ...prev.actions[actionType], skipped_at: now, skip_reason: 'no_account' },
      },
    });
  }

  if (!expanded) {
    if (allResolved) return null; // nothing left to ask about this session
    return (
      <TouchableOpacity onPress={openRibbon} activeOpacity={0.85} style={[styles.ribbon, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.ribbonEmoji}>🏆</Text>
        <Text style={styles.ribbonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t('deltech:ribbonLabel')}
        </Text>
      </TouchableOpacity>
    );
  }

  if (allResolved) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={minimize}>
        <View style={styles.overlay}>
          <BlurView intensity={40} tint="dark" style={[styles.card, { marginTop: insets.top + Spacing.md }]}>
            <TouchableOpacity onPress={minimize} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={styles.emoji}>🏆</Text>
            <Text style={styles.headline}>{t('deltech:thankYouHeadline')}</Text>
            <Text style={styles.intro}>{t('deltech:thankYouBody')}</Text>
          </BlurView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={minimize}>
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={[styles.card, { marginTop: insets.top + Spacing.md }]}>
          <TouchableOpacity onPress={minimize} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.emoji}>🏆</Text>
          <Text style={styles.headline}>{status.headline || t('deltech:headline')}</Text>
          <Text style={styles.intro}>{status.body || t('deltech:intro')}</Text>

          {ORDER.map(actionType => {
            const act = status.actions[actionType];
            const confirmed = !!act?.confirmed_at;
            const skipped = !!act?.skipped_at;
            const resolved = confirmed || skipped;
            const labelKey = actionType === 'store_review' ? 'storeReview'
              : actionType === 'facebook' ? 'followFacebook'
              : actionType === 'instagram' ? 'followInstagram' : 'followTiktok';
            return (
              <View key={actionType} style={styles.rowGroup}>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowLink}
                    onPress={() => handleOpenLink(actionType)}
                    disabled={resolved}
                  >
                    <Ionicons name={ICONS[actionType]} size={20} color={skipped ? 'rgba(255,255,255,0.3)' : '#F4D77A'} />
                    <Text style={[styles.rowText, skipped && styles.rowTextSkipped]}>{t(`deltech:${labelKey}`)}</Text>
                    {!resolved && <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.4)" />}
                  </TouchableOpacity>
                  <View style={[styles.checkbox, confirmed && styles.checkboxDone, skipped && styles.checkboxSkipped]}>
                    {confirmed && <Ionicons name="checkmark" size={16} color="#09000F" />}
                    {skipped && <Ionicons name="remove" size={16} color="rgba(255,255,255,0.6)" />}
                  </View>
                </View>
                {!resolved && (
                  <TouchableOpacity onPress={() => handleSkip(actionType)} style={styles.skipLink}>
                    <Text style={styles.skipLinkText}>{t('deltech:noAccount')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a1326', paddingBottom: 8, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  ribbonEmoji: { fontSize: 13 },
  ribbonText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12, color: '#F4D77A', flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center' },
  card: {
    width: '90%', maxWidth: 420, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', overflow: 'hidden',
    backgroundColor: 'rgba(11,7,18,0.92)',
  },
  closeBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 1 },
  emoji: { fontSize: 32, textAlign: 'center', marginBottom: Spacing.xs },
  headline: {
    fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.lg, color: '#fff',
    textAlign: 'center', marginBottom: Spacing.xs,
  },
  intro: {
    fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginBottom: Spacing.md,
  },
  rowGroup: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  rowText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#fff', flex: 1 },
  rowTextSkipped: { color: 'rgba(255,255,255,0.4)' },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.sm,
  },
  checkboxDone: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  checkboxSkipped: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  skipLink: { alignSelf: 'flex-start', marginTop: 4, paddingLeft: 30 },
  skipLinkText: { fontFamily: FontFamily.sora, fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
});
