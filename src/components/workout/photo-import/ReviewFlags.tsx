// =============================================================================
// ReviewFlags — the readings a person chooses between
// =============================================================================
// When the two readings of a photo disagree, the value is shown with both readings
// as choices, and nothing is saved until one is picked. A movement only one reading
// found gets Keep or Remove. The flagged value is shown in the accent colour: it is
// the one thing on the card that needs a decision.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Disagreement } from '@/lib/card-import/reconcile';
import { radius, roles, spacing, textStyles } from '@/theme';

const shown = (value: string): string => (value === 'nothing' ? 'no value' : value);

export function FieldFlag({
  flag,
  onChoose,
}: {
  flag: Disagreement;
  onChoose: (value: string) => void;
}) {
  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>
        Read as {shown(flag.first)} or {shown(flag.second)}. Which is right?
      </Text>
      <View style={styles.choices}>
        <Choice label={shown(flag.first)} onPress={() => onChoose(flag.first)} />
        <Choice label={shown(flag.second)} onPress={() => onChoose(flag.second)} />
      </View>
    </View>
  );
}

export function MovementFlag({
  flag,
  onKeep,
  onRemove,
}: {
  flag: Disagreement;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const onlyFirst = flag.second === 'not found';
  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>
        {onlyFirst ? 'Only the first reading found' : 'Only the second reading found'} this
        movement.
      </Text>
      <View style={styles.choices}>
        <Choice label="Keep" onPress={onKeep} />
        <Choice label="Remove" onPress={onRemove} />
      </View>
    </View>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Use ${label}`}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flag: {
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.md,
    padding: spacing[2],
    marginTop: spacing[1],
  },
  flagText: {
    ...textStyles.caption,
    color: roles.accentText,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  choice: {
    borderWidth: 1,
    borderColor: roles.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
  },
  choicePressed: {
    backgroundColor: roles.accentMuted,
  },
  choiceText: {
    ...textStyles.label,
    color: roles.accentText,
  },
});
