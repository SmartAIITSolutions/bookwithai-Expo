export interface DaySchedule { open: boolean; start: number; end: number }
export type WeekSchedule = Record<string, DaySchedule>;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DEFAULT_SCHEDULE: WeekSchedule = {
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
