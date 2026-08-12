// =============================================================================
// Embr Home Tab
// =============================================================================
// Finch register (ADR-0013): this is an *arrival* screen, not a working screen.
// It gets breathing room, the display face, and the one emotional beat the
// tracker has — the streak. Density belongs on session/history, not here.

import { router } from 'expo-router';
import { ChevronRight, Flame, Plus } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CountUpText, RevealRow } from '@/components/celebration';
import { PressableScale } from '@/components/ui';
import { TemplateCard } from '@/components/workout/TemplateCard';
import { WORKOUT_TEMPLATES } from '@/data';
import { countClaimedInLast7Days } from '@/lib/history-stats';
import { usePRStore, usePlayerStore, useTemplateStore, useWorkoutHistoryStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

export default function HomeScreen() {
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
      {/* Hero zone. Tracker feature, shown in both builds.
          RESERVED (ADR-0013): if the care-companion ever gets built, it lives
          here — that's why this card is tall and centered rather than a compact
          stat row. Don't fill the space with layout. */}
      <RevealRow index={0} style={styles.hero}>
        <View style={styles.heroMark}>
          <Flame size={28} color={streak > 0 ? roles.accent : roles.textMuted} strokeWidth={1.75} />
        </View>
        <CountUpText value={streak} style={styles.heroValue} />
        <Text style={styles.heroLabel}>day streak</Text>
        <Text style={styles.heroCaption}>
          {streak > 0 ? 'Keep it going.' : 'Log a workout to start one.'}
        </Text>
      </RevealRow>

      {/* Quick Stats — one card, divided. Three separate cards read as three
          unrelated things; the numbers belong to the same story. */}
      <RevealRow index={1} style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <StatCell label="Workouts" value={totalWorkouts.toString()} />
          <View style={styles.statDivider} />
          <StatCell label="This Week" value={workoutsThisWeek.toString()} />
          <View style={styles.statDivider} />
          <StatCell label="PRs" value={prCount.toString()} />
        </View>
      </RevealRow>

      {/* Build from scratch. Sits above History so the two "start something"
          actions aren't separated by the read-only one. */}
      <RevealRow index={2} style={styles.section}>
        <PressableScale
          style={styles.primaryButton}
          onPress={handleNewWorkout}
          accessibilityRole="button"
          accessibilityLabel="Create a new custom workout"
        >
          <Plus size={18} color={roles.onAccent} strokeWidth={2.5} />
          <Text style={styles.primaryButtonText}>New Workout</Text>
        </PressableScale>
      </RevealRow>

      {/* Workout History — reachable from home (issue #18). */}
      <RevealRow index={3} style={styles.section}>
        <PressableScale
          style={styles.rowButton}
          activeScale={0.985}
          onPress={() => router.push('/(tabs)/history')}
        >
          <Text style={styles.rowButtonText}>Workout History</Text>
          <ChevronRight size={20} color={roles.textMuted} />
        </PressableScale>
      </RevealRow>

      {/* Templates Section */}
      {personalTemplates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Custom Templates</Text>
          <Text style={styles.sectionSubtitle}>
            Your personal copies. Tap to view, edit, or start a session.
          </Text>

          {personalTemplates.map((template, i) => (
            <RevealRow key={template.id} index={Math.min(i, 5)}>
              <TemplateCard template={template} onPress={() => handleTemplatePress(template.id)} />
            </RevealRow>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Templates</Text>
        <Text style={styles.sectionSubtitle}>
          Choose a program that fits your schedule. Each shows the muscle groups it targets.
        </Text>

        {WORKOUT_TEMPLATES.map((template, i) => (
          <RevealRow key={template.id} index={Math.min(i, 5)}>
            <TemplateCard template={template} onPress={() => handleTemplatePress(template.id)} />
          </RevealRow>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },

  // --- Hero -----------------------------------------------------------------
  hero: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: roles.border,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  heroMark: {
    marginBottom: spacing[2],
  },
  heroValue: {
    ...textStyles.hero,
    color: roles.textPrimary,
    fontSize: 56,
    lineHeight: 62,
  },
  heroLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.3,
  },
  heroCaption: {
    ...textStyles.displaySmall,
    color: roles.textMuted,
    fontSize: 16,
    marginTop: spacing[3],
  },

  // --- Sections -------------------------------------------------------------
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: roles.textPrimary,
    marginBottom: spacing[1],
  },
  sectionSubtitle: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    marginBottom: spacing[4],
  },

  // --- Quick stats ----------------------------------------------------------
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingVertical: spacing[4],
    marginTop: spacing[2],
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: roles.border,
    marginVertical: spacing[1],
  },
  statValue: {
    ...textStyles.number,
    color: roles.textPrimary,
  },
  statLabel: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[1],
  },

  // --- Actions --------------------------------------------------------------
  primaryButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...textStyles.button,
    color: roles.onAccent,
    fontWeight: '700',
  },
  rowButton: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowButtonText: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
  },
});
