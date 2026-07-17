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

export function hourLabels(start: number, end: number): { minutes: number; label: string }[] {
  const labels: { minutes: number; label: string }[] = [];
  const firstHour = Math.ceil(start / 60);
  const lastHour = Math.floor(end / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    labels.push({ minutes: h * 60, label });
  }
  return labels;
}

// Snap to 5-minute increments, matching the web dashboard's own drag granularity.
export function snapMinutes(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}
