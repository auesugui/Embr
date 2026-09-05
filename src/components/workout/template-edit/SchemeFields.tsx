// =============================================================================
// SchemeFields — the numbers behind whichever scheme is selected
// =============================================================================
// Which fields exist is the whole point: a set scheme has sets and reps, an
// AMRAP has a window and no set count, an EMOM has a cadence and a round plan.
// Showing all of them and disabling the irrelevant ones would ask the reader to
// work out which apply; showing only the applicable ones answers it.

import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  clampAmrapSeconds,
  clampIntervalSeconds,
  clampRounds,
  formatAmrapWindow,
  formatClock,
  hasRepTargets,
  isTimed,
} from '@/lib/blocks';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { BlockMode } from '@/types';
import { StepperButton } from './StepperButton';

interface SchemeFieldsProps {
  mode: BlockMode;
  sets: number;
  reps: string;
  rest: number;
  duration: number;
  interval: number;
  rounds: number;
  onSets: (next: (current: number) => number) => void;
  onReps: (next: string) => void;
  onRest: (next: (current: number) => number) => void;
  onDuration: (next: (current: number) => number) => void;
  onInterval: (next: (current: number) => number) => void;
  onRounds: (next: (current: number) => number) => void;
}

export function SchemeFields({
  mode,
  sets,
  reps,
  rest,
  duration,
  interval,
  rounds,
  onSets,
  onReps,
  onRest,
  onDuration,
  onInterval,
  onRounds,
}: SchemeFieldsProps) {
  const timedDraft = isTimed(mode);
  const keepsReps = hasRepTargets(mode);

  return (
    <>
      {/* Time cap — the window for the AMRAP modes, an optional ceiling
                for a for-time block. EMOM sets its length from the interval
                plan instead, so it has no cap of its own. */}
      {timedDraft && mode !== 'emom' && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{mode === 'for_time' ? 'Time cap' : 'Window'}</Text>
          <View style={styles.stepperRow}>
            <StepperButton
              label="-1m"
              onPress={() => onDuration((d) => clampAmrapSeconds(d - 60))}
            />
            <Text style={styles.fieldValue}>{formatAmrapWindow(duration)}</Text>
            <StepperButton
              label="+1m"
              onPress={() => onDuration((d) => clampAmrapSeconds(d + 60))}
            />
          </View>
        </View>
      )}

      {/* EMOM cadence. */}
      {mode === 'emom' && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Interval</Text>
          <View style={styles.stepperRow}>
            <StepperButton
              label="-15s"
              onPress={() => onInterval((d) => clampIntervalSeconds(d - 15))}
            />
            <Text style={styles.fieldValue}>{formatClock(interval)}</Text>
            <StepperButton
              label="+15s"
              onPress={() => onInterval((d) => clampIntervalSeconds(d + 15))}
            />
          </View>
        </View>
      )}

      {/* Round plan. Only the modes that know their round count up front
                have one — an AMRAP's round count is the result, not the plan. */}
      {(mode === 'for_time' || mode === 'emom') && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{mode === 'emom' ? 'Intervals' : 'Rounds'}</Text>
          <View style={styles.stepperRow}>
            <StepperButton label="-" onPress={() => onRounds((r) => clampRounds(r - 1))} />
            <Text style={styles.fieldValue}>{rounds}</Text>
            <StepperButton label="+" onPress={() => onRounds((r) => clampRounds(r + 1))} />
          </View>
        </View>
      )}

      {/* Sets stepper. A timed block has no planned set count — the clock
                or the round plan ends it. */}
      {!timedDraft && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Sets</Text>
          <View style={styles.stepperRow}>
            <StepperButton label="-" onPress={() => onSets((s) => Math.max(1, s - 1))} />
            <Text style={styles.fieldValue}>{sets}</Text>
            <StepperButton label="+" onPress={() => onSets((s) => Math.min(20, s + 1))} />
          </View>
        </View>
      )}

      {/* Reps. Survives into a timed block, because the reps per round
                are exactly what a circuit prescribes. */}
      {keepsReps && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{timedDraft ? 'Reps per round' : 'Reps'}</Text>
          <TextInput
            style={styles.repsInput}
            value={reps}
            onChangeText={onReps}
            placeholder={timedDraft ? '5' : '8-12'}
            placeholderTextColor={colors.text.muted}
            returnKeyType="done"
          />
        </View>
      )}

      {/* Rest stepper. Hidden for a timed block: the session deliberately
                never starts a rest timer inside one, so offering a rest value
                here would promise something the session won't do. */}
      {!timedDraft && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Rest (seconds)</Text>
          <View style={styles.stepperRow}>
            <StepperButton label="-15" onPress={() => onRest((r) => Math.max(0, r - 15))} />
            <Text style={styles.fieldValue}>{rest}s</Text>
            <StepperButton label="+15" onPress={() => onRest((r) => Math.min(600, r + 15))} />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing[4],
  },
  fieldLabel: {
    ...textStyles.label,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  fieldHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[2],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  fieldValue: {
    ...textStyles.number,
    color: colors.text.primary,
    fontSize: 22,
    minWidth: 80,
    textAlign: 'center',
  },
  repsInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    ...textStyles.body,
    fontSize: 18,
    textAlign: 'center',
  },
});
