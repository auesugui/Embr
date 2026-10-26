// =============================================================================
// ShowingLine — what the list is filtered to, and the way out
// =============================================================================
// It sits where the count line was, next to the thing it filters, and carries
// the count so the two never disagree. Clear is the only exit besides tapping
// the selected day again.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDayLabel } from '@/lib/history-calendar';
import { radius, roles, spacing, textStyles } from '@/theme';

export function ShowingLine({
  dayKey,
  count,
  onClear,
}: {
  dayKey: string;
  count: number;
  onClear: () => void;
}) {
  const date = formatDayLabel(dayKey);
  // An empty day has nothing to count, and "· 0 workouts" is the line below.
  const label = count === 0 ? date : `${date} · ${count} workout${count === 1 ? '' : 's'}`;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Showing {label}</Text>
      <Pressable
        onPress={onClear}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Clear the day filter"
      >
        <Text style={styles.clear}>Clear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2.5],
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  label: {
    ...textStyles.caption,
    fontSize: 13,
    fontWeight: '600',
    color: roles.accentText,
    flexShrink: 1,
  },
  clear: {
    ...textStyles.caption,
    fontSize: 13,
    fontWeight: '700',
    color: roles.accentText,
  },
});
