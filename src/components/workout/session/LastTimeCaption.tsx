// =============================================================================
// LastTimeCaption — what you lifted last time, in one line
// =============================================================================
// The quietest text on the session screen: no border, no fill, no icon, not
// pressable. The quick-log ladder keeps the only fill and the largest numerals,
// because that is the one-tap path and this is a reference.
//
// One line per exercise rather than one per set row: a line on every row would
// push the ladder down once for each planned set. One line costs 18 px, once.
// It always renders — "First time" when there is no history — so the ladder
// sits at the same height on every exercise and the first tap is muscle memory.

import { StyleSheet, Text } from 'react-native';

import { lastTimeLine } from '@/lib/last-time';
import { useSettingsStore, useWorkoutHistoryStore, useWorkoutStore } from '@/stores';
import { roles, spacing, textStyles } from '@/theme';

interface LastTimeCaptionProps {
  /** The session exercise's id, positional suffix and all. */
  exerciseId: string;
}

export function LastTimeCaption({ exerciseId }: LastTimeCaptionProps) {
  const logs = useWorkoutHistoryStore((state) => state.logs);
  const units = useSettingsStore((state) => state.units);
  // The session's own start, not the current time: the line must not change
  // under you mid-session, and a screen that reads the clock at render is
  // wrong for as long as it stays mounted.
  const startedAt = useWorkoutStore((state) => state.startedAt);

  return (
    <Text style={styles.caption} numberOfLines={1} ellipsizeMode="tail">
      {/* No anchor means no session, and nothing for the line to be stale
          against, so every saved workout counts as earlier. */}
      {lastTimeLine({ logs, exerciseId, before: startedAt ?? Number.POSITIVE_INFINITY, units })}
    </Text>
  );
}

const styles = StyleSheet.create({
  caption: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
    // Sits under the muscle groups and the form toggle, above the first set
    // card. The card list owns the gap below it.
    marginBottom: spacing[3],
  },
});
