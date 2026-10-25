// =============================================================================
// WeeklyHero — the home hero card, counting the week against the goal
// =============================================================================
// Finch register, and the same shape the daily streak had: tall, centred, one
// number, deliberately under-filled (the care-companion zone, ADR-0013). The
// dot row sits where the label already was, and the weekly streak is said in
// words in the serif line rather than given a second figure — two numbers
// competing for one glance is where a hero becomes a dashboard.

import { StyleSheet, Text, View } from 'react-native';

import { CountUpText } from '@/components/celebration';
import { Flame } from '@/components/icons';
import { WEEK_DAY_INITIALS, weekDayKeys } from '@/lib/local-week';
import { type WeekProgress, goalMet } from '@/lib/weekly-goal';
import { radius, roles, spacing, textStyles } from '@/theme';

interface WeeklyHeroProps {
  progress: WeekProgress;
  /** The one serif line, from `weeklyGoalLine`. */
  line: string;
}

/** The card's contents. The card itself stays on Home, which owns the zone. */

export function WeeklyHero({ progress, line }: WeeklyHeroProps) {
  const trained = new Set(progress.trainedDays);
  const met = goalMet(progress);
  // Ember as soon as the week is under way or a run is alive; otherwise grey.
  const live = trained.size > 0 || progress.streak > 0;

  return (
    <>
      <View style={styles.mark}>
        <Flame size={28} color={live ? roles.accent : roles.textMuted} strokeWidth={1.75} />
      </View>
      <CountUpText
        value={trained.size}
        suffix={` of ${progress.goal}`}
        style={met ? [styles.value, styles.valueMet] : styles.value}
      />
      <Text style={styles.unit}>this week</Text>

      {/* A filled dot is a day you trained; an empty one is drawn the same
          whether it is past or still to come. Nothing is marked as missed. */}
      <View style={styles.dots}>
        {weekDayKeys(progress.weekKey).map((day, i) => {
          const done = trained.has(day);
          const today = day === progress.todayKey;
          return (
            <View key={day} style={styles.day}>
              {/* Today carries a ring. On a day already trained it has to sit
                  outside the fill, so the slot draws it and leaves a gap. */}
              <View style={[styles.slot, done && today && styles.slotRing]}>
                <View
                  style={[styles.dot, done && styles.dotDone, today && !done && styles.dotToday]}
                />
              </View>
              <Text style={today ? [styles.dayLetter, styles.dayLetterToday] : styles.dayLetter}>
                {WEEK_DAY_INITIALS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.line}>{line}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  mark: {
    marginBottom: spacing[2],
  },
  value: {
    ...textStyles.hero,
    color: roles.textPrimary,
    fontSize: 46,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  valueMet: {
    color: roles.accentText,
  },
  unit: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.3,
  },

  // --- Day row --------------------------------------------------------------
  dots: {
    flexDirection: 'row',
    gap: spacing[1.5],
    marginTop: spacing[4],
  },
  day: {
    alignItems: 'center',
    gap: spacing[1],
  },
  slot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRing: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: roles.accent,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: roles.border,
  },
  dotDone: {
    backgroundColor: roles.accent,
    borderColor: roles.accent,
  },
  dotToday: {
    borderColor: roles.accent,
    borderWidth: 2,
  },
  dayLetter: {
    ...textStyles.captionSmall,
    color: roles.textMuted,
  },
  dayLetterToday: {
    color: roles.accentText,
    fontWeight: '700',
  },

  line: {
    ...textStyles.displaySmall,
    color: roles.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing[4],
    textAlign: 'center',
    maxWidth: 260,
  },
});
