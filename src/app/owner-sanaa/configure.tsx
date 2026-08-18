import { SanaaDestinationShell } from '@/components/owner/sanaa/SanaaDestinationShell';

export default function SanaaConfigureScreen() {
  return (
    <SanaaDestinationShell
      title="Configure SANAA"
      icon="settings-outline"
      comingFrom="What SANAA knows and how she behaves -- tone, policies, and FAQs -- will be set up here."
    />
  );
}
