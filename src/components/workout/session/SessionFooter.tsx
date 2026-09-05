// =============================================================================
// SessionFooter — what to do next, and where else you could be
// =============================================================================
// One tab per BLOCK, not per exercise: a three-movement circuit is one
// destination, and three tabs that all show the same rounds is three ways to
// land on the same screen.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, roles, spacing, textStyles } from '@/theme';

export interface FooterTab {
  key: string;
  label: string;
  /** Every member of the block is done. */
  completed: boolean;
  /** Exercise index to jump to. */
  targetIndex: number;
}

interface SessionFooterProps {
  paddingBottom: number;
  tabs: FooterTab[];
  activeIndex: number;
  /** Last block in the workout — the next action is Finish, not Next. */
  isLastGroup: boolean;
  /** Label for the forward action when there is a next block. */
  nextLabel: string;
  /**
   * Whether this session has anything worth writing to history. False hides
   * Finish entirely: there is nothing to finish, and the way out is the back
   * arrow or End.
   */
  canFinish: boolean;
  /** Shown in place of Finish when there is nothing recorded yet. */
  emptyHint: string;
  onPrimary: () => void;
  onSelectTab: (targetIndex: number) => void;
}

export function SessionFooter({
  paddingBottom,
  tabs,
  activeIndex,
  isLastGroup,
  nextLabel,
  canFinish,
  emptyHint,
  onPrimary,
  onSelectTab,
}: SessionFooterProps) {
  return (
    <View style={[styles.navigation, { paddingBottom }]}>
      {/* Finish only exists once the workout does. On an untouched timed block
          there is nothing to write to history, so the way out is the back arrow
          or End — not a Finish that banks an empty session. */}
      {isLastGroup && !canFinish ? (
        <Text style={styles.navHint}>{emptyHint}</Text>
      ) : (
        <Pressable
          style={[styles.navButton, isLastGroup && styles.finishButton]}
          onPress={onPrimary}
        >
          <Text style={[styles.navButtonText, isLastGroup && styles.navButtonTextFinish]}>
            {isLastGroup ? 'Finish Workout' : `Next: ${nextLabel}`}
          </Text>
        </Pressable>
      )}

      <ScrollView style={styles.exerciseList} horizontal showsHorizontalScrollIndicator={false}>
        {tabs.map((tab, index) => (
          <Pressable
            key={tab.key}
            style={[
              styles.exerciseTab,
              index === activeIndex && styles.exerciseTabActive,
              tab.completed && styles.exerciseTabCompleted,
            ]}
            onPress={() => onSelectTab(tab.targetIndex)}
          >
            <Text
              style={[
                styles.exerciseTabText,
                index === activeIndex && styles.exerciseTabTextActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    backgroundColor: colors.background.primary,
  },
  navHint: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    textAlign: 'center',
    paddingVertical: spacing[4],
    marginBottom: spacing[3],
  },
  navButton: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  finishButton: {
    backgroundColor: colors.reward.fp,
  },
  navButtonText: {
    ...textStyles.buttonLarge,
    color: colors.text.primary,
  },
  navButtonTextFinish: {
    color: colors.background.primary,
  },
  exerciseList: {
    maxHeight: 50,
  },
  exerciseTab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginRight: spacing[2],
  },
  exerciseTabActive: {
    backgroundColor: colors.reward.fp,
  },
  exerciseTabCompleted: {
    opacity: 0.6,
  },
  exerciseTabText: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
  exerciseTabTextActive: {
    color: colors.background.primary,
    fontWeight: '600',
  },
});
