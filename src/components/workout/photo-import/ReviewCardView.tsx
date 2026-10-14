// =============================================================================
// ReviewCardView — one card on the review screen
// =============================================================================
// The card as read, with its movements editable and every disagreement flagged.
// The footer repeats what the card itself says about the workout, so the person can
// check the read against the photo at a glance.

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldFlag } from '@/components/workout/photo-import/ReviewFlags';
import { ReviewRow } from '@/components/workout/photo-import/ReviewRow';
import { cardWarnings } from '@/lib/card-import/parse-card';
import type { Reading } from '@/lib/card-import/reconcile';
import { formatCardDate } from '@/lib/card-import/review';
import { radius, roles, spacing, textStyles } from '@/theme';

interface ReviewCardViewProps {
  reading: Reading;
  onEdit: (path: string, text: string) => void;
  onKeep: (path: string) => void;
  onRemoveRow: (index: number) => void;
  onRemoveCard: () => void;
}

export function ReviewCardView({
  reading,
  onEdit,
  onKeep,
  onRemoveRow,
  onRemoveCard,
}: ReviewCardViewProps) {
  const { card, disagreements } = reading;
  const flagsFor = (prefix: string) =>
    disagreements.filter((flag) => flag.path === prefix || flag.path.startsWith(`${prefix}.`));
  // Header-level flags (title, date, duration, totals) are all shown here, so no flag
  // can hold up a save without a way to clear it.
  const headerFlags = disagreements.filter((flag) => !flag.path.startsWith('rows.'));
  const warnings = cardWarnings(card);
  const footer = [
    card.durationMin !== null ? `${card.durationMin} min` : null,
    card.volumeLb !== null ? `${card.volumeLb.toLocaleString('en-US')} lb` : null,
    card.totalSets !== null ? `${card.totalSets} sets` : null,
  ].filter(Boolean);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{card.title ?? 'Untitled workout'}</Text>

      <View style={styles.dateLine}>
        {card.subtitle ? <Text style={styles.subtitle}>{card.subtitle}</Text> : null}
        {card.date ? (
          <Text style={styles.date}>{formatCardDate(card.date)}</Text>
        ) : (
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={roles.textTertiary}
            onChangeText={(text) => onEdit('date', text)}
            accessibilityLabel="Workout date"
          />
        )}
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
          onEdit={onEdit}
          onKeep={onKeep}
          onRemove={onRemoveRow}
        />
      ))}

      {footer.length > 0 ? (
        <Text style={styles.footer}>The card says: {footer.join(' · ')}</Text>
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
  dateInput: {
    ...textStyles.bodySmall,
    color: roles.textPrimary,
    borderWidth: 1,
    borderColor: roles.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    minWidth: 140,
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
