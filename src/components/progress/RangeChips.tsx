// =============================================================================
// RangeChips — the chart's window
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PROGRESS_RANGES, type ProgressRange } from '@/lib/exercise-progress';
import { radius, roles, spacing, textStyles } from '@/theme';

export function RangeChips({
  value,
  onChange,
}: {
  value: ProgressRange;
  onChange: (range: ProgressRange) => void;
}) {
  return (
    <View style={styles.row}>
      {PROGRESS_RANGES.map((range) => {
        const selected = range === value;
        return (
          <Pressable
            key={range}
            style={[styles.chip, selected && styles.chipOn]}
            onPress={() => onChange(range)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${range}`}
          >
            <Text style={[styles.label, selected && styles.labelOn]}>{range}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[1.5],
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: roles.surfaceSunken,
    borderRadius: radius.md,
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
  },
  chipOn: {
    backgroundColor: roles.accent,
  },
  label: {
    ...textStyles.caption,
    color: roles.textSecondary,
    fontWeight: '600',
  },
  labelOn: {
    color: roles.onAccent,
  },
});
