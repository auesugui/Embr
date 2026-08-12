// =============================================================================
// AMRAP — mode helpers shared by the editor, loadout, session and summary
// =============================================================================
// An AMRAP exercise is bounded by a clock, not by a set count: "as many reps as
// possible in 20 minutes". Three screens need the same three answers — is this
// exercise AMRAP, how long is its window, and how do we say that in one line —
// so they live here rather than being re-derived (and re-diverged) per screen.
//
// `mode` is OPTIONAL on both Exercise and TemplateExercise. Everything logged
// or saved before AMRAP existed omits it, and those records must keep loading
// and restoring untouched (Export or it's gone). That's why nothing outside
// this file compares `mode` directly — `isAmrap` is the single place that
// treats "absent" as "sets".

import type { ExerciseMode } from '@/types';

/** What the reps field reads as when a set has no rep target. */
export const AMRAP_REPS_LABEL = 'AMRAP';

/** Default work window for a newly-switched AMRAP block: 20 minutes. */
export const DEFAULT_AMRAP_SECONDS = 20 * 60;

/** Clamp bounds for the editor's duration stepper. */
export const MIN_AMRAP_SECONDS = 60;
export const MAX_AMRAP_SECONDS = 90 * 60;

/** Anything carrying the two mode fields — Exercise or TemplateExercise. */
interface ModeCarrier {
  mode?: ExerciseMode;
  durationSeconds?: number;
}

/** True only for an explicit AMRAP block. Absent/unknown mode means sets. */
export function isAmrap(target: ModeCarrier | null | undefined): boolean {
  return target?.mode === 'amrap';
}

/**
 * The work window in seconds, clamped into the supported range.
 *
 * An AMRAP block saved without a duration (hand-edited storage, a truncated
 * restore) still gets a usable window rather than a zero-length one that ends
 * the instant it starts.
 */
export function amrapDuration(target: ModeCarrier | null | undefined): number {
  return clampAmrapSeconds(target?.durationSeconds ?? DEFAULT_AMRAP_SECONDS);
}

export function clampAmrapSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_AMRAP_SECONDS;
  return Math.min(MAX_AMRAP_SECONDS, Math.max(MIN_AMRAP_SECONDS, Math.round(seconds)));
}

/** `20 min` / `1h 05m` — for prose lines, not the running clock. */
export function formatAmrapWindow(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** `MM:SS` — the running clock. Mirrors the rest timer's format. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * The one-line scheme description used on the template row, the loadout
 * preview, and the session header: `4 sets × 6-10` or `AMRAP · 20 min`.
 */
export function describeScheme(target: {
  mode?: ExerciseMode;
  durationSeconds?: number;
  sets: number;
  reps: string;
}): string {
  if (isAmrap(target)) {
    return `${AMRAP_REPS_LABEL} · ${formatAmrapWindow(amrapDuration(target))}`;
  }
  return `${target.sets} sets × ${target.reps}`;
}
