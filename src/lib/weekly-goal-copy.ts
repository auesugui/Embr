// =============================================================================
// Embr Weekly Goal — the one line under the hero number
// =============================================================================
// Plain and warm, never an exclamation mark, and never a count of days skipped.
// Counts are written as words because the line is set in the display serif and
// sits directly under the only numeral on the card; a second numeral there
// reads as a second statistic.

import { type WeekProgress, goalMet } from './weekly-goal';

/**
 * Small counts as words. Streaks past twenty read better as digits than as
 * "twenty-three", and the line is the only place these are used.
 */
const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const;

const inWords = (n: number): string => WORDS[n] ?? String(n);
const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n: number, singular: string): string => (n === 1 ? singular : `${singular}s`);

/** The line for the current state of the week. */
export function weeklyGoalLine(progress: WeekProgress): string {
  const { goal, streak, daysLeft, lastWeek } = progress;
  const trained = progress.trainedDays.length;

  if (!progress.hasHistory) return 'Log a workout to start the week.';

  if (goalMet(progress)) {
    if (streak <= 1) return 'Goal met.';
    return `Goal met. ${capitalised(inWords(streak))} ${plural(streak, 'week')} in a row.`;
  }

  // Said once, on the Monday after a week that was trained but came up short,
  // then it goes away. There is no lost-streak banner anywhere else.
  const isMonday = progress.todayKey === progress.weekKey;
  if (
    isMonday &&
    trained === 0 &&
    lastWeek.trainedDays > 0 &&
    lastWeek.trainedDays < lastWeek.goal
  ) {
    return `Last week finished at ${lastWeek.trainedDays} of ${lastWeek.goal}. The count starts here.`;
  }

  if (streak > 0) {
    const remaining = goal - trained;
    return (
      `${capitalised(inWords(streak))} ${plural(streak, 'week')} in a row. ` +
      `${capitalised(inWords(remaining))} more ${plural(remaining, 'session')} ` +
      `${remaining === 1 ? 'makes' : 'make'} ${inWords(streak + 1)}.`
    );
  }

  return `${capitalised(inWords(daysLeft))} ${plural(daysLeft, 'day')} left in the week.`;
}
