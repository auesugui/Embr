// =============================================================================
// Embr Cardio — the summary line for a saved cardio entry
// =============================================================================
// Nothing creates cardio entries any more. The typed-in workout screen that did
// was removed, but the entries it saved stay readable in History.

import type { CardioDetail } from '@/types';

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
