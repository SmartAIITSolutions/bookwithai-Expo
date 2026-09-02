import i18n from '@/lib/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+-]{7,20}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  const digitCount = (trimmed.match(/\d/g) || []).length;
  return PHONE_RE.test(trimmed) && digitCount >= 7;
}

// i18n foundation (L3) — validation CONDITIONS are unchanged (same length/
// character-class checks as before); only the returned message text is now
// translated. Uses the standalone i18next instance since this is a plain
// utility function, not a component/hook.
// Google Account password baseline: 8+ characters, mix of upper/lowercase and a number.
export function getPasswordError(password: string): string | null {
  if (password.length < 8) return i18n.t('errors:auth.passwordMinLength');
  if (!/[a-z]/.test(password)) return i18n.t('errors:auth.passwordNeedsLowercase');
  if (!/[A-Z]/.test(password)) return i18n.t('errors:auth.passwordNeedsUppercase');
  if (!/[0-9]/.test(password)) return i18n.t('errors:auth.passwordNeedsNumber');
  return null;
}
