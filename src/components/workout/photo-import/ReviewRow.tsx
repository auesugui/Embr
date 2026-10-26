// =============================================================================
// ReviewRow — one movement on a card being checked
// =============================================================================
// The movement name on its own line, so a long name is never cut off. Beneath it, the
// library exercise it will be copied as, with a choice to change or skip it. Then its
// sets and reps, each labelled. Every field is editable, because a read can be wrong
// in any of them. The weight is read for reference only: a copied workout has none,
// and a plan card has no weight to show, so that box is absent rather than empty.

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldFlag, MovementFlag } from '@/components/workout/photo-import/ReviewFlags';
import type { ParsedRow } from '@/lib/card-import/parse-card';
import { isCutOffName, missingValues, readReps } from '@/lib/card-import/parse-card';
import type { Disagreement } from '@/lib/card-import/reconcile';

import { radius, roles, spacing, textStyles } from '@/theme';

/** How a movement on the card lines up with the library. */
export type MovementMatch =
  | { kind: 'matched'; exerciseName: string }
  | { kind: 'unmatched' }
  | { kind: 'skipped' }
  | { kind: 'present'; exerciseName: string };

interface ReviewRowProps {
  index: number;
  row: ParsedRow;
  /** Every flag on this movement, and on its own row. */
  flags: Disagreement[];
  match: MovementMatch;
  /** A plan card's row: no weight was read, and the reps box holds a range. */
  plan: boolean;
  onEdit: (path: string, text: string) => void;
  onKeep: (path: string) => void;
  onRemove: (index: number) => void;
  onChoose: () => void;
  onToggleSkip: () => void;
}

