// =============================================================================
// RecordList — the PR progression, newest first
// =============================================================================
// Each row reads old → new, so the jump is the fact on the line rather than
// something you work out by comparing two rows. The earliest record has no
// "old", and saying "0 →" there would be a number nobody lifted.

import { StyleSheet, Text, View } from 'react-native';

import {
  type ProgressMetric,
  type ProgressRecord,
  formatProgressAxis,
  formatProgressDate,
  formatProgressValue,
} from '@/lib/exercise-progress';
import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

export function RecordList({
  records,
  metric,
  units,
}: {
  /** Newest first. See progressRecords. */
  records: ProgressRecord[];
  metric: ProgressMetric;
  units: WeightUnit;
}) {
  return (
    <View style={styles.list}>
      {records.map((record, index) => (
        <View
          key={record.timestamp}
          style={[styles.row, index === records.length - 1 && styles.rowLast]}
        >
          <Text style={styles.date}>{formatProgressDate(record.timestamp)}</Text>
          <Text style={styles.value}>
            {/* The beaten record goes in bare — the new value beside it
                already states the unit. */}
            <Text style={styles.from}>
              {record.previous === null
                ? 'first record '
                : `${formatProgressAxis(record.previous, metric)} → `}
            </Text>
            {formatProgressValue(record.value, metric, units)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2.5],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: roles.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  date: {
    ...textStyles.bodySmall,
    color: roles.textSecondary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  value: {
    ...textStyles.label,
    color: roles.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  from: {
    color: roles.textMuted,
    fontWeight: '500',
  },
});
