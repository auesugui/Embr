// =============================================================================
// IronQuest Workout History Screen
// =============================================================================
// Reverse-chronological list of CLAIMED workouts. A session only becomes
// "history" once its FP has been claimed (`claimedAt != null`); unclaimed /
// abandoned sessions are intentionally hidden — see getClaimedLogs.
//
// The FP figure shown is `log.totalFP`, captured at claim time by the real FP
// engine (src/lib/workout-summary → calculateSessionFP). This screen never
// recomputes FP — it only renders what was already awarded.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAMIFICATION_ENABLED } from '@/config';
import { getClaimedLogs } from '@/lib/history-stats';
import { useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { Exercise, LoggedSet, WorkoutLog } from '@/types';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react-native';

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

export default function HistoryScreen() {
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const hydrated = useWorkoutHistoryStore((s) => s.hydrated);
  const units = useSettingsStore((s) => s.units);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Claimed-only, newest-first. Derived in render so store updates reflect
  // immediately (e.g. claiming a workout adds it to the list right away).
  const claimed = getClaimedLogs(logs);

  const handleToggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  // ---- Loading (store hydrating from AsyncStorage) ----
  if (!hydrated) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Loading history...</Text>
      </View>
    );
  }

  // ---- Empty state (no claimed workouts yet) ----
  if (claimed.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <ClipboardList size={32} color={roles.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptyBody}>
            {GAMIFICATION_ENABLED
              ? 'Finish a workout and claim its Forge Points — it’ll show up here with the full breakdown.'
              : 'Finish and save a workout — it’ll show up here with the full breakdown.'}
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyButtonText}>
              {GAMIFICATION_ENABLED ? 'Start one from the Quest Board' : 'Start one from Workouts'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- History list ----
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.summaryLine}>
        {claimed.length} workout{claimed.length === 1 ? '' : 's'} logged
      </Text>

      {claimed.map((log) => (
        <WorkoutRow
          key={log.id}
          log={log}
          units={units}
          expanded={expandedId === log.id}
          onToggle={() => handleToggle(log.id)}
        />
      ))}
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Workout row + expandable exercise breakdown
// -----------------------------------------------------------------------------

function WorkoutRow({
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
  const totalFP = log.totalFP ?? 0;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={styles.cardHeader}
        accessibilityRole="button"
        accessibilityLabel={
          GAMIFICATION_ENABLED
            ? `Workout on ${formatDate(log.timestamp)}, ${totalFP} Forge Points`
            : `Workout on ${formatDate(log.timestamp)}, ${exerciseCount} exercises`
        }
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
          {GAMIFICATION_ENABLED && (
            <View style={styles.fpBadge}>
              <Text style={styles.fpBadgeText}>+{totalFP} FP</Text>
            </View>
          )}
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
          {log.exercises.map((exercise) => (
            <ExerciseBreakdown key={exercise.id} exercise={exercise} units={units} />
          ))}
        </View>
      )}
    </View>
  );
}

function ExerciseBreakdown({
  exercise,
  units,
}: {
  exercise: Exercise;
  units: 'lb' | 'kg';
}) {
  const loggedSets = exercise.sets.filter((s) => s.logged);

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
        <Text style={styles.exerciseDetail}>No sets logged</Text>
      ) : (
        <View style={styles.setList}>
          {loggedSets.map((set, index) => (
            // Sets are positional display data with no stable id (two sets can
            // share identical weight/reps, so content keys would collide), and
            // this list is static — never reordered — so index keys are safe.
            // biome-ignore lint/suspicious/noArrayIndexKey: static set list, see above
            <SetLine key={index} set={set} index={index + 1} units={units} />
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
}: {
  set: LoggedSet;
  index: number;
  units: 'lb' | 'kg';
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
      <Text style={styles.setIndex}>Set {index}</Text>
      <Text style={styles.setDetail}>{detail}</Text>
      {set.isRepPR && <Text style={styles.prFlag}>rep PR</Text>}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  // Shared empty / loading container
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  stateText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  // Empty state
  emptyCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[6],
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
  },
  emptyIcon: {
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptyBody: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  emptyButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  emptyButtonText: {
    ...textStyles.button,
    color: colors.background.primary,
  },
  // List header
  summaryLine: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing[3],
  },
  // Workout card
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
  fpBadge: {
    backgroundColor: colors.reward.fp + '22',
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  fpBadgeText: {
    ...textStyles.buttonSmall,
    color: colors.reward.fp,
  },
  // Expanded breakdown
  breakdown: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
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
