import { useTranslation } from 'react-i18next';
import { LegalWebScreen } from '@/components/LegalWebScreen';
export default function SupportScreen() {
  const { t } = useTranslation(['legal']);
  return <LegalWebScreen title={t('legal:support.title')} url="https://bookwithai.app/support" />;
}
