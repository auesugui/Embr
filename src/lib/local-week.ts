// =============================================================================
// Embr Local Week — Monday-to-Sunday weeks in the device's time zone
// =============================================================================
// A week is identified by its Monday as a local day key, so every helper here
// builds on local-day.ts rather than UTC. Noon is used for the date arithmetic
// so a DST shift cannot push a result onto the neighbouring day.

import { localDayKey } from './local-day';

/** Monday-first single letters for the day row. Two Ts and two Ss, as calendars do. */
export const WEEK_DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Days to step back from `jsDay` (0 = Sunday) to reach that week's Monday. */
const backToMonday = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

/** The Monday of the local week containing `date`, as YYYY-MM-DD. */
export function localWeekKey(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - backToMonday(date.getDay()));
  return localDayKey(start);
}

/** The Monday of the week that the local day `key` belongs to. */
export function weekKeyForDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return localWeekKey(new Date(year, month - 1, day, 12));
}

/** The Monday of the week before `weekKey`. */
export function previousWeekKey(weekKey: string): string {
  const [year, month, day] = weekKey.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day - 7, 12));
}

/** The seven local day keys of `weekKey`, Monday first. */
export function weekDayKeys(weekKey: string): string[] {
  const [year, month, day] = weekKey.split('-').map(Number);
  return WEEK_DAY_INITIALS.map((_, i) => localDayKey(new Date(year, month - 1, day + i, 12)));
}

/** Days from `now` through Sunday, counting today. Monday gives 7, Sunday gives 1. */
export function daysLeftInWeek(now: Date): number {
  return 7 - backToMonday(now.getDay());
}
