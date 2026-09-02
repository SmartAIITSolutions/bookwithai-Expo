import { useTranslation } from 'react-i18next';
import { LegalWebScreen } from '@/components/LegalWebScreen';
export default function TermsScreen() {
  const { t } = useTranslation(['legal']);
  return <LegalWebScreen title={t('legal:terms.title')} url="https://bookwithai.app/terms" />;
}
