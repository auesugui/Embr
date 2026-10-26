// =============================================================================
// SummaryPRs — the records this session beat
// =============================================================================
// Sits directly under the summary's headline, because it is the one thing that
// is true of this session and no other. Absent entirely when nothing was
// beaten: nothing takes its place and nothing says the session was short of a
// record.
//
// Three rows, then a count. Three keeps the block shorter than the stats card
// underneath, so the summary still opens on the numbers rather than on a list,
// and a session with five or more PRs — usually the first week back after a
// layoff — should feel good without taking over the screen.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RevealRow } from '@/components/celebration';
import { Award, ChevronDown, ChevronUp } from '@/components/icons';
import { formatProgressAxis, formatProgressValue } from '@/lib/exercise-progress';
import { PR_COLLAPSE_AT, PR_ROWS_SHOWN, type SessionRecord } from '@/lib/summary-records';
import { displayFamilies, radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';
import { haptics } from '@/utils/haptics';

interface SummaryPRsProps {
  /** In session order. Nothing renders when empty. */
  records: SessionRecord[];
  units: WeightUnit;
  /** Position in the screen's staggered reveal. */
  revealIndex: number;
}

export function SummaryPRs({ records, units, revealIndex }: SummaryPRsProps) {
  const [open, setOpen] = useState(false);

  if (records.length === 0) return null;

  const collapsible = records.length >= PR_COLLAPSE_AT;
  const shown = collapsible && !open ? records.slice(0, PR_ROWS_SHOWN) : records;
  const label = open ? 'Show less' : `Show ${records.length - PR_ROWS_SHOWN} more`;

  const toggle = () => {
    haptics.tap();
    setOpen((was) => !was);
  };

  return (
    <RevealRow index={revealIndex} style={styles.card}>
      <View style={styles.heading}>
        <Award size={18} color={roles.accent} />
        <Text style={styles.headingText}>New PRs</Text>
      </View>

      {shown.map((record, index) => (
        <View
          key={record.exerciseId}
          style={[styles.row, !collapsible && index === shown.length - 1 && styles.rowLast]}
        >
          <Text style={styles.name}>{record.name}</Text>
          {/* The old number is muted and bare, the new one carries the accent
              and the unit, so the row reads as the jump it was. */}
          <Text style={styles.change}>
            <Text style={styles.from}>
              {`${formatProgressAxis(record.previous, record.metric)} → `}
            </Text>
            {formatProgressValue(record.value, record.metric, units)}
          </Text>
        </View>
      ))}

      {collapsible && (
        <Pressable
          style={styles.more}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={styles.moreText}>{label}</Text>
          {open ? (
            <ChevronUp size={15} color={roles.accentText} />
          ) : (
            <ChevronDown size={15} color={roles.accentText} />
          )}
        </Pressable>
      )}
    </RevealRow>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1.5],
    marginBottom: spacing[4],
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  headingText: {
    fontFamily: displayFamilies.semibold,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 17 * 1.2,
    color: roles.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: roles.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  name: {
    ...textStyles.body,
    fontSize: 15,
    color: roles.textPrimary,
    flexShrink: 1,
  },
  change: {
    ...textStyles.label,
    fontWeight: '600',
    color: roles.accentText,
    fontVariant: ['tabular-nums'],
  },
  from: {
    fontWeight: '500',
    color: roles.textMuted,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingTop: spacing[2.5],
    paddingBottom: spacing[2],
  },
  moreText: {
    ...textStyles.bodySmall,
    fontSize: 13,
    fontWeight: '600',
    color: roles.accentText,
  },
});
