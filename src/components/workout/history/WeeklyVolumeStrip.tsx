// =============================================================================
// WeeklyVolumeStrip — twelve weeks of volume, as a row of tracks
// =============================================================================
// Every week gets a faint full-height track, so a week you did not train is an
// obviously empty slot rather than a missing bar you have to count to notice,
// and the row stays a calendar of weeks in date order.
//
// A bar is a readout and does nothing when tapped: at 17 px it is well under a
// touch target, and a week filter beside the day filter needs a rule for what
// a day tap means while a week is selected.

import { StyleSheet, Text, View } from 'react-native';

import { formatMonthDay } from '@/lib/history-calendar';
import {
  type VolumeStrip,
  type VolumeWeek,
  describeWindow,
  volumeReading,
  volumeReadingSegments,
} from '@/lib/weekly-volume';
import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

const TRACK_HEIGHT = 52;
const BAR_WIDTH = 17;
/** The smallest mark that still says you were here — a week of holds. */
const ZERO_TICK = 3;

export function WeeklyVolumeStrip({ strip, units }: { strip: VolumeStrip; units: WeightUnit }) {
  const reading = volumeReading(strip, units);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.heading}>Weekly volume</Text>
        <Text style={styles.window}>{describeWindow(strip, units)}</Text>
      </View>

      <View style={styles.bars} accessibilityRole="image" accessibilityLabel={reading}>
        {strip.weeks.map((week) => (
          <Bar key={week.weekKey} week={week} max={strip.max} />
        ))}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{formatMonthDay(strip.weeks[0].weekKey)}</Text>
        <Text style={styles.axisLabel}>this week</Text>
      </View>

      <Text style={styles.reading}>
        {volumeReadingSegments(strip, units).map((segment) => (
          <Text key={segment.id} style={segment.strong ? styles.readingValue : undefined}>
            {segment.text}
          </Text>
        ))}
      </Text>
    </View>
  );
}

/** Scaled to the tallest week in view, so the shape is always readable. */
function Bar({ week, max }: { week: VolumeWeek; max: number }) {
  const scaled = max > 0 ? Math.round((week.volume / max) * TRACK_HEIGHT) : 0;
  const height = week.trained ? Math.max(ZERO_TICK, scaled) : 0;
  const tick = height <= ZERO_TICK;

  return (
    <View style={styles.track}>
      {height > 0 && (
        <View
          style={[
            styles.fill,
            { height },
            tick && styles.fillTick,
            !tick && week.inProgress && styles.fillNow,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingTop: spacing[2.5],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2.5],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  heading: {
    ...textStyles.captionSmall,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: roles.textSecondary,
  },
  window: {
    ...textStyles.captionSmall,
    fontSize: 11,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: TRACK_HEIGHT,
    marginTop: spacing[2],
  },
  // `border` rather than `surfaceSunken`: the track has to read as a faint
  // step away from the card in both palettes, and sunken is darker than the
  // card on dark, which turns every empty week into a hole.
  track: {
    width: BAR_WIDTH,
    height: '100%',
    backgroundColor: roles.border,
    borderRadius: 3,
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    backgroundColor: roles.accent,
    borderRadius: 3,
  },
  // Open at the top: the week is in progress, so the bar says the number is
  // still running rather than pretending to be a finished week.
  fillNow: {
    backgroundColor: roles.accentSubtle,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: roles.accent,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  fillTick: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  axisLabel: {
    ...textStyles.captionSmall,
    fontSize: 10,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
  },
  reading: {
    ...textStyles.caption,
    fontSize: 12.5,
    lineHeight: 18,
    color: roles.textTertiary,
    marginTop: spacing[1.5],
  },
  readingValue: {
    color: roles.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
