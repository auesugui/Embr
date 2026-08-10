// =============================================================================
// IronQuest Quest Board (Home Tab)
// =============================================================================

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TemplateCard } from '@/components/workout/TemplateCard';
import { CURRENT_TOWER_FLOOR, GAMIFICATION_ENABLED } from '@/config';
import { WORKOUT_TEMPLATES } from '@/data';
import { countClaimedInLast7Days } from '@/lib/history-stats';
import {
  selectTotalFP,
  usePRStore,
  usePlayerStore,
  useTemplateStore,
  useWorkoutHistoryStore,
} from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

export default function QuestBoardScreen() {
  const totalFP = usePlayerStore(selectTotalFP);
  const streak = usePlayerStore((state) => state.streak.current);
  const totalWorkouts = usePlayerStore((state) => state.totalWorkouts);
  const personalTemplates = useTemplateStore((state) => state.templates);
  const createBlankTemplate = useTemplateStore((state) => state.createBlankTemplate);

  // Quick Stats — real store data, not hardcoded literals.
  const workoutsThisWeek = useWorkoutHistoryStore((s) => countClaimedInLast7Days(s.logs));
  const prCount = usePRStore((state) => state.totalPRCount);

  const handleTemplatePress = (templateId: string) => {
    router.push(`/workout/template/${templateId}`);
  };

  // Straight into the editor — the point of this button is that building a
  // workout from scratch doesn't route through somebody else's template.
  const handleNewWorkout = () => {
    haptics.tap();
    router.push(`/workout/template-edit/${createBlankTemplate()}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* FP Counter — game layer */}
      {GAMIFICATION_ENABLED && (
        <View style={styles.fpCard}>
          <Text style={styles.fpLabel}>Total FP</Text>
          <Text style={styles.fpValue}>{totalFP.toLocaleString()}</Text>
        </View>
      )}

      {/* Streak — tracker feature, shown in both builds */}
      <View style={styles.streakCard}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Workouts" value={totalWorkouts.toString()} />
          <StatCard label="This Week" value={workoutsThisWeek.toString()} />
          <StatCard label="PRs" value={prCount.toString()} />
          {GAMIFICATION_ENABLED && (
            <StatCard label="Tower Floor" value={CURRENT_TOWER_FLOOR.toString()} />
          )}
        </View>
      </View>

      {/* Build from scratch. Sits above History so the two "start something"
          actions aren't separated by the read-only one. */}
      <View style={styles.section}>
        <Pressable
          style={styles.newWorkoutButton}
          onPress={handleNewWorkout}
          accessibilityRole="button"
          accessibilityLabel="Create a new custom workout"
        >
          <Text style={styles.newWorkoutText}>+ New Workout</Text>
        </Pressable>
      </View>

      {/* Workout History — reachable from the Quest Board (issue #18). */}
      <View style={styles.section}>
        <Pressable style={styles.historyButton} onPress={() => router.push('/(tabs)/history')}>
          <Text style={styles.historyButtonText}>Workout History</Text>
          <Text style={styles.historyChevron}>›</Text>
        </Pressable>
      </View>

      {/* Templates Section */}
      {personalTemplates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Custom Templates</Text>
          <Text style={styles.sectionSubtitle}>
            Your personal copies. Tap to view, edit, or start a session.
          </Text>

          {personalTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPress={() => handleTemplatePress(template.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Templates</Text>
        <Text style={styles.sectionSubtitle}>
          {GAMIFICATION_ENABLED
            ? "Choose a program that fits your schedule. Each shows the FP distribution you'll earn."
            : 'Choose a program that fits your schedule. Each shows the muscle groups it targets.'}
        </Text>

        {WORKOUT_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onPress={() => handleTemplatePress(template.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  fpCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  fpLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  fpValue: {
    ...textStyles.numberLarge,
    color: colors.reward.fp,
  },
  streakCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakValue: {
    ...textStyles.number,
    color: colors.text.primary,
  },
  streakLabel: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  sectionSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing[4],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: spacing[3],
    // 47% basis forces 2-per-row wrap; flexGrow fills the leftover gap so the
    // right edge aligns exactly with the full-width cards above/below.
    // (Previously `width: '47%'` left an ~8px shortfall on the right.)
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 0,
    alignItems: 'center',
  },
  statValue: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  newWorkoutButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    padding: spacing[4],
    alignItems: 'center',
  },
  newWorkoutText: {
    ...textStyles.button,
    color: colors.background.primary,
    fontWeight: '700',
  },
  historyButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyButtonText: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  historyChevron: {
    ...textStyles.h3,
    color: colors.text.muted,
  },
});
