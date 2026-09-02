// Locale-aware presentation formatters (L4). These wrap Intl.* using the
// active i18next language — PRESENTATION ONLY. They never touch how a date/
// time/amount is computed, stored, or sent (no timezone conversion, no
// slot/availability math, no Stripe amounts) — only how an already-resolved
// JS Date or a cents integer is displayed to the user. Business timezone and
// business currency are independent of app language by design (§G/§H): a
// Spanish-language UI for a USD salon must still show USD, and a booking
// time that was already resolved to the business's local wall-clock time
// must render the same wall-clock time regardless of language.
import i18n from '@/lib/i18n';

export function locale(): string {
  return i18n.language === 'es' ? 'es-US' : 'en-US';
}

/** "Mon", "lun." */
export function formatWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(date);
}

/** "Monday", "lunes" */
export function formatWeekdayLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'long' }).format(date);
}

/** "January", "enero" */
export function formatMonthLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long' }).format(date);
}

/** "Jan", "ene." */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(date);
}

/** "9:00 AM", "9:00 a.m." */
export function formatTimeShort(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** "9 AM", "9 a.m." — no minutes, for on-the-hour axis labels */
export function formatHourOnly(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { hour: 'numeric' }).format(date);
}

/** "January 2026", "enero de 2026" — calendar month header */
export function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

/** "Jan 5", "5 ene" — compact date without weekday/year (e.g. note timestamps) */
export function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric' }).format(date);
}

/** "Mon, Jan 5", "lun, 5 ene" — slots-section date heading */
export function formatWeekdayMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

/** "Jan 5, 2026", "5 ene 2026" — compact stat-card dates */
export function formatMonthDayYear(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** "January 5, 2026", "5 de enero de 2026" — full receipt/confirmation dates */
export function formatMonthDayYearLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

/** "January 5", "5 de enero" — no year, e.g. "active until {date}" messaging */
export function formatMonthDayLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', day: 'numeric' }).format(date);
}

/**
 * $49.00 in the active app language's number formatting, currency ALWAYS
 * USD regardless of language (§H — currency comes from the business/payment
 * context, never inferred from language). Amount/cents value itself is
 * never altered.
 */
export function formatCentsUSD(cents: number): string {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** "9:00 AM" in a specific IANA timeZone (e.g. the salon's own, not the
 *  device's) — locale-aware AND timezone-aware, for owner calendar screens
 *  that must render in the business's timezone regardless of app language. */
export function formatTimeShortInTZ(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(), { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
}

/** "Mon, Jan 5, 2026" in a specific IANA timeZone */
export function formatWeekdayMonthDayYearInTZ(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(), { timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** "Mon, Jan 5, 2026" for a plain local date (no timezone conversion) */
export function formatWeekdayMonthDayYear(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** "January 2026" */
export function formatMonthYearLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(date);
}

/** $49 (no decimals) — compact stat-card amounts */
export function formatCentsUSDWhole(cents: number): string {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

/** "Sunday, January 5", "domingo, 5 de enero" — no year, e.g. dashboard date headers */
export function formatWeekdayMonthDayLong(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

/** "Sunday, January 5 at 9:00 AM", "domingo, 5 de enero a las 9:00 a.m." */
export function formatFullDateTime(date: Date): string {
  const datePart = new Intl.DateTimeFormat(locale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  const timePart = formatTimeShort(date);
  return i18n.t('booking:dateTimeAt', { date: datePart, time: timePart });
}
