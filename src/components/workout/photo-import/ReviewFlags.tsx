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
  accepts,
  rule,
  noun,
  onChoose,
}: {
  flag: Disagreement;
  /**
   * What the field can hold. A reading the field would refuse is named in the
   * question but is not offered, because a button that does nothing when pressed is
   * worse than one that is not there.
   */
  accepts?: (value: string) => unknown;
  /** Why a reading was left out. Printed only when one was. */
  rule?: string;
  /** What the field holds, for the line that says neither reading is one. */
  noun?: string;
  onChoose: (value: string) => void;
}) {
  const offered = [flag.first, flag.second].filter((value) => !accepts || accepts(value) !== null);

  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>
        {offered.length === 0 && noun
          ? `Neither reading is a ${noun}. Type it.`
          : `Read as ${shown(flag.first)} or ${shown(flag.second)}. Which is right?`}
      </Text>
      {offered.length > 0 ? (
        <View style={styles.choices}>
          {offered.map((value) => (
            <Choice key={value} label={shown(value)} onPress={() => onChoose(value)} />
          ))}
        </View>
      ) : null}
      {rule && offered.length === 1 ? (
        <Text style={styles.rule}>
          {shown(offered[0] === flag.first ? flag.second : flag.first)} is not a {noun}, so it is
          not offered. {rule}
        </Text>
      ) : null}
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
  rule: {
    ...textStyles.captionSmall,
    color: roles.accentText,
    opacity: 0.82,
    marginTop: spacing[2],
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
