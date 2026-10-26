// =============================================================================
// Embr Home Tab
// =============================================================================
// Finch register (ADR-0013): this is an *arrival* screen, not a working screen.
// It gets breathing room, the display face, and the one emotional beat the
// tracker has — the streak. Density belongs on session/history, not here.

import { Pencil, Plus, Trash } from '@/components/icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RevealRow } from '@/components/celebration';
import { WeeklyHero } from '@/components/goal';
import { PressableScale, type SwipeAction, SwipeActions } from '@/components/ui';
import { TemplateCard } from '@/components/workout/TemplateCard';
import { WORKOUT_TEMPLATES } from '@/data';
import { useLocalDay } from '@/hooks';
import { countClaimedThisWeek } from '@/lib/history-stats';
import { weekProgress } from '@/lib/weekly-goal';
import { weeklyGoalLine } from '@/lib/weekly-goal-copy';
import { ownWorkoutRoute } from '@/lib/workout-routes';
import {
  usePRStore,
  usePlayerStore,
  useSettingsStore,
  useTemplateStore,
  useWorkoutHistoryStore,
} from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';
import { showAlert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';

export default function HomeScreen() {
  const totalWorkouts = usePlayerStore((state) => state.totalWorkouts);
  const personalTemplates = useTemplateStore((state) => state.templates);
  const createBlankTemplate = useTemplateStore((state) => state.createBlankTemplate);

  // The hero's week, derived from history the way the daily streak is — a
  // workout typed in for a past week repairs the run without a replay.
  //
  // `today` is the clock, not a decoration: this tab is where a suspended PWA
  // resumes, so without it the week would still be yesterday's after midnight.
  const today = useLocalDay();
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const weeklyGoals = useSettingsStore((s) => s.weeklyGoals);
  const progress = useMemo(
    () => weekProgress(logs, weeklyGoals, today),
    [logs, weeklyGoals, today]
  );

  // Quick Stats — real store data, not hardcoded literals. Same calendar week
  // as the hero, so the same clock.
  const workoutsThisWeek = useMemo(() => countClaimedThisWeek(logs, today), [logs, today]);
  const prCount = usePRStore((state) => state.totalPRCount);

  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const hasOwnWorkouts = personalTemplates.length > 0;

  const handleTemplatePress = (templateId: string) => {
    router.push(`/workout/template/${templateId}`);
  };

  /**
   * Tapping one of YOUR workouts starts it.
   *
   * The built-in templates below still open their detail page, because there
   * you're deciding whether to adopt someone else's program. A workout you
   * built is one you've already decided about — the only thing left to do with
   * it is train, and routing that through a read-only description page was
   * three taps to a thing you do every day.
   *
   * A multi-day program is the exception: which day to run is a real choice, so
   * it still stops at the day picker.
   */
  const handleOwnWorkoutPress = (templateId: string, dayCount: number) => {
    haptics.tap();
    router.push(ownWorkoutRoute(templateId, dayCount) as Parameters<typeof router.push>[0]);
  };

  // Deleting a personal copy is irreversible and there is no undo anywhere in
  // the app, so the swipe reveals the action and the dialog commits it. A
  // one-gesture delete of a program you spent ten minutes building is not a
  // convenience.
  const handleDeleteWorkout = (templateId: string, name: string) => {
    showAlert({
      title: 'Delete this workout?',
      message: `"${name}" will be removed from your workouts. Logged sessions stay in your history.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            deleteTemplate(templateId);
          },
        },
      ],
    });
  };

  // Editing is the other thing you do to a workout you already built: add a
  // movement, change a rep target. No confirmation — it's a screen, not a
  // commitment, and everything on it is itself undoable.
  const handleEditWorkout = (templateId: string) => {
    router.push(`/workout/template-edit/${templateId}`);
  };

  /**
   * A direction each: drag left to delete, right to edit.
   *
   * Delete is on the trailing side because that is where every list on the
   * platform puts its destructive action — swiping a row left expecting Delete
   * is muscle memory people arrive with, and an earlier pass had it inverted.
   * Edit takes the leading side, so neither can be hit while reaching for the
   * other.
   */
  const editAction = (template: { id: string; name: string }): SwipeAction => ({
    key: 'edit',
    icon: Pencil,
    label: 'Edit',
    accessibilityLabel: `Edit ${template.name}`,
    onPress: () => handleEditWorkout(template.id),
  });

  const deleteAction = (template: { id: string; name: string }): SwipeAction => ({
    key: 'delete',
    icon: Trash,
    label: 'Delete',
    accessibilityLabel: `Delete ${template.name}`,
    onPress: () => handleDeleteWorkout(template.id, template.name),
    tone: 'danger',
  });

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
        <WeeklyHero progress={progress} line={weeklyGoalLine(progress)} />
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

      {/* YOUR workouts, before anything that makes a new one.
          The screen used to lead with New Workout, which put an authoring
          action where the returning user's eye lands. Reading top-to-bottom it
          promised "start training" and delivered an empty template editor, and
          the workouts you'd already built sat below a wall of someone else's
          programs. Once you own workouts, they ARE the home screen; building
          another is the rarer thing and sits after them. With none yet, there's
          nothing to lead with and the build button is the primary CTA again
          (see below). */}
      {hasOwnWorkouts && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Workouts</Text>
          {/* Deliberately says neither "left" nor "right".
              "Swipe left" is genuinely ambiguous: it reads as the finger's
              direction to some people and as the side the button lands on to
              others, and those are opposite readings of the same sentence.
              Naming one meant the copy contradicted the gesture for anyone
              holding the other. The buttons carry their own words, so the
              mapping is taught on the first reveal by the thing that does it —
              which no hint can do better. */}
          <Text style={styles.sectionSubtitle}>Tap to start. Swipe a card to edit or delete.</Text>

          {personalTemplates.map((template, i) => (
            <RevealRow key={template.id} index={Math.min(i, 5)}>
              <SwipeActions
                leadingActions={[editAction(template)]}
                trailingActions={[deleteAction(template)]}
              >
                {({ blocked }) => (
                  <TemplateCard
                    flush
                    template={template}
                    onPress={() => {
                      // A swipe ends in a pointer-up the card would otherwise
                      // read as a tap, which would start the workout you were
                      // trying to delete.
                      if (blocked()) return;
                      handleOwnWorkoutPress(template.id, template.days.length);
                    }}
                  />
                )}
              </SwipeActions>
            </RevealRow>
          ))}
        </View>
      )}

      {/* Build from scratch. Primary when you own nothing (it's the only way
          forward); a quieter secondary once you do, so it stops competing with
          the workouts above it. Same action either way — only the weight
          changes, because what changes is how likely you are to want it. */}
      <RevealRow index={2} style={styles.section}>
        <PressableScale
          style={hasOwnWorkouts ? styles.secondaryButton : styles.primaryButton}
          onPress={handleNewWorkout}
          accessibilityRole="button"
          accessibilityLabel="Build a new custom workout"
        >
          <Plus
            size={18}
            color={hasOwnWorkouts ? roles.accentText : roles.onAccent}
            strokeWidth={2.5}
          />
          <Text style={hasOwnWorkouts ? styles.secondaryButtonText : styles.primaryButtonText}>
            {hasOwnWorkouts ? 'Build another workout' : 'New Workout'}
          </Text>
        </PressableScale>
      </RevealRow>

      {/* Workout History used to sit here (issue #18). It is the top row of the
          Progress tab now (issue #77): Home is the screen you arrive at and
          start from, and looking backwards has its own place. */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {hasOwnWorkouts ? 'Browse Programs' : 'Workout Templates'}
        </Text>
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
  // Same shape, no fill. An outline reads as "available" rather than "do this
  // next", which is exactly the demotion this button needs once the workouts
  // above it are the point of the screen.
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: roles.accentText,
  },
  primaryButtonText: {
    ...textStyles.button,
    color: roles.onAccent,
    fontWeight: '700',
  },
});
