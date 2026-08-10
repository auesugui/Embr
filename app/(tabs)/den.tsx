// =============================================================================
// IronQuest The Den Tab - Pet Care & Stat Upgrades
// =============================================================================

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CELEBRATION } from '@/components/celebration';
import { PetAvatar } from '@/components/pet';
import { ShareCardModal } from '@/components/share';
import { GAMIFICATION_ENABLED } from '@/config';
import { selectTotalFP, usePetStore, usePlayerStore, useSettingsStore } from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { StatType } from '@/types';
import { haptics } from '@/utils/haptics';
import { Redirect } from 'expo-router';

// Scaling stat costs:
// - Physical stats: 5 FP (1-10), 8 FP (11-25), 12 FP (26-50)
// - Spirit: 10 FP flat (can only be upgraded with Spirit FP)
const getStatCost = (stat: StatType, currentValue: number): number => {
  if (stat === 'spirit') return 10; // Spirit always costs 10 Spirit FP

  if (currentValue < 10) return 5;
  if (currentValue < 25) return 8;
  return 12;
};

const FEED_COST = 20; // FP to feed pet (fully restores hunger)

export default function DenScreen() {
  // Game-layer route: unreachable from the tab bar in the tracker build, but a
  // deep link or a restored URL could still land here. Bounce to the tracker.
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  // Pet state
  const stats = usePetStore((state) => state.stats);
  const evolutionStage = usePetStore((state) => state.evolutionStage);
  const totalFPEarned = usePetStore((state) => state.totalFPEarned);
  const hunger = usePetStore((state) => state.hunger);
  const petType = usePetStore((state) => state.type);
  const petName = usePetStore((state) => state.name);

  // Share card (Phase 2 — promoted from Phase 3)
  const [shareVisible, setShareVisible] = useState(false);
  const streakDays = usePlayerStore((state) => state.streak.current);
  const totalWorkouts = usePlayerStore((state) => state.totalWorkouts);

  // Tap reaction: quick squash-and-settle spring. Reduced motion keeps the
  // haptic acknowledgment but skips the movement.
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const tapBounce = useSharedValue(1);
  const tapBounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tapBounce.value }],
  }));
  const handlePetTap = () => {
    haptics.tap();
    if (reducedMotion) return;
    tapBounce.value = withSequence(
      withTiming(0.92, { duration: 90 }),
      withSpring(1, CELEBRATION.settle)
    );
  };

  // Pet actions
  const upgradeStat = usePetStore((state) => state.upgradeStat);
  const feedPet = usePetStore((state) => state.feedPet);

  // Player FP - subscribe to individual values for better reactivity
  const genericFP = usePlayerStore((state) => state.fp.generic);
  const powerFP = usePlayerStore((state) => state.fp.power);
  const guardFP = usePlayerStore((state) => state.fp.guard);
  const speedFP = usePlayerStore((state) => state.fp.speed);
  const vigorFP = usePlayerStore((state) => state.fp.vigor);
  const focusFP = usePlayerStore((state) => state.fp.focus);
  const spiritFP = usePlayerStore((state) => state.fp.spirit);

  // Computed FP object for convenience
  const fp = {
    generic: genericFP,
    power: powerFP,
    guard: guardFP,
    speed: speedFP,
    vigor: vigorFP,
    focus: focusFP,
    spirit: spiritFP,
  };

  const totalFP = usePlayerStore(selectTotalFP);
  const spendFP = usePlayerStore((state) => state.spendFP);

  const handleUpgradeStat = (stat: StatType) => {
    const currentStatValue = stats[stat];
    const cost = getStatCost(stat, currentStatValue);

    // Check if stat is maxed
    if (currentStatValue >= 50) {
      haptics.error();
      return;
    }

    // Spirit stat: can ONLY use Spirit FP
    if (stat === 'spirit') {
      if (fp.spirit >= cost) {
        if (spendFP('spirit', cost)) {
          upgradeStat(stat, 1);
          haptics.success();
        }
      } else {
        haptics.error();
      }
      return;
    }

    // Physical stats: prefer specific type FP, fall back to generic
    if (fp[stat] >= cost) {
      if (spendFP(stat, cost)) {
        upgradeStat(stat, 1);
        haptics.success();
      }
    } else if (fp.generic >= cost) {
      if (spendFP('generic', cost)) {
        upgradeStat(stat, 1);
        haptics.success();
      }
    } else {
      haptics.error();
    }
  };

  const handleFeed = () => {
    if (fp.generic >= FEED_COST) {
      if (spendFP('generic', FEED_COST)) {
        feedPet();
        haptics.success();
      }
    } else {
      haptics.error();
    }
  };

  const canAffordStat = (stat: StatType) => {
    const cost = getStatCost(stat, stats[stat]);

    if (stats[stat] >= 50) return false;

    // Spirit stat: only Spirit FP can be used
    if (stat === 'spirit') {
      return fp.spirit >= cost;
    }

    // Physical stats: specific type OR generic
    return fp[stat] >= cost || fp.generic >= cost;
  };

  const canAffordFeed = fp.generic >= FEED_COST && hunger < 100;

  // Get the actual spendable FP for a stat (max of specific or generic, not sum)
  const getSpendableFP = (stat: StatType): number => {
    if (stat === 'spirit') return fp.spirit;
    return Math.max(fp[stat], fp.generic);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* FP Balance */}
      <View style={styles.fpCard}>
        <Text style={styles.fpLabel}>Available FP</Text>
        <Text style={styles.fpValue}>{totalFP.toLocaleString()}</Text>
      </View>

      {/* Pet Display — tap for an acknowledgment bounce (issue #40, folded
          from #41). Pure celebration vocabulary: no mood system behind it. */}
      <View style={styles.petContainer}>
        <Pressable
          onPress={handlePetTap}
          accessibilityRole="button"
          accessibilityLabel={`${petName || 'Your pet'} — tap to interact`}
        >
          <Animated.View style={tapBounceStyle}>
            <PetAvatar
              petType={petType}
              stats={stats}
              evolutionStage={evolutionStage}
              size={180}
              animated={true}
            />
          </Animated.View>
        </Pressable>
        <Text style={styles.petName}>{petName || 'Your Pet'}</Text>
        <Text style={styles.petType}>{petType} Type</Text>
        <Pressable
          style={styles.shareButton}
          onPress={() => setShareVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Share your pet card"
        >
          <Text style={styles.shareButtonText}>Share Card</Text>
        </Pressable>
      </View>

      {/* Evolution Progress */}
      <View style={styles.evolutionCard}>
        <Text style={styles.cardTitle}>Evolution</Text>
        <Text style={styles.evolutionStage}>
          Stage {evolutionStage}: {['Shard', 'Form', 'Prime', 'Apex'][evolutionStage - 1]}
        </Text>
        <Text style={styles.evoXP}>Total FP Earned: {totalFPEarned}</Text>
      </View>

      {/* Care Status */}
      <View style={styles.careCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Care</Text>
          <Pressable
            style={[styles.feedButton, !canAffordFeed && styles.buttonDisabled]}
            onPress={handleFeed}
            disabled={!canAffordFeed}
            accessibilityRole="button"
            accessibilityLabel={`Feed pet for ${FEED_COST} FP`}
          >
            <Text style={styles.feedButtonText}>
              Feed {hunger < 100 ? `(${FEED_COST} FP)` : '(Full)'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.careRow}>
          <Text style={styles.careLabel}>Hunger</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${hunger}%` }]} />
          </View>
          <Text style={styles.careValue}>{Math.round(hunger)}%</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>Stats</Text>
        <View style={styles.statsList}>
          <StatRow
            label="Power"
            stat="power"
            value={stats.power}
            color={colors.stats.power}
            cost={getStatCost('power', stats.power)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('power')}
            fpBalance={getSpendableFP('power')}
          />
          <StatRow
            label="Guard"
            stat="guard"
            value={stats.guard}
            color={colors.stats.guard}
            cost={getStatCost('guard', stats.guard)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('guard')}
            fpBalance={getSpendableFP('guard')}
          />
          <StatRow
            label="Speed"
            stat="speed"
            value={stats.speed}
            color={colors.stats.speed}
            cost={getStatCost('speed', stats.speed)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('speed')}
            fpBalance={getSpendableFP('speed')}
          />
          <StatRow
            label="Vigor"
            stat="vigor"
            value={stats.vigor}
            color={colors.stats.vigor}
            cost={getStatCost('vigor', stats.vigor)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('vigor')}
            fpBalance={getSpendableFP('vigor')}
          />
          <StatRow
            label="Focus"
            stat="focus"
            value={stats.focus}
            color={colors.stats.focus}
            cost={getStatCost('focus', stats.focus)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('focus')}
            fpBalance={getSpendableFP('focus')}
          />
          <StatRow
            label="Spirit"
            stat="spirit"
            value={stats.spirit}
            color={colors.stats.spirit}
            cost={getStatCost('spirit', stats.spirit)}
            onUpgrade={handleUpgradeStat}
            canAfford={canAffordStat('spirit')}
            fpBalance={getSpendableFP('spirit')}
            isSpirit
          />
        </View>
      </View>

      {/* FP Breakdown */}
      <View style={styles.fpBreakdownCard}>
        <Text style={styles.cardTitle}>FP Breakdown</Text>
        <View style={styles.fpGrid}>
          <FPRow label="Generic" value={fp.generic} color={colors.reward.fp} />
          <FPRow label="Power" value={fp.power} color={colors.stats.power} />
          <FPRow label="Guard" value={fp.guard} color={colors.stats.guard} />
          <FPRow label="Speed" value={fp.speed} color={colors.stats.speed} />
          <FPRow label="Vigor" value={fp.vigor} color={colors.stats.vigor} />
          <FPRow label="Focus" value={fp.focus} color={colors.stats.focus} />
          <FPRow label="Spirit" value={fp.spirit} color={colors.stats.spirit} />
        </View>
      </View>

      <ShareCardModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        petType={petType}
        petName={petName}
        stats={stats}
        evolutionStage={evolutionStage}
        streakDays={streakDays}
        totalWorkouts={totalWorkouts}
        totalFPEarned={totalFPEarned}
      />
    </ScrollView>
  );
}

function StatRow({
  label,
  stat,
  value,
  color,
  cost,
  onUpgrade,
  canAfford,
  fpBalance,
  isSpirit = false,
}: {
  label: string;
  stat: StatType;
  value: number;
  color: string;
  cost: number;
  onUpgrade: (stat: StatType) => void;
  canAfford: boolean;
  fpBalance: number;
  isSpirit?: boolean;
}) {
  const isMaxed = value >= 50;

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <View style={styles.statBar}>
        <View
          style={[styles.statFill, { width: `${(value / 50) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Pressable
        style={[styles.upgradeButton, (!canAfford || isMaxed) && styles.buttonDisabled]}
        onPress={() => onUpgrade(stat)}
        disabled={!canAfford || isMaxed}
        accessibilityRole="button"
        accessibilityLabel={`Upgrade ${label} for ${cost} FP`}
      >
        <Text style={styles.upgradeButtonText}>{isMaxed ? 'MAX' : '+1'}</Text>
        {!isMaxed && (
          <Text style={styles.upgradeCost}>
            {cost}
            {isSpirit ? ' 🔮' : ''}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function FPRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.fpRow}>
      <Text style={[styles.fpRowLabel, { color }]}>{label}</Text>
      <Text style={styles.fpRowValue}>{value}</Text>
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
    backgroundColor: colors.reward.fp + '20',
    borderRadius: radius.lg,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.reward.fp,
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
  petContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  petPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  petEmoji: {
    fontSize: 80,
  },
  petName: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  shareButton: {
    marginTop: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  shareButtonText: {
    ...textStyles.button,
    color: colors.reward.fp,
  },
  petType: {
    ...textStyles.body,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  evolutionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  evolutionStage: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  evoXP: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  careCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  careRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  careLabel: {
    ...textStyles.body,
    color: colors.text.secondary,
    width: 60,
  },
  careValue: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
    width: 40,
    textAlign: 'right',
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.semantic.success,
    borderRadius: radius.sm,
  },
  feedButton: {
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  feedButtonText: {
    ...textStyles.caption,
    color: colors.background.primary,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  statsList: {
    gap: spacing[3],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    ...textStyles.body,
    width: 55,
    fontWeight: '600',
  },
  statBar: {
    flex: 1,
    height: 10,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing[2],
  },
  statFill: {
    height: '100%',
    borderRadius: radius.sm,
  },
  statValue: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
    width: 25,
    textAlign: 'right',
  },
  upgradeButton: {
    backgroundColor: colors.reward.fp,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    marginLeft: spacing[2],
    minWidth: 45,
    alignItems: 'center',
  },
  upgradeButtonText: {
    ...textStyles.caption,
    color: colors.background.primary,
    fontWeight: '600',
  },
  upgradeCost: {
    ...textStyles.caption,
    color: colors.background.primary,
    fontSize: 9,
  },
  buttonDisabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
  fpBreakdownCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  fpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  fpRow: {
    width: '47%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background.tertiary,
    padding: spacing[2],
    borderRadius: radius.sm,
  },
  fpRowLabel: {
    ...textStyles.caption,
    fontWeight: '600',
  },
  fpRowValue: {
    ...textStyles.caption,
    color: colors.text.primary,
  },
});
