// =============================================================================
// UnitSegment — which unit's history the exercise screen is showing
// =============================================================================
// Rendered only when the exercise has sessions in both units, which is the test
// used everywhere (#85 step 2). One group means no segment and no extra copy.
//
// The count sits in the control — "lb 10 / kg 3" answers where the history is
// before you tap anything, and it is the only place the split is stated as a
// number. The selected side is a RAISED PANEL rather than an ember fill, so the
// range chips below keep the one accent fill on this screen.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { UnitSeries } from '@/lib/exercise-progress';
import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

export function UnitSegment({
  sides,
  selected,
  onChange,
}: {
  /** One per unit with sessions, lb first. A side is never empty. */
  sides: UnitSeries[];
  selected: WeightUnit;
  onChange: (unit: WeightUnit) => void;
}) {
  return (
    <View style={styles.row}>
      {sides.map((side) => {
        const on = side.unit === selected;
        const count = side.points.length;
        return (
          <Pressable
            key={side.unit}
            style={[styles.side, on && styles.sideOn]}
            onPress={() => onChange(side.unit)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Show ${side.unit}, ${count} session${count === 1 ? '' : 's'}`}
          >
            <Text style={[styles.label, on && styles.labelOn]}>
              {side.unit}
              <Text style={[styles.count, on && styles.countOn]}> {count}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: roles.surfaceSunken,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    padding: 3,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  sideOn: {
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    // The border is inside the box on RN, so it would shrink the selected side
    // by a pixel against the other one. Taking it off the padding keeps both
    // sides the same height.
    marginVertical: -1,
    marginHorizontal: -1,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: 1,
  },
  label: {
    ...textStyles.caption,
    fontSize: 13,
    fontWeight: '600',
    color: roles.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  labelOn: {
    color: roles.textPrimary,
  },
  // The count is a reference, not the label: one step back on each side.
  count: {
    fontWeight: '500',
    color: roles.textMuted,
  },
  countOn: {
    color: roles.textTertiary,
  },
});
