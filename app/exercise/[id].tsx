// =============================================================================
// Embr Exercise Progress Screen
// =============================================================================
// One exercise, one series: the heaviest logged set per session. Volume and
// estimated 1RM are deliberately not here — adding either is a separate
// decision, and two series on one chart is how a working screen becomes a
// dashboard.
//
// ONE UNIT AT A TIME (#85 step 2). An exercise with sessions in both units gets
// a segment above the range chips, and the segment owns everything below it:
// the heaviest value, the window, the chart, the current PR and the record
// list. Nothing is converted and nothing is joined — 90 kg plotted on an axis
// that holds 195 lb would draw a cliff that never happened in the gym. It
// opens on the unit of the most recent session, and the choice is NOT
// persisted: leaving the screen resets to the latest unit.
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
import { UnitSegment } from '@/components/progress/UnitSegment';
import { useLocalDay } from '@/hooks/useLocalDay';
import {
  DEFAULT_PROGRESS_RANGE,
  type ProgressRange,
  describeLatest,
  describeOneSession,
  describeOtherUnit,
  describePRCallout,
  describeSeries,
  describeSessionCount,
  findExerciseProgress,
  formatProgressDate,
  formatProgressValue,
  latestSeries,
  progressRecords,
  rangePoints,
  seriesForUnit,
  smallestRange,
  splitHeadline,
} from '@/lib/exercise-progress';
import { otherWeightUnit } from '@/lib/weight-unit';
import { useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const units = useSettingsStore((s) => s.units);
  // The range chips are windows ending today, so the screen has to re-render
  // when today changes. See useLocalDay.
  const today = useLocalDay();
  // The unit tapped, if any, and the window chosen per unit. Both are screen
  // state and neither is stored: the segment reopens on the latest unit, the
  // way #82's Show all resets on leaving the tab.
  const [picked, setPicked] = useState<WeightUnit | null>(null);
  const [ranges, setRanges] = useState<Partial<Record<WeightUnit, ProgressRange>>>({});

  const progress = useMemo(
    () => (id ? findExerciseProgress(logs, id, units) : null),
    [logs, id, units]
  );

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

  // The side being shown, and the one it is not. `other` being null is the
  // one-unit exercise, which is every screen below as it ships today.
  const split = progress.byUnit.length > 1;
  const shown =
    (picked !== null ? seriesForUnit(progress, picked) : null) ?? latestSeries(progress);
  const other = split ? seriesForUnit(progress, otherWeightUnit(shown.unit)) : null;

  const { unit, metric, points, comparable } = shown;
  // The headline is this unit's most recent session, read in ITS metric. The
  // chart and the records are the series metric only — see exercise-progress.ts.
  const latest = points[points.length - 1];
  const records = progressRecords(comparable);
  // Empty when a hold was only ever recorded as a weight: there is nothing it
  // can honestly hold a seconds record against. See exercise-progress.ts.
  const currentPR = records[0];
  // Each side opens on the smallest window that holds its own sessions. A
  // one-unit exercise keeps the shipped default: the narrowing exists for the
  // three-sessions-in-ten-days side a switch creates.
  const range = ranges[unit] ?? (split ? smallestRange(points, today) : DEFAULT_PROGRESS_RANGE);
  const charted = rangePoints(comparable, range, today);
  const chartable = comparable.length >= 2;
  const headline = splitHeadline(latest.value, latest.metric, unit);
  const oneSession = describeOneSession(shown, other);
  // "Heaviest set per session, in kg." plus, when a second unit exists, where
  // the rest of the history is or where this series ends.
  const otherUnitLine = describeOtherUnit(shown, other);
  const chartCaption = `${describeSeries(metric, unit)}${otherUnitLine === null ? '' : ` ${otherUnitLine}`}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.big}>
          {headline.value}
          {headline.unit !== null && <Text style={styles.bigUnit}> {headline.unit}</Text>}
        </Text>
        <Text style={styles.caption}>
          {`${describeLatest(latest.metric)}, ${formatProgressDate(latest.timestamp)} · ${describeSessionCount(shown, split)}`}
        </Text>
      </View>

      {/* Above the chips, because it owns them too: the window is a window on
          one unit's sessions. Absent entirely on a one-unit exercise. */}
      {split && <UnitSegment sides={progress.byUnit} selected={unit} onChange={setPicked} />}

      {/* Hidden on the one-session screen: a window control over a single point
          offers four ways to look at the same dot. */}
      {chartable && (
        <RangeChips
          value={range}
          onChange={(next) => setRanges((was) => ({ ...was, [unit]: next }))}
        />
      )}

      {chartable ? (
        <View style={styles.chartCard}>
          {charted.length === 0 ? (
            <Text style={styles.chartEmpty}>No sessions in this range.</Text>
          ) : (
            <ProgressChart points={charted} metric={metric} units={unit} name={progress.name} />
          )}
          <Text style={styles.chartCaption}>{chartCaption}</Text>
        </View>
      ) : points.length < 2 ? (
        <ProgressEmpty title={oneSession.title} body={oneSession.body} />
      ) : (
        /* Logged more than once, but fewer than two of those are in the series
           metric — the rest were a weight against reps, or against seconds. */
        <ProgressEmpty
          title="Not enough to chart yet"
          body="Weights and reps are not compared, so the chart needs two sessions logged the same way."
        />
      )}

      {/* No records at all when nothing was measured in the series metric.
          A callout reading "Current PR —" would be worse than its absence. */}
      {currentPR !== undefined && (
        <>
          <View style={styles.prCallout}>
            <Text style={styles.prCalloutKey}>{describePRCallout(shown, other)}</Text>
            <Text style={styles.prCalloutValue}>
              {`${formatProgressValue(currentPR.value, metric, unit)} · ${formatProgressDate(currentPR.timestamp)}`}
            </Text>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Personal records</Text>
            <RecordList records={records} metric={metric} units={unit} />
          </View>
        </>
      )}
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
