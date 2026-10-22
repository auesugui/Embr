// =============================================================================
// Embr Cardio — the activity names offered while typing, and the summary line
// =============================================================================

import type { CardioDetail } from '@/types';

export const CARDIO_ACTIVITIES: readonly string[] = [
  'Run',
  'Walk',
  'Bike',
  'Row',
  'Swim',
  'Elliptical',
  'Stair climber',
  'Jump rope',
  'Hike',
];

const SUGGESTION_LIMIT = 5;

/**
 * Activities to offer while a name is typed. Names that start with the query
 * come first. An exact match is left out, since it is already typed.
 */
export function suggestCardio(query: string, limit = SUGGESTION_LIMIT): string[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const prefixed: string[] = [];
  const contained: string[] = [];
  for (const activity of CARDIO_ACTIVITIES) {
    const name = activity.toLowerCase();
    if (name === needle) continue;
    if (name.startsWith(needle)) prefixed.push(activity);
    else if (name.includes(needle)) contained.push(activity);
  }
  return [...prefixed, ...contained].slice(0, limit);
}

/** "30m · 3.1 mi · RPE 6". Only the fields that were typed appear. */
export function describeCardio(cardio: CardioDetail): string {
  const minutes = Math.floor(cardio.durationSeconds / 60);
  const seconds = cardio.durationSeconds % 60;
  const parts = [seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`];
  if (cardio.distance !== undefined && cardio.distanceUnit !== undefined) {
    parts.push(`${cardio.distance} ${cardio.distanceUnit}`);
  }
  if (cardio.rpe !== undefined) parts.push(`RPE ${cardio.rpe}`);
  return parts.join(' · ');
}
