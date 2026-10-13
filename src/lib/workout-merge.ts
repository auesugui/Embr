// =============================================================================
// Workout merge — add incoming logs to a history without touching the rest
// =============================================================================
// Pure, so the history store can use it without pulling in file parsing. The
// log id is the dedupe key: a workout this history already holds is never
// replaced, so importing the same file twice adds nothing the second time.

import type { WorkoutLog } from '@/types';

/**
 * Add the incoming logs this history does not already hold.
 *
 * Existing logs are passed through by reference, untouched. History only shows
 * saved logs (`claimedAt !== null`), so an incoming log that was never saved is
 * stamped with `importedAt` to count as saved from here on.
 */
export function mergeWorkoutLogs(
  existing: WorkoutLog[],
  incoming: WorkoutLog[],
  importedAt: string
): { logs: WorkoutLog[]; added: number } {
  const known = new Set(existing.map((log) => log.id));
  const fresh: WorkoutLog[] = [];

  for (const log of incoming) {
    if (known.has(log.id)) continue;
    known.add(log.id);
    fresh.push(log.claimedAt === null ? { ...log, claimedAt: importedAt } : log);
  }

  if (fresh.length === 0) return { logs: existing, added: 0 };

  // Newest first, matching the order createLog keeps.
  const logs = [...existing, ...fresh].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
  return { logs, added: fresh.length };
}
