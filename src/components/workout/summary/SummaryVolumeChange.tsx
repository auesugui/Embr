// =============================================================================
// SummaryVolumeChange — one sentence under the stats card
// =============================================================================
// Attached to the figure it comments on rather than crammed into the Volume
// cell: a bare "+480 lb" chip has no room to say WHAT it beat, and a comparison
// that does not name its reference reads as "against your last workout" — which
// on a split is a different day entirely.
//
// A lighter session gets the same sentence shape as a heavier one, in plain
// text rather than accent. No red, no warning, no percentage.

import { StyleSheet, Text } from 'react-native';

import { RevealRow } from '@/components/celebration';
import { ArrowDown, ArrowUp } from '@/components/icons';
import { type VolumeComparison, comparisonSentence } from '@/lib/summary-comparison';
import { roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

interface SummaryVolumeChangeProps {
  comparison: VolumeComparison;
  /** What the sentence calls the workout, e.g. `Push A`. */
  label: string;
  units: WeightUnit;
  /** Position in the screen's staggered reveal. */
  revealIndex: number;
}

export function SummaryVolumeChange({
  comparison,
  label,
  units,
  revealIndex,
}: SummaryVolumeChangeProps) {
  const up = comparison.direction === 'up';
  const color = up ? roles.accentText : roles.textSecondary;

  return (
    <RevealRow index={revealIndex} style={styles.line}>
      {/* Equal volume gets no arrow — there is no direction to point. */}
      {comparison.direction === 'up' && <ArrowUp size={14} color={color} />}
      {comparison.direction === 'down' && <ArrowDown size={14} color={color} />}
      <Text style={[styles.text, { color }]}>{comparisonSentence(comparison, label, units)}</Text>
    </RevealRow>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[1],
    // The stats card above already carries the gap; this sits against it.
    marginTop: -spacing[1.5],
    marginBottom: spacing[4],
  },
  text: {
    ...textStyles.caption,
    fontSize: 12.5,
    lineHeight: 12.5 * 1.45,
    flexShrink: 1,
  },
});
