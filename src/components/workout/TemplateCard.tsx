import { PressableScale } from '@/components/ui';
import type { WorkoutTemplateDefinition } from '@/data';
import { estimateTemplateMinutes } from '@/lib/duration';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';
import { StyleSheet, Text, View } from 'react-native';

interface TemplateCardProps {
  template: WorkoutTemplateDefinition;
  onPress: () => void;
}

export function TemplateCard({ template, onPress }: TemplateCardProps) {
  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <PressableScale style={styles.card} activeScale={0.985} onPress={handlePress}>
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
          {/* Difficulty used to be a filled pill colored from the RPG stat
              palette — green for intermediate, red for advanced. Three
              decorative colors on a tracker card, none of them meaningful.
              It's a label; it reads as one now. */}
          <Text style={styles.difficultyText}>{template.difficulty.toUpperCase()}</Text>
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
            <Text style={styles.statValue}>{estimateTemplateMinutes(template)} min</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{template.days.length}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    // On the old dark palette, a raised card separated itself from the
    // background for free. On warm off-white it doesn't — white on #FBF9F7 is
    // nearly invisible — so raised surfaces carry an explicit hairline now.
    borderWidth: 1,
    borderColor: roles.border,
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
    color: roles.textPrimary,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    flexShrink: 1,
  },
  customBadge: {
    // Was tinted with colors.types.flux — the pet *element* color, neon purple.
    backgroundColor: roles.accentSubtle,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  customBadgeText: {
    ...textStyles.caption,
    color: roles.accentText,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  difficultyText: {
    ...textStyles.captionSmall,
    color: roles.textMuted,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  description: {
    ...textStyles.bodySmall,
    color: roles.textSecondary,
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
    color: roles.textMuted,
  },
  statValue: {
    ...textStyles.numberSmall,
    color: roles.textPrimary,
    fontWeight: '600',
  },
  radarContainer: {
    marginLeft: spacing[3],
    marginRight: -spacing[2],
    overflow: 'visible',
  },
});
