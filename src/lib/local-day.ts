// =============================================================================
// Embr Local Day — calendar-day keys in the device's time zone
// =============================================================================
// Streaks and typed-in workout dates are calendar days as the user lives them.
// A UTC key moves an evening workout onto the next day, so every key here is
// built from local date parts.

const pad = (value: number) => String(value).padStart(2, '0');

/** The local calendar day of `date` as YYYY-MM-DD. */
export const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The calendar day before `key`. Noon avoids a DST shift landing on the wrong date. */
export function previousDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day - 1, 12));
}
