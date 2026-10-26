// =============================================================================
// MuscleBalanceCard — sets per muscle this week, ranked
// =============================================================================
// Hevy register: dense, tabular, undecorated. The bar is a share of the week's
// biggest muscle, so it says "against your biggest muscle this week" and
// nothing about a target — the card reports, it does not grade.
//
// A row does nothing when tapped and must not look like it could: the honest
// destination is the Exercises list filtered to that muscle, which does not
// exist, and the Exercises list sits directly underneath this card anyway.
// Show all is the only control. It expands in place and resets on leaving the
// tab, which is why it is component state and not a setting.
//
// The bars carry nothing the numbers do not, so they are hidden from assistive
// tech and each row announces its own name and count instead.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  COLLAPSED_ROWS,
  type MuscleBalance,
  type MuscleBalanceRow as MuscleRow,
  OTHER_GROUP,
  balanceReadingSegments,
  describeBalance,
  describeRow,
  showAllLabel,
  visibleRows,
} from '@/lib/muscle-balance';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

/** The smallest bar that still reads as a bar: one set against a huge week. */
const BAR_FLOOR = 6;

export function MuscleBalanceCard({ balance }: { balance: MuscleBalance }) {
  const [expanded, setExpanded] = useState(false);

  // The tab stays mounted behind the other tabs, so without this the card is
  // still open hours later. Show all is a readout, not a mode to get stuck in.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  const rows = visibleRows(balance.rows, expanded);
  const collapsible = balance.rows.length > COLLAPSED_ROWS;
  const toggleLabel = expanded ? 'Show less' : showAllLabel(balance.rows);

  const toggle = () => {
    haptics.tap();
    setExpanded((was) => !was);
  };

  return (
    <View style={styles.card}>
      {/* The dates stay in the header on an empty week, so the tab does not
          reflow every Monday. What a quiet week loses is the rows. */}
      <View
        style={styles.head}
        accessibilityRole="header"
        accessibilityLabel={describeBalance(balance)}
      >
        <Text style={styles.heading}>Sets per muscle</Text>
        <Text style={styles.range}>{balance.range}</Text>
      </View>

      {rows.length > 0 && (
        <View style={styles.rows}>
          {rows.map((row) => (
            <Row key={row.group} row={row} />
          ))}
        </View>
      )}

      <Text style={[styles.reading, rows.length === 0 && styles.readingAlone]}>
        {balanceReadingSegments(balance).map((segment) => (
          <Text key={segment.id} style={segment.strong ? styles.readingValue : undefined}>
            {segment.text}
          </Text>
        ))}
      </Text>

      {/* The cost of counting one muscle a set, stated where the whole list is
          on screen. It does not fit the collapsed card's height budget, and
          "the first time it appears" would need something persisted. */}
      {expanded && <Text style={styles.footnote}>Counts follow each exercise’s main muscle.</Text>}

      {collapsible && (
        <Pressable
          style={styles.toggle}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={expanded ? toggleLabel : `${toggleLabel} muscles`}
        >
          <Text style={styles.toggleText}>{toggleLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Other is grey rather than ember: it is not a muscle and should not lead the eye. */
function Row({ row }: { row: MuscleRow }) {
  const other = row.group === OTHER_GROUP;

  return (
    // One a11y node per row, with the bar inside it: `image` is the only role
    // React Native Web collapses children into, and it is the same one the
    // weekly volume strip uses to speak a graphic as a sentence.
    <View accessibilityRole="image" accessibilityLabel={describeRow(row)}>
      <View style={styles.rowLine}>
        <Text style={styles.rowName}>{row.label}</Text>
        <Text style={styles.rowSets}>{row.sets}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${row.share * 100}%` }, other && styles.fillOther]} />
      </View>
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
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: roles.textSecondary,
  },
  range: {
    ...textStyles.captionSmall,
    fontSize: 11,
    lineHeight: 16,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rows: {
    marginTop: spacing[2],
    gap: 7,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2.5],
  },
  rowName: {
    ...textStyles.label,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: roles.textPrimary,
  },
  rowSets: {
    ...textStyles.label,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    color: roles.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // `border` rather than `surfaceSunken`, for the reason WeeklyVolumeStrip
  // gives: sunken is darker than the card on dark and turns the track into a
  // hole instead of a faint step away from it.
  track: {
    height: 5,
    marginTop: 3,
    borderRadius: 3,
    backgroundColor: roles.border,
  },
  fill: {
    height: '100%',
    minWidth: BAR_FLOOR,
    borderRadius: 3,
    backgroundColor: roles.accent,
  },
  fillOther: {
    backgroundColor: roles.textMuted,
  },
  reading: {
    ...textStyles.caption,
    fontSize: 12.5,
    lineHeight: 18,
    color: roles.textTertiary,
    marginTop: spacing[2],
  },
  readingAlone: {
    marginTop: spacing[2.5],
  },
  readingValue: {
    color: roles.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    ...textStyles.captionSmall,
    fontSize: 11.5,
    lineHeight: 16,
    color: roles.textMuted,
    marginTop: spacing[1.5],
  },
  toggle: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: roles.border,
    marginTop: spacing[2],
    paddingTop: spacing[2],
  },
  toggleText: {
    ...textStyles.caption,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    color: roles.accentText,
  },
});
