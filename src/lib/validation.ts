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

// Google Account password baseline: 8+ characters, mix of upper/lowercase and a number.
export function getPasswordError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include a number.';
  return null;
}
