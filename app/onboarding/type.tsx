// =============================================================================
// IronQuest Onboarding — Step 1: Choose Pet Type
// =============================================================================
// Phase 2 (issue #33): first-run type selection using the resolved 3-type
// Ferro/Flux/Terra taxonomy. The selected type is forwarded to the next step
// via router params (stateless — no transient store needed).

import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PetAvatar, createDefaultStats } from '@/components/pet';
import { GAMIFICATION_ENABLED } from '@/config';
import { selectIsPetInitialized, usePetStore } from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { PetType } from '@/types';
import { haptics } from '@/utils/haptics';

interface TypeOption {
  id: PetType;
  name: string;
  tagline: string;
  blurb: string;
  affinity: string;
}

// Visual themes mirror docs/04-pet-system/pet-types.md.
const TYPE_OPTIONS: TypeOption[] = [
  {
    id: 'ferro',
    name: 'Ferro',
    tagline: 'Metallic · Angular · Industrial',
    blurb: 'A resilient forged companion that sharpens with every push.',
    affinity: 'Power + Focus',
  },
  {
    id: 'flux',
    name: 'Flux',
    tagline: 'Energetic · Fluid · Electric',
    blurb: 'A restless current of sparks that never sits still.',
    affinity: 'Speed + Spirit',
  },
  {
    id: 'terra',
    name: 'Terra',
    tagline: 'Organic · Rounded · Natural',
    blurb: 'A steady, grounded grower rooted in patience and pull.',
    affinity: 'Guard + Vigor',
  },
];

// Stage-1 preview with neutral stats so the card shows a clean base shape in
// the type's color (no armor/aura/motion-line overlays, which need higher stats).
const PREVIEW_STATS = createDefaultStats();

export default function OnboardingTypeScreen() {
  // Game-layer route: unreachable from the tab bar in the tracker build, but a
  // deep link or a restored URL could still land here. Bounce to the tracker.
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const isPetInitialized = usePetStore(selectIsPetInitialized);
  const [selected, setSelected] = useState<PetType | null>(null);

  // An initialized pet means onboarding is done — never show it again, whether
  // reached via back-nav, deep link, or a reload while sitting on this route.
  if (isPetInitialized) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSelect = (id: PetType) => {
    setSelected(id);
    haptics.tap();
  };

  const handleContinue = () => {
    if (!selected) return;
    haptics.selection();
    router.push({ pathname: '/onboarding/name', params: { type: selected } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Choose your companion</Text>
      <Text style={styles.subtitle}>
        Your pet's type shapes its look and its strengths in the Tower. You can raise any pet into a
        champion — pick the one that calls to you.
      </Text>

      <View style={styles.cards}>
        {TYPE_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(opt.id)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${opt.name} type`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.preview}>
                <PetAvatar
                  petType={opt.id}
                  stats={PREVIEW_STATS}
                  evolutionStage={1}
                  size={84}
                  animated={false}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.typeName}>{opt.name}</Text>
                <Text style={styles.tagline}>{opt.tagline}</Text>
                <Text style={styles.blurb}>{opt.blurb}</Text>
                <Text style={styles.affinity}>Stat affinity · {opt.affinity}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Type triangle reference */}
      <View style={styles.triangleCard}>
        <Text style={styles.triangleTitle}>Type Triangle</Text>
        <Text style={styles.triangle}>Ferro → Flux → Terra → Ferro</Text>
        <Text style={styles.triangleNote}>Advantage: 1.3× damage dealt · 0.8× taken</Text>
      </View>

      <Pressable
        style={[styles.continueButton, !selected && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!selected}
        accessibilityRole="button"
        accessibilityLabel="Continue to naming your companion"
        accessibilityState={{ disabled: !selected }}
      >
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
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
    paddingBottom: spacing[10],
  },
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[5],
    lineHeight: 22,
  },
  cards: {
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.reward.fp,
    backgroundColor: colors.background.elevated,
  },
  preview: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  cardBody: {
    flex: 1,
  },
  typeName: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  tagline: {
    ...textStyles.caption,
    color: colors.reward.fp,
    marginBottom: spacing[1],
    fontWeight: '600',
  },
  blurb: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[1],
    lineHeight: 20,
  },
  affinity: {
    ...textStyles.caption,
    color: colors.text.tertiary,
  },
  triangleCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  triangleTitle: {
    ...textStyles.label,
    color: colors.text.tertiary,
    marginBottom: spacing[2],
  },
  triangle: {
    ...textStyles.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  triangleNote: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
  continueButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  continueText: {
    ...textStyles.buttonLarge,
    color: colors.background.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
});
