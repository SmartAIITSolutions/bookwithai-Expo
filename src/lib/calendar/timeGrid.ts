export interface DaySchedule { open: boolean; start: number; end: number }
export type WeekSchedule = Record<string, DaySchedule>;

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DEFAULT_SCHEDULE: WeekSchedule = {
  sun: { open: false, start: 9, end: 17 },
  mon: { open: true,  start: 9, end: 18 },
  tue: { open: true,  start: 9, end: 18 },
  wed: { open: true,  start: 9, end: 18 },
  thu: { open: true,  start: 9, end: 18 },
  fri: { open: true,  start: 9, end: 20 },
  sat: { open: true,  start: 9, end: 17 },
};

// Local-calendar-date key (YYYY-MM-DD) -- deliberately NOT
// `date.toISOString().slice(0, 10)`, which converts to UTC first and can
// silently roll the date by +/-1 day near midnight in any non-UTC timezone
// (this was a real bug: appointments showing under the wrong day/column).
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayScheduleFor(weekSchedule: WeekSchedule | null, date: Date): DaySchedule {
  const key = DAY_KEYS[date.getDay()];
  return (weekSchedule && weekSchedule[key]) || DEFAULT_SCHEDULE[key];
}

// Phase 0.3: grid starts 30 min before opening, ends 30 min after closing —
// never midnight-to-midnight.
export function gridBoundsMinutes(schedule: DaySchedule): { start: number; end: number } {
  const start = Math.max(0, schedule.start * 60 - 30);
  const end   = Math.min(24 * 60, schedule.end * 60 + 30);
  return { start, end };
}

export function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatClockLabel(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mins === 0 ? `${h12} ${period}` : `${h12}:${String(mins).padStart(2, '0')} ${period}`;
}

// Gridline/label ticks across [start, end] at every `intervalMinutes` --
// defaults to hourly, but the calendar's interval picker (15/30/60 min)
// passes a finer step for a denser grid.
export function hourLabels(start: number, end: number, intervalMinutes = 60): { minutes: number; label: string }[] {
  const labels: { minutes: number; label: string }[] = [];
  const first = Math.ceil(start / intervalMinutes) * intervalMinutes;
  for (let m = first; m <= end; m += intervalMinutes) {
    labels.push({ minutes: m, label: formatClockLabel(m) });
  }
  return labels;
}

// Snap to 5-minute increments, matching the web dashboard's own drag granularity.
export function snapMinutes(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}

// ── Salon-timezone-safe variants ─────────────────────────────────────────
// Calendar 2.0 Part 1 — the backend (src/lib/salon-timezone.ts) has always
// computed day boundaries in the SALON's own iana_timezone; everything above
// this line instead reads the DEVICE's local timezone via plain Date
// getters. That mismatch is real, not hypothetical: an owner whose phone
// isn't set to the salon's zone (traveling, or a salon simply run from
// elsewhere) sees the wrong calendar day/time boundary. `business.
// iana_timezone` is already fetched into the Calendar screen (getBusiness())
// and was simply never plumbed into this file's date math.
//
// No new dependency -- Intl.DateTimeFormat's `timeZone` option already does
// exactly what date-fns-tz does server-side, natively, with zero added
// bundle weight. `Date` objects always represent one real UTC instant
// regardless of the device's own zone; only the *formatting* step below
// needs to target the salon's zone instead of the device's.
const zonedPartsCache = new Map<string, Intl.DateTimeFormat>();
function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = zonedPartsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    zonedPartsCache.set(timeZone, f);
  }
  return f;
}

interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number }

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

// Local-calendar-date key (YYYY-MM-DD) in the SALON's timezone, for an
// arbitrary instant -- e.g. "what salon-local day is `new Date()` (right
// now) or the currently-selected `date` state on right now."
export function zonedDateKey(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Minutes since midnight IN THE SALON'S ZONE for an absolute instant (a
// booking's starts_at/ends_at, always stored as a real UTC instant) --
// replaces minutesSinceMidnight() for anything that must position an
// appointment against the salon's own day, not the device's.
export function zonedMinutesSinceMidnight(iso: string, timeZone: string): number {
  const { hour, minute } = zonedParts(new Date(iso), timeZone);
  return hour * 60 + minute;
}

// Weekday index (0=Sun..6=Sat) in the salon's zone, for dayScheduleFor()'s
// DAY_KEYS lookup and for the "Today, Aug 24 / Sunday" header label.
export function zonedWeekday(instant: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? instant.getDay();
}

export function dayScheduleForZoned(weekSchedule: WeekSchedule | null, instant: Date, timeZone: string): DaySchedule {
  const key = DAY_KEYS[zonedWeekday(instant, timeZone)];
  return (weekSchedule && weekSchedule[key]) || DEFAULT_SCHEDULE[key];
}

// "Today, Aug 24" / "Sunday" header pieces, salon-local.
export function zonedHeaderLabels(instant: Date, timeZone: string): { dateLabel: string; weekdayLabel: string } {
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(instant);
  const weekdayLabel = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(instant);
  return { dateLabel, weekdayLabel };
}

// Salon-local clock label ("9:37 AM") for the current-time badge/line.
export function zonedClockLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(instant);
}
