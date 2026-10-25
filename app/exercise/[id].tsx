// =============================================================================
// Embr Exercise Progress Screen
// =============================================================================
// One exercise, one series: the heaviest logged set per session. Volume and
// estimated 1RM are deliberately not here — adding either is a separate
// decision, and two series on one chart is how a working screen becomes a
// dashboard.
//
// Hevy register throughout. The derivation rules live in
// src/lib/exercise-progress.ts; this screen only picks a window and draws.

import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProgressChart } from '@/components/progress/ProgressChart';
import { ProgressEmpty } from '@/components/progress/ProgressEmpty';
import { RangeChips } from '@/components/progress/RangeChips';
import { RecordList } from '@/components/progress/RecordList';
import {
  DEFAULT_PROGRESS_RANGE,
  type ProgressRange,
  describeLatest,
  describeSeries,
  findExerciseProgress,
  formatProgressDate,
  formatProgressValue,
  progressRecords,
  rangePoints,
  splitHeadline,
} from '@/lib/exercise-progress';
import { useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const units = useSettingsStore((s) => s.units);
  const [range, setRange] = useState<ProgressRange>(DEFAULT_PROGRESS_RANGE);

  const progress = useMemo(() => (id ? findExerciseProgress(logs, id) : null), [logs, id]);

  const navigation = useNavigation();
  // The exercise's own name is the title, same pattern as the template screen:
  // useLayoutEffect so it is set before paint and never flashes the fallback.
  useLayoutEffect(() => {
    navigation.setOptions({ title: progress?.name ?? 'Exercise Progress' });
  }, [navigation, progress]);

  if (!progress) {
    return (
      <View style={styles.stateContainer}>
        <ProgressEmpty
          title="Nothing logged here"
          body="This exercise has no saved sets yet. Log it in a workout and the chart starts."
        />
      </View>
    );
  }

  const { metric, points, comparable } = progress;
  // The headline is the most recent session, read in ITS metric. The chart and
  // the records are the series metric only — see exercise-progress.ts.
  const latest = points[points.length - 1];
  const records = progressRecords(comparable);
  const currentPR = records[0];
  const charted = rangePoints(comparable, range);
  const chartable = comparable.length >= 2;
  const headline = splitHeadline(latest.value, latest.metric, units);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.big}>
          {headline.value}
          {headline.unit !== null && <Text style={styles.bigUnit}> {headline.unit}</Text>}
        </Text>
        <Text style={styles.caption}>
          {`${describeLatest(latest.metric)}, ${formatProgressDate(latest.timestamp)} · ${
            points.length
          } session${points.length === 1 ? '' : 's'} logged`}
        </Text>
      </View>

      {/* Hidden on the one-session screen: a window control over a single point
          offers four ways to look at the same dot. */}
      {chartable && <RangeChips value={range} onChange={setRange} />}

      {chartable ? (
        <View style={styles.chartCard}>
          {charted.length === 0 ? (
            <Text style={styles.chartEmpty}>No sessions in this range.</Text>
          ) : (
            <ProgressChart points={charted} metric={metric} units={units} name={progress.name} />
          )}
          <Text style={styles.chartCaption}>{describeSeries(metric, units)}</Text>
        </View>
      ) : points.length < 2 ? (
        <ProgressEmpty
          title="One session so far"
          body="A line needs two points. Log this one again and the chart starts here."
        />
      ) : (
        /* Logged more than once, but only one of those is in the series metric
           — the others were a weight against reps, or the reverse. */
        <ProgressEmpty
          title="Not enough to chart yet"
          body="Weights and reps are not compared, so the chart needs two sessions logged the same way."
        />
      )}

      <View style={styles.prCallout}>
        <Text style={styles.prCalloutKey}>Current PR</Text>
        <Text style={styles.prCalloutValue}>
          {`${formatProgressValue(currentPR.value, metric, units)} · ${formatProgressDate(currentPR.timestamp)}`}
        </Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Personal records</Text>
        <RecordList records={records} metric={metric} units={units} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  stateContainer: {
    flex: 1,
    backgroundColor: roles.surface,
    justifyContent: 'center',
    padding: spacing[4],
  },

  // --- The number ------------------------------------------------------------
  big: {
    ...textStyles.numberLarge,
    color: roles.textPrimary,
    fontSize: 34,
    lineHeight: 38,
  },
  bigUnit: {
    ...textStyles.label,
    color: roles.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  caption: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: 3,
  },

  // --- Chart -----------------------------------------------------------------
  chartCard: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingTop: spacing[3],
    paddingBottom: spacing[2.5],
    paddingHorizontal: spacing[2.5],
  },
  chartCaption: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[1],
    marginHorizontal: spacing[2.5],
  },
  chartEmpty: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    paddingVertical: spacing[8],
    textAlign: 'center',
  },

  // --- Records ---------------------------------------------------------------
  prCallout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2.5],
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  prCalloutKey: {
    ...textStyles.caption,
    color: roles.accentText,
    fontWeight: '600',
  },
  prCalloutValue: {
    ...textStyles.labelLarge,
    color: roles.accentText,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
