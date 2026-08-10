import { RadarChart } from '@/components/progress/RadarChart';
import { GAMIFICATION_ENABLED } from '@/config';
import type { WorkoutTemplateDefinition } from '@/data';
import { colors, radius, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TemplateCardProps {
  template: WorkoutTemplateDefinition;
  onPress: () => void;
}

const DIFFICULTY_COLORS = {
  beginner: colors.stats.vigor,
  intermediate: colors.stats.speed,
  advanced: colors.stats.power,
};

export function TemplateCard({ template, onPress }: TemplateCardProps) {
  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.nameWrap}>
            <Text style={styles.name}>{template.name}</Text>
            {template.isCustom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Custom</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.difficultyBadge,
              { backgroundColor: DIFFICULTY_COLORS[template.difficulty] + '20' },
            ]}
          >
            <Text
              style={[styles.difficultyText, { color: DIFFICULTY_COLORS[template.difficulty] }]}
            >
              {template.difficulty.charAt(0).toUpperCase() + template.difficulty.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {template.description}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.stats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Days/Week</Text>
            <Text style={styles.statValue}>{template.daysPerWeek}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Est. Duration</Text>
            <Text style={styles.statValue}>{template.estimatedDuration} min</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{template.days.length}</Text>
          </View>
        </View>

        {/* The radar is plotted on the six pet stats (Power/Guard/Speed/Vigor/
            Focus/Spirit). Those axis names are game vocabulary, and Spirit is
            always 0 outside the streak system — so the tracker build drops it
            rather than showing a chart labelled in jargon it no longer uses. */}
        {GAMIFICATION_ENABLED && (
          <View style={styles.radarContainer}>
            <RadarChart values={template.totalFpDistribution} size={140} showLabels={true} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.tapHint}>Tap to view sessions</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  header: {
    marginBottom: spacing[3],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  name: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    flexShrink: 1,
  },
  customBadge: {
    backgroundColor: colors.types.flux + '24',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  customBadgeText: {
    ...textStyles.caption,
    color: colors.types.flux,
    fontWeight: '700',
    fontSize: 10,
  },
  difficultyBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  difficultyText: {
    ...textStyles.caption,
    fontWeight: '600',
  },
  description: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'visible',
  },
  stats: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  statLabel: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  statValue: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  radarContainer: {
    marginLeft: spacing[3],
    marginRight: -spacing[2],
    overflow: 'visible',
  },
  footer: {
    marginTop: spacing[3],
    alignItems: 'center',
  },
  tapHint: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
});
