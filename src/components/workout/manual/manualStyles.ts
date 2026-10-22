// =============================================================================
// Manual workout styles — the add-workout screen and its cards
// =============================================================================

import { StyleSheet } from 'react-native';

import { radius, roles, spacing, textStyles } from '@/theme';

export const manualStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  dateField: {
    flex: 2,
    minWidth: 0,
  },
  durationField: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    marginBottom: spacing[1],
  },
  input: {
    ...textStyles.body,
    minWidth: 0,
    color: roles.textPrimary,
    backgroundColor: roles.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  nameInput: {
    ...textStyles.body,
    flex: 1,
    minWidth: 0,
    color: roles.textPrimary,
    fontWeight: '600',
    paddingVertical: spacing[1],
  },
  suggestions: {
    borderTopWidth: 1,
    borderTopColor: roles.border,
    marginBottom: spacing[2],
  },
  suggestion: {
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: roles.border,
  },
  suggestionName: {
    ...textStyles.body,
    color: roles.textPrimary,
  },
  suggestionMeta: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  distanceRow: {
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  fieldGrow: {
    flex: 1,
    minWidth: 0,
  },
  unitToggle: {
    flexDirection: 'row',
    height: 40,
    padding: 2,
    backgroundColor: roles.surfaceSunken,
    borderRadius: radius.md,
  },
  unitOption: {
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
  },
  unitOptionSelected: {
    backgroundColor: roles.surfaceRaised,
  },
  unitText: {
    ...textStyles.label,
    color: roles.textMuted,
  },
  unitTextSelected: {
    color: roles.textPrimary,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  setHeaderText: {
    ...textStyles.caption,
    color: roles.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setColumn: {
    flex: 1,
    minWidth: 0,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  setNumber: {
    width: 24,
    flexShrink: 0,
    ...textStyles.caption,
    color: roles.textMuted,
    textAlign: 'center',
  },
  setInput: {
    ...textStyles.body,
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    color: roles.textPrimary,
    backgroundColor: roles.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontVariant: ['tabular-nums'],
  },
  times: {
    width: 12,
    flexShrink: 0,
    ...textStyles.body,
    color: roles.textMuted,
    textAlign: 'center',
  },
  timesSpacer: {
    width: 12,
  },
  removeSlot: {
    width: 24,
    alignItems: 'center',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
  },
  addSetText: {
    ...textStyles.label,
    color: roles.accentText,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: roles.borderStrong,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  addButtonText: {
    ...textStyles.button,
    color: roles.accentText,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: roles.border,
    backgroundColor: roles.surface,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  error: {
    ...textStyles.bodySmall,
    color: roles.error,
    marginBottom: spacing[2],
  },
  saveButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  saveButtonText: {
    ...textStyles.button,
    color: roles.onAccent,
  },
});
