// =============================================================================
// Embr Workout History Screen
// =============================================================================
// Reverse-chronological list of CLAIMED workouts. A session only becomes
// "history" once it has been saved (`claimedAt != null`); unclaimed /
// abandoned sessions are intentionally hidden — see getClaimedLogs.
//
// Above the list sit a month calendar and a twelve-week volume strip, both
// folded out of the same saved logs (src/lib/history-calendar.ts,
// src/lib/weekly-volume.ts). Tapping a day filters the list; the month you are
// looking at does not. Together they are capped at 400 px and collapse to a
// single week row once the list starts scrolling, because a header that leaves
// four rows on screen is a worse History than no header.

import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ClipboardList } from '@/components/icons';
import { HistoryCalendar } from '@/components/workout/history/HistoryCalendar';
import { ShowingLine } from '@/components/workout/history/ShowingLine';
import { WeeklyVolumeStrip } from '@/components/workout/history/WeeklyVolumeStrip';
import { WorkoutRow } from '@/components/workout/history/WorkoutRow';
import { useLocalDay } from '@/hooks/useLocalDay';
import {
  canStepBack,
  canStepForward,
  earliestMonth,
  logsForDay,
  monthGrid,
  monthName,
  monthOfDay,
  monthTitle,
  shiftMonth,
  trainingDayKeys,
} from '@/lib/history-calendar';
import { getClaimedLogs } from '@/lib/history-stats';
import { localDayKey } from '@/lib/local-day';
import { volumeStrip } from '@/lib/weekly-volume';
import { useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';

import { RevealRow } from '@/components/celebration';

/** Scroll past this and the grid drops to the week holding the day in view. */
const COLLAPSE_AT = 80;

export default function HistoryScreen() {
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const hydrated = useWorkoutHistoryStore((s) => s.hydrated);
  const units = useSettingsStore((s) => s.units);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // The grid rings today and stops at the current month, so the screen has to
  // re-render when today changes rather than read the clock here. See
  // useLocalDay.
  const now = useLocalDay();
  const todayKey = localDayKey(now);

  // Null follows today, so a screen left open across midnight into a new month
  // moves with it instead of staying on the month it was opened in.
  const [month, setMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // The chevron is a manual override for the visit; once used, scrolling no
  // longer decides. Component state, not a setting.
  const [folded, setFolded] = useState<boolean | null>(null);

  const viewedMonth = month ?? monthOfDay(todayKey);
  const collapsed = folded ?? scrolled;

  const trainedDays = useMemo(() => trainingDayKeys(logs), [logs]);
  const strip = useMemo(() => volumeStrip(logs, now), [logs, now]);
  const earliest = useMemo(() => earliestMonth(logs), [logs]);
  const grid = useMemo(
    () => monthGrid(viewedMonth, { todayKey, trainedDays, selectedKey: selectedDay }),
    [viewedMonth, todayKey, trainedDays, selectedDay]
  );

  const navigation = useNavigation();
  // Collapsed, the month moves into the nav bar so the grid's own title can go
  // with the rows it labelled.
  useLayoutEffect(() => {
    const label = collapsed ? monthName(viewedMonth) : null;
    navigation.setOptions({
      headerRight:
        label === null ? undefined : () => <Text style={styles.headerMonth}>{label}</Text>,
    });
  }, [navigation, collapsed, viewedMonth]);

  // Claimed-only, newest-first. Derived in render so store updates reflect
  // immediately (e.g. claiming a workout adds it to the list right away).
  const claimed = getClaimedLogs(logs);
  const shown = selectedDay === null ? claimed : logsForDay(logs, selectedDay);

  const handleToggle = (id: string) => setExpandedId((current) => (current === id ? null : id));
  const handleSelectDay = (key: string) =>
    setSelectedDay((current) => (current === key ? null : key));
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrolled(event.nativeEvent.contentOffset.y > COLLAPSE_AT);

  // ---- Loading (store hydrating from AsyncStorage) ----
  if (!hydrated) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Loading history...</Text>
      </View>
    );
  }

  // ---- Empty state (no claimed workouts yet) ----
  // Neither the calendar nor the strip renders here: an empty grid and a flat
  // row above "No workouts yet" are two more ways of saying nothing.
  if (claimed.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <ClipboardList size={32} color={roles.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptyBody}>
            Finish and save a workout — it’ll show up here with the full breakdown.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyButtonText}>Start one from Workouts</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- History list ----
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      // Pinned only while a day is selected, and only once it has collapsed:
      // the date you are filtering by has to stay on screen, a 400 px header
      // does not.
      stickyHeaderIndices={selectedDay !== null && collapsed ? [0] : undefined}
    >
      <View style={styles.header}>
        <HistoryCalendar
          title={monthTitle(viewedMonth)}
          days={grid}
          collapsed={collapsed}
          focusKey={selectedDay ?? todayKey}
          canPrevious={canStepBack(viewedMonth, earliest)}
          canNext={canStepForward(viewedMonth, todayKey)}
          emptyNote={
            grid.some((cell) => cell.trained) ? null : `No workouts in ${monthName(viewedMonth)}.`
          }
          onPrevious={() => setMonth(shiftMonth(viewedMonth, -1))}
          onNext={() => setMonth(shiftMonth(viewedMonth, 1))}
          onToggleCollapsed={() => setFolded(!collapsed)}
          onSelectDay={handleSelectDay}
        />
        {strip !== null && <WeeklyVolumeStrip strip={strip} units={units} />}
      </View>

      {selectedDay === null ? (
        <Text style={styles.summaryLine}>
          {claimed.length} workout{claimed.length === 1 ? '' : 's'} logged
        </Text>
      ) : (
        <ShowingLine
          dayKey={selectedDay}
          count={shown.length}
          onClear={() => setSelectedDay(null)}
        />
      )}

      {/* A filter that matched nothing, not an account with no history — one
          line, and the way out is Clear. */}
      {shown.length === 0 && <Text style={styles.emptyDay}>No workout logged on this day.</Text>}

      {shown.map((log, i) => (
        <RevealRow key={log.id} index={Math.min(i, 6)}>
          <WorkoutRow
            log={log}
            units={units}
            expanded={expandedId === log.id}
            onToggle={() => handleToggle(log.id)}
          />
        </RevealRow>
      ))}
    </ScrollView>
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
  // Opaque: while it is pinned, the list scrolls underneath it.
  header: {
    backgroundColor: roles.surface,
    gap: spacing[3],
    paddingBottom: spacing[3],
  },
  headerMonth: {
    ...textStyles.caption,
    fontSize: 13,
    color: roles.textTertiary,
    marginRight: spacing[4],
  },
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
  summaryLine: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing[3],
  },
  emptyDay: {
    ...textStyles.caption,
    fontSize: 13,
    color: roles.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing[3],
  },
});
