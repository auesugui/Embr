// =============================================================================
// ReviewRow — one movement on a card being checked
// =============================================================================
// The movement name on its own line, so a long name is never cut off, then its
// sets, best-set weight and reps underneath, each labelled. Every field is
// editable, because a read can be wrong in any of them. An empty weight means a
// bodyweight movement.

import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldFlag, MovementFlag } from '@/components/workout/photo-import/ReviewFlags';
import type { ParsedRow } from '@/lib/card-import/parse-card';
import type { Disagreement } from '@/lib/card-import/reconcile';
import { radius, roles, spacing, textStyles } from '@/theme';

interface ReviewRowProps {
  index: number;
  row: ParsedRow;
  /** Every flag on this movement, and on its own row. */
  flags: Disagreement[];
  onEdit: (path: string, text: string) => void;
  onKeep: (path: string) => void;
  onRemove: (index: number) => void;
}

export function ReviewRow({ index, row, flags, onEdit, onKeep, onRemove }: ReviewRowProps) {
  const flagOn = (field: string) => flags.find((flag) => flag.path === `rows.${index}.${field}`);
  const movementFlag = flags.find((flag) => flag.path === `rows.${index}`);
  const nameFlag = flagOn('name');
  const setsFlag = flagOn('sets');
  const weightFlag = flagOn('weightLb');
  const repsFlag = flagOn('reps');
  const movement = `Movement ${index + 1}`;

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
        style={[styles.name, nameFlag && styles.flagged]}
        value={row.name}
        onChangeText={(text) => onEdit(`rows.${index}.name`, text)}
        accessibilityLabel={`${movement} name`}
      />
      {nameFlag ? <FieldFlag flag={nameFlag} onChoose={(v) => onEdit(nameFlag.path, v)} /> : null}

      <View style={styles.figures}>
        <Figure
          label="Sets"
          accessibilityLabel={`${movement} sets`}
          value={String(row.sets)}
          flagged={setsFlag !== undefined}
          onChangeText={(text) => onEdit(`rows.${index}.sets`, text)}
        />
        <Figure
          label="lb"
          accessibilityLabel={`${movement} weight in pounds`}
          value={row.weightLb === null ? '' : String(row.weightLb)}
          placeholder="bw"
          flagged={weightFlag !== undefined}
          onChangeText={(text) => onEdit(`rows.${index}.weightLb`, text)}
        />
        <Figure
          label="Reps"
          accessibilityLabel={`${movement} reps`}
          value={String(row.reps)}
          flagged={repsFlag !== undefined}
          onChangeText={(text) => onEdit(`rows.${index}.reps`, text)}
        />
      </View>
      {setsFlag ? <FieldFlag flag={setsFlag} onChoose={(v) => onEdit(setsFlag.path, v)} /> : null}
      {weightFlag ? (
        <FieldFlag flag={weightFlag} onChoose={(v) => onEdit(weightFlag.path, v)} />
      ) : null}
      {repsFlag ? <FieldFlag flag={repsFlag} onChoose={(v) => onEdit(repsFlag.path, v)} /> : null}
    </View>
  );
}

function Figure({
  label,
  accessibilityLabel,
  value,
  placeholder,
  flagged,
  onChangeText,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  placeholder?: string;
  flagged: boolean;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <TextInput
        style={[styles.figureInput, flagged && styles.flagged]}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={roles.textTertiary}
        onChangeText={onChangeText}
        keyboardType="number-pad"
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
