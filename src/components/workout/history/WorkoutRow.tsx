// =============================================================================
// WorkoutRow — one logged workout, collapsed or opened
// =============================================================================
// Collapsed it is a date and three numbers; opened it is every set you did.
// History is a working surface (Hevy register, ADR-0013), so the open state is
// dense and tabular rather than spaced out.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDown, ChevronUp } from '@/components/icons';
import { describeBlock, isTimed, resolveBlock } from '@/lib/blocks';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { Exercise, LoggedSet, WorkoutBlock, WorkoutLog } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

export function WorkoutRow({
  log,
  units,
  expanded,
  onToggle,
}: {
  log: WorkoutLog;
  units: 'lb' | 'kg';
  expanded: boolean;
  onToggle: () => void;
}) {
  const exerciseCount = log.exercises.length;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={styles.cardHeader}
        accessibilityRole="button"
        accessibilityLabel={`Workout on ${formatDate(log.timestamp)}, ${exerciseCount} exercises`}
        accessibilityHint={expanded ? 'Collapse exercise breakdown' : 'Expand exercise breakdown'}
      >
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardDate}>{formatDate(log.timestamp)}</Text>
          <View style={styles.miniStats}>
            <MiniStat label="Duration" value={formatDuration(log.durationSeconds)} />
            <MiniStat label="Exercises" value={`${exerciseCount}`} />
            <MiniStat label="Streak" value={`${log.streakDays}d`} />
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          {expanded ? (
            <ChevronUp size={18} color={roles.textMuted} />
          ) : (
            <ChevronDown size={18} color={roles.textMuted} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Exercises</Text>
          {log.exercises.map((exercise, index) => {
            // The clock is stated once, above the first member, matching the
            // loadout and the editor. Repeating it on each movement would say
            // the same thing three times for one block of work.
            const block = resolveBlock(exercise, log.blocks);
            const startsBlock =
              exercise.blockId !== undefined &&
              log.exercises.findIndex((e) => e.blockId === exercise.blockId) === index;

            return (
              <View key={exercise.id}>
                {startsBlock && <Text style={styles.blockHeading}>{describeBlock(block)}</Text>}
                <ExerciseBreakdown exercise={exercise} blocks={log.blocks} units={units} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ExerciseBreakdown({
  exercise,
  blocks,
  units,
}: {
  exercise: Exercise;
  /** Absent on every log written before blocks existed — those were all sets. */
  blocks: WorkoutBlock[] | undefined;
  units: 'lb' | 'kg';
}) {
  const loggedSets = exercise.sets.filter((s) => s.logged);
  // Timed work was logged as rounds against a clock, not as planned sets.
  const unit = isTimed(resolveBlock(exercise, blocks).mode) ? 'Round' : 'Set';

  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {exercise.sets.some((s) => s.isPR) && (
          <View style={styles.prTag}>
            <Text style={styles.prTagText}>PR</Text>
          </View>
        )}
      </View>
      {loggedSets.length === 0 ? (
        <Text style={styles.exerciseDetail}>{`No ${unit.toLowerCase()}s logged`}</Text>
      ) : (
        <View style={styles.setList}>
          {loggedSets.map((set, index) => (
            // Sets are positional display data with no stable id (two sets can
            // share identical weight/reps, so content keys would collide), and
            // this list is static — never reordered — so index keys are safe.
            // biome-ignore lint/suspicious/noArrayIndexKey: static set list, see above
            <SetLine key={index} set={set} index={index + 1} units={units} label={unit} />
          ))}
        </View>
      )}
    </View>
  );
}

function SetLine({
  set,
  index,
  units,
  label = 'Set',
}: {
  set: LoggedSet;
  index: number;
  units: 'lb' | 'kg';
  /** 'Set' for a normal scheme, 'Round' inside an AMRAP block. */
  label?: string;
}) {
  const reps = set.reps;
  const weight = set.weight;
  let detail: string;
  if (reps == null && weight == null) {
    detail = '—';
  } else if (weight == null || weight === 0) {
    detail = `${reps ?? 0} reps`;
  } else {
    detail = `${weight} ${units} × ${reps ?? 0}`;
  }

  return (
    <View style={styles.setLine}>
      <Text style={styles.setIndex}>
        {label} {index}
      </Text>
      <Text style={styles.setDetail}>{detail}</Text>
      {set.isRepPR && <Text style={styles.prFlag}>rep PR</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardDate: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  miniStats: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  miniStat: {
    minWidth: 56,
  },
  miniStatValue: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
  },
  miniStatLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  breakdown: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  blockHeading: {
    ...textStyles.label,
    color: roles.accentText,
    letterSpacing: 0.5,
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  breakdownTitle: {
    ...textStyles.label,
    color: colors.text.muted,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
  },
  exerciseRow: {
    paddingVertical: spacing[2],
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  exerciseDetail: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  setList: {
    marginLeft: spacing[1],
  },
  setLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: 2,
  },
  setIndex: {
    ...textStyles.caption,
    color: colors.text.muted,
    minWidth: 48,
  },
  setDetail: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  prTag: {
    backgroundColor: colors.reward.pr + '22',
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
  },
  prTagText: {
    ...textStyles.captionSmall,
    color: colors.reward.pr,
    fontWeight: '700',
  },
  prFlag: {
    ...textStyles.captionSmall,
    color: colors.reward.pr,
  },
});