export function ReviewRow({
  index,
  row,
  flags,
  match,
  plan,
  onEdit,
  onKeep,
  onRemove,
  onChoose,
  onToggleSkip,
}: ReviewRowProps) {
  const flagOn = (field: string) => flags.find((flag) => flag.path === `rows.${index}.${field}`);
  const movementFlag = flags.find((flag) => flag.path === `rows.${index}`);
  const nameFlag = flagOn('name');
  const setsFlag = flagOn('sets');
  const weightFlag = flagOn('weightLb');
  const repsFlag = flagOn('reps');
  const movement = `Movement ${index + 1}`;
  // The name is the thing that is wrong, so it carries the flagged border until the
  // movement is settled, the way a disagreed value does.
  const cutOff = match.kind === 'unmatched' && isCutOffName(row.name);
  const faint = match.kind === 'skipped';
  // A value the card never gave is flagged like one the readings disagree on: the
  // field is where it gets settled, and nothing is copied until it is.
  const missing = missingValues(row);

  return (
    <View style={styles.wrap}>
      {movementFlag ? (
        <MovementFlag
          flag={movementFlag}
          onKeep={() => onKeep(`rows.${index}`)}
          onRemove={() => onRemove(index)}
        />
      ) : null}

      <TextInput
        style={[styles.name, (nameFlag || cutOff) && styles.flagged]}
        value={row.name}
        onChangeText={(text) => onEdit(`rows.${index}.name`, text)}
        accessibilityLabel={`${movement} name`}
      />
      {nameFlag ? <FieldFlag flag={nameFlag} onChoose={(v) => onEdit(nameFlag.path, v)} /> : null}

      <View style={styles.matchRow}>
        <Text style={[styles.matchText, match.kind === 'unmatched' && styles.matchNeeded]}>
          {cutOff
            ? 'The name is cut off on the card. Choose the exercise, or skip it.'
            : matchLabel(match)}
        </Text>
        {match.kind === 'present' ? null : (
          <View style={styles.matchActions}>
            {match.kind === 'skipped' ? null : (
              <Pressable
                onPress={onChoose}
                accessibilityRole="button"
                accessibilityLabel={`${movement}: choose exercise`}
              >
                <Text style={styles.matchAction}>
                  {match.kind === 'matched' ? 'Change' : 'Choose'}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onToggleSkip}
              accessibilityRole="button"
              accessibilityLabel={
                match.kind === 'skipped' ? `${movement}: include` : `${movement}: skip`
              }
            >
              <Text style={styles.matchAction}>{match.kind === 'skipped' ? 'Undo' : 'Skip'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.figures}>
        <Figure
          label="Sets"
          accessibilityLabel={`${movement} sets`}
          value={row.sets === null ? '' : String(row.sets)}
          flagged={setsFlag !== undefined || missing.includes('sets')}
          faint={faint}
          onChangeText={(text) => onEdit(`rows.${index}.sets`, text)}
        />
        <Figure
          label="Reps"
          accessibilityLabel={`${movement} reps`}
          value={row.reps}
          // The one text field on the screen: a rep range is not something a number pad types.
          text
          wide={plan}
          flagged={repsFlag !== undefined || missing.includes('reps')}
          faint={faint}
          onChangeText={(text) => onEdit(`rows.${index}.reps`, text)}
        />
        {plan ? null : (
          <Figure
            label="Card lb"
            accessibilityLabel={`${movement} weight in pounds, for reference`}
            value={row.weightLb === null ? '' : String(row.weightLb)}
            placeholder="bw"
            flagged={weightFlag !== undefined}
            faint={faint}
            onChangeText={(text) => onEdit(`rows.${index}.weightLb`, text)}
          />
        )}
      </View>
      {setsFlag ? <FieldFlag flag={setsFlag} onChoose={(v) => onEdit(setsFlag.path, v)} /> : null}
      {repsFlag ? (
        <FieldFlag
          flag={repsFlag}
          accepts={readReps}
          rule="A range is two whole numbers from 1 to 99, low first. One number on its own works too."
          noun="rep range"
          onChoose={(v) => onEdit(repsFlag.path, v)}
        />
      ) : null}
      {weightFlag ? (
        <FieldFlag flag={weightFlag} onChoose={(v) => onEdit(weightFlag.path, v)} />
      ) : null}
    </View>
  );
}

function matchLabel(match: MovementMatch): string {
  switch (match.kind) {
    case 'matched':
      return `Exercise: ${match.exerciseName}`;
    case 'unmatched':
      return 'No matching exercise. Choose one, or skip it.';
    case 'skipped':
      return 'Skipped. It won’t be copied.';
    case 'present':
      return `${match.exerciseName} is already in this workout.`;
  }
}

function Figure({
  label,
  accessibilityLabel,
  value,
  placeholder,
  flagged,
  faint,
  text,
  wide,
  onChangeText,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  placeholder?: string;
  flagged: boolean;
  /** The movement is skipped, so its figures are read but not copied. */
  faint?: boolean;
  text?: boolean;
  wide?: boolean;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <TextInput
        style={[
          styles.figureInput,
          wide && styles.figureWide,
          flagged && styles.flagged,
          faint && styles.faint,
        ]}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={roles.textTertiary}
        onChangeText={onChangeText}
        keyboardType={text ? 'default' : 'number-pad'}
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: roles.divider,
  },
  name: {
    ...textStyles.body,
    color: roles.textPrimary,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  matchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginTop: spacing[1],
    paddingHorizontal: spacing[2],
  },
  matchText: {
    ...textStyles.bodySmall,
    color: roles.textSecondary,
    flexShrink: 1,
  },
  matchNeeded: {
    color: roles.accentText,
  },
  matchActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  matchAction: {
    ...textStyles.label,
    color: roles.accentText,
  },
  figures: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  figure: {
    gap: spacing[1],
  },
  figureLabel: {
    ...textStyles.caption,
    color: roles.textMuted,
  },
  figureWide: {
    width: 100,
  },
  faint: {
    color: roles.textTertiary,
  },
  figureInput: {
    ...textStyles.body,
    width: 76,
    textAlign: 'center',
    color: roles.textPrimary,
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: roles.border,
  },
  flagged: {
    borderColor: roles.accent,
    backgroundColor: roles.accentSubtle,
  },
});
