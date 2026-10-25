// =============================================================================
// Weekly goal — the hero's one line
// =============================================================================
// Every state the hero can be in, singular and plural, because the line is the
// only thing on the card that carries tone and "1 days left" is the kind of
// thing nobody notices until it ships.

import type { WeekProgress } from '../weekly-goal';
import { weeklyGoalLine } from '../weekly-goal-copy';

/** Mid-week (Thursday) in the week of Mon 2026-10-19, nothing trained yet. */
const progress = (overrides: Partial<WeekProgress> = {}): WeekProgress => ({
  weekKey: '2026-10-19',
  todayKey: '2026-10-22',
  goal: 4,
  trainedDays: [],
  streak: 0,
  hasHistory: true,
  daysLeft: 4,
  lastWeek: { trainedDays: 0, goal: 4 },
  ...overrides,
});

describe('weeklyGoalLine', () => {
  it('invites a first workout when nothing was ever saved', () => {
    expect(weeklyGoalLine(progress({ hasHistory: false, goal: 3, streak: 0 }))).toBe(
      'Log a workout to start the week.'
    );
  });

  it('states the room left when there is no run going', () => {
    expect(weeklyGoalLine(progress({ trainedDays: ['2026-10-19'] }))).toBe(
      'Four days left in the week.'
    );
  });

  it('says the last day in the singular', () => {
    expect(weeklyGoalLine(progress({ todayKey: '2026-10-25', daysLeft: 1 }))).toBe(
      'One day left in the week.'
    );
  });

  it('names the run and what finishing the week would make it', () => {
    expect(
      weeklyGoalLine(
        progress({ streak: 3, trainedDays: ['2026-10-19', '2026-10-21', '2026-10-22'] })
      )
    ).toBe('Three weeks in a row. One more session makes four.');
  });

  it('pluralises the sessions still needed', () => {
    expect(weeklyGoalLine(progress({ streak: 3, trainedDays: ['2026-10-19'] }))).toBe(
      'Three weeks in a row. Three more sessions make four.'
    );
  });

  it('pluralises a one-week run', () => {
    expect(weeklyGoalLine(progress({ streak: 1, trainedDays: ['2026-10-19'] }))).toBe(
      'One week in a row. Three more sessions make two.'
    );
  });

  it('says only "Goal met." for a first counted week', () => {
    expect(
      weeklyGoalLine(
        progress({
          goal: 2,
          streak: 1,
          trainedDays: ['2026-10-19', '2026-10-21'],
        })
      )
    ).toBe('Goal met.');
  });

  it('adds the run once there is more than one week in it', () => {
    expect(
      weeklyGoalLine(
        progress({
          goal: 2,
          streak: 4,
          trainedDays: ['2026-10-19', '2026-10-21'],
        })
      )
    ).toBe('Goal met. Four weeks in a row.');
  });

  it('recaps the week just missed, on the Monday after', () => {
    expect(
      weeklyGoalLine(
        progress({
          todayKey: '2026-10-19',
          daysLeft: 7,
          lastWeek: { trainedDays: 2, goal: 4 },
        })
      )
    ).toBe('Last week finished at 2 of 4. The count starts here.');
  });

  it('does not recap a week nobody trained in', () => {
    expect(
      weeklyGoalLine(
        progress({ todayKey: '2026-10-19', daysLeft: 7, lastWeek: { trainedDays: 0, goal: 4 } })
      )
    ).toBe('Seven days left in the week.');
  });

  it('does not recap once the week is under way', () => {
    expect(
      weeklyGoalLine(
        progress({
          todayKey: '2026-10-19',
          daysLeft: 7,
          trainedDays: ['2026-10-19'],
          lastWeek: { trainedDays: 2, goal: 4 },
        })
      )
    ).toBe('Seven days left in the week.');
  });

  it('writes a long run in digits rather than reaching for a word', () => {
    expect(weeklyGoalLine(progress({ goal: 1, streak: 23, trainedDays: ['2026-10-19'] }))).toBe(
      'Goal met. 23 weeks in a row.'
    );
  });
});
