// =============================================================================
// TemplateEditHeader — the template's identity
// =============================================================================
// The name is editable in place rather than behind a rename dialog: it is the
// one field on this screen you change most, and a dialog for a single text
// input is a screen you have to dismiss.

import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, roles, spacing, textStyles } from '@/theme';

interface TemplateEditHeaderProps {
  name: string;
  onChangeName: (next: string) => void;
  /** Writes the draft through to the store. Fires on blur and on submit. */
  onCommitName: () => void;
  daysPerWeek: number;
  difficulty: string;
  sessionCount: number;
}

export function TemplateEditHeader({
  name,
  onChangeName,
  onCommitName,
  daysPerWeek,
  difficulty,
  sessionCount,
}: TemplateEditHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.customBadge}>
        <Text style={styles.customBadgeText}>Custom</Text>
      </View>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={onChangeName}
        onBlur={onCommitName}
        onSubmitEditing={onCommitName}
        returnKeyType="done"
        placeholder="Template name"
        placeholderTextColor={colors.text.muted}
      />
      <View style={styles.templateMeta}>
        <MetaChip label={`${daysPerWeek} days/week`} />
        <MetaChip label={difficulty} />
        <MetaChip label={`${sessionCount} sessions`} />
      </View>
    </View>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing[6],
  },
  customBadge: {
    alignSelf: 'flex-start',
    backgroundColor: roles.accentSubtle,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[2],
  },
  customBadgeText: {
    ...textStyles.caption,
    color: roles.accentText,
    fontWeight: '700',
  },
  nameInput: {
    ...textStyles.h1,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  templateMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaChip: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  metaChipText: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
});
