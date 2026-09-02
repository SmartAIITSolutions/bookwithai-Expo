import { useTranslation } from 'react-i18next';
import { LegalWebScreen } from '@/components/LegalWebScreen';
export default function PrivacyScreen() {
  const { t } = useTranslation(['legal']);
  return <LegalWebScreen title={t('legal:privacy.title')} url="https://bookwithai.app/privacy" />;
}
