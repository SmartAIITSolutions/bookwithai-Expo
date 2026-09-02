// i18n foundation (L1) — TypeScript key-safety. Augments i18next's own
// CustomTypeOptions with the REAL English resource shape (English is
// canonical, per Locked Product Decision §1), so `t('common.saev')` (a
// typo) or `t('nonexistent.key')` is a compile-time error in editors/CI
// that check it, without hand-writing a parallel keys type that could
// drift from the actual JSON. Deliberately just this one augmentation --
// no runtime-generated types, no extra build step, to avoid the build-
// performance/complexity cost the L1 spec explicitly warns against.
import 'i18next';
import type { enResources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof enResources;
  }
}
