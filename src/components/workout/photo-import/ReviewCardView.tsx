// =============================================================================
// ReviewCardView — one card on the review screen
// =============================================================================
// The card as read, with its movements editable and every disagreement flagged. Each
// movement shows the library exercise it will be copied as. The footer repeats what the
// card itself says about the workout, so the person can check the read against the
// photo at a glance.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldFlag } from '@/components/workout/photo-import/ReviewFlags';
import { type MovementMatch, ReviewRow } from '@/components/workout/photo-import/ReviewRow';
import type { ParsedRow } from '@/lib/card-import/parse-card';
import { cardWarnings } from '@/lib/card-import/parse-card';
import type { Reading } from '@/lib/card-import/reconcile';
import { formatCardDate } from '@/lib/card-import/review';
import { radius, roles, spacing, textStyles } from '@/theme';

interface ReviewCardViewProps {
  reading: Reading;
  matchFor: (row: ParsedRow) => MovementMatch;
  onEdit: (path: string, text: string) => void;
  onKeep: (path: string) => void;
  onRemoveRow: (index: number) => void;
  onRemoveCard: () => void;
  onChoose: (rowId: string) => void;
  onToggleSkip: (rowId: string) => void;
}

export function ReviewCardView({
  reading,
  matchFor,
  onEdit,
  onKeep,
  onRemoveRow,
  onRemoveCard,
  onChoose,
  onToggleSkip,
}: ReviewCardViewProps) {
  const { card, disagreements } = reading;
  const flagsFor = (prefix: string) =>
    disagreements.filter((flag) => flag.path === prefix || flag.path.startsWith(`${prefix}.`));
  // Header-level flags (title, date, duration, totals) are all shown here, so no flag
  // can hold up a save without a way to clear it.
  const headerFlags = disagreements.filter((flag) => !flag.path.startsWith('rows.'));
  const warnings = cardWarnings(card);
  const plan = card.format === 'plan';
  // The card's own check line: what the photo says about the workout as a whole, so the
  // read can be checked against it at a glance. None of it is stored.
  const footer = plan
    ? [card.weekDay, `${card.rows.length} ${card.rows.length === 1 ? 'movement' : 'movements'}`]
    : [
        card.durationMin !== null ? `${card.durationMin} min` : null,
        card.volumeLb !== null ? `${card.volumeLb.toLocaleString('en-US')} lb` : null,
        card.totalSets !== null ? `${card.totalSets} sets` : null,
      ];

  return (
    <View style={styles.card}>
      {card.format ? (
        <Text style={styles.format}>{plan ? 'Plan card' : 'Workout card'}</Text>
      ) : null}
      <Text style={styles.title}>{card.title ?? 'Untitled workout'}</Text>

      <View style={styles.dateLine}>
        {card.subtitle ? <Text style={styles.subtitle}>{card.subtitle}</Text> : null}
        {card.date ? <Text style={styles.date}>{formatCardDate(card.date)}</Text> : null}
      </View>
      {headerFlags.map((flag) => (
        <FieldFlag key={flag.path} flag={flag} onChoose={(v) => onEdit(flag.path, v)} />
      ))}

      {card.rows.map((row, index) => (
        <ReviewRow
          key={row.id}
          index={index}
          row={row}
          flags={flagsFor(`rows.${index}`)}
          match={matchFor(row)}
          plan={plan}
          onEdit={onEdit}
          onKeep={onKeep}
          onRemove={onRemoveRow}
          onChoose={() => onChoose(row.id)}
          onToggleSkip={() => onToggleSkip(row.id)}
        />
      ))}

      {footer.some(Boolean) ? (
        <Text style={styles.footer}>The card says: {footer.filter(Boolean).join(' · ')}</Text>
      ) : null}
      {warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>
          {warning}
        </Text>
      ))}

      <Pressable onPress={onRemoveCard} accessibilityRole="button" style={styles.remove}>
        <Text style={styles.removeText}>Remove this card</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  format: {
    ...textStyles.captionSmall,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: roles.textMuted,
    marginBottom: spacing[1],
  },
  title: {
    ...textStyles.h4,
    color: roles.textPrimary,
  },
  dateLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
  },
  date: {
    ...textStyles.bodySmall,
    color: roles.textSecondary,
  },
  footer: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[3],
  },
  warning: {
    ...textStyles.caption,
    color: roles.accentText,
    marginTop: spacing[1],
  },
  remove: {
    alignSelf: 'flex-start',
    marginTop: spacing[3],
    paddingVertical: spacing[1],
  },
  removeText: {
    ...textStyles.label,
    color: roles.textMuted,
  },
});
