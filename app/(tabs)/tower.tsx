// =============================================================================
// IronQuest Battle Tower Tab
// =============================================================================

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAMIFICATION_ENABLED } from '@/config';
import { colors, spacing, textStyles } from '@/theme';
import { Redirect } from 'expo-router';

export default function TowerScreen() {
  // Game-layer route: unreachable from the tab bar in the tracker build, but a
  // deep link or a restored URL could still land here. Bounce to the tracker.
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tower Visualization */}
      <View style={styles.towerCard}>
        <Text style={styles.towerTitle}>Battle Tower</Text>
        <View style={styles.towerVisual}>
          <View style={styles.floorBlock}>
            <Text style={styles.floorText}>Floor 1</Text>
          </View>
        </View>
        <Text style={styles.currentFloor}>Current Floor: 1</Text>
        <Text style={styles.bestFloor}>Best: 1</Text>
      </View>

      {/* Attempts */}
      <View style={styles.attemptsCard}>
        <Text style={styles.cardTitle}>Tower Attempts</Text>
        <View style={styles.attemptsRow}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={[styles.attemptOrb, i <= 7 && styles.attemptAvailable]} />
          ))}
        </View>
        <Text style={styles.attemptsText}>7/7 attempts remaining</Text>
        <Text style={styles.attemptsHint}>Earn 1 attempt per completed workout</Text>
      </View>

      {/* Battle Button */}
      <Pressable style={styles.battleButton}>
        <Text style={styles.battleButtonText}>Start Battle</Text>
      </Pressable>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>How It Works</Text>
        <Text style={styles.infoText}>
          • Auto-battle based on your pet's stats{'\n'}• Type advantages: Ferro → Flux → Terra →
          Ferro{'\n'}• Boss every 10 floors{'\n'}• Earn FP and cosmetics for victories
        </Text>
      </View>
    </ScrollView>
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
  towerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  towerTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  towerVisual: {
    width: 120,
    height: 200,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  floorBlock: {
    backgroundColor: colors.reward.fp,
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  floorText: {
    ...textStyles.label,
    color: colors.background.primary,
  },
  currentFloor: {
    ...textStyles.bodyLarge,
    color: colors.text.primary,
  },
  bestFloor: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  attemptsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  attemptsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  attemptOrb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
  },
  attemptAvailable: {
    backgroundColor: colors.reward.fp,
  },
  attemptsText: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  attemptsHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  battleButton: {
    backgroundColor: colors.danger.DEFAULT,
    borderRadius: 12,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  battleButtonText: {
    ...textStyles.buttonLarge,
    color: colors.text.primary,
  },
  infoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing[4],
  },
  infoText: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
});
