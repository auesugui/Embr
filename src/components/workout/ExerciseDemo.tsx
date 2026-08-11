// =============================================================================
// ExerciseDemo — two-panel mannequin form diagram
// =============================================================================
// Renders the start/end position diagram for an exercise. Two variants: a
// collapsible thumbnail inside the session's exercise card, and a larger inline
// panel for the rest timer overlay (rest is when there's actually time to look
// at it).
//
// Web-only for now. The images are served from public/ so a native build has no
// bundled asset to resolve — rather than render a broken image on device, this
// returns null off web. Bundling them would need require() per file and ~4 MB
// in the app binary; not worth it until there's a native build to ship.
//
// The caption is not decoration. These are AI-generated and were reviewed by
// eye, not by a coach — joint angles are approximate and a couple are wrong in
// ways a lifter would catch. Labelling them as a reference rather than
// instruction is the honest framing, and it should survive future edits.

import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getExerciseDemoUri } from '@/data';
import { colors, radius, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

/** Source images are 3:4 two-panel diagrams. */
const DEMO_ASPECT_RATIO = 3 / 4;

interface ExerciseDemoProps {
  /** Exercise id — matches the demo filename. */
  exerciseId: string;
  /** 'card' starts collapsed behind a toggle; 'overlay' renders always-open. */
  variant?: 'card' | 'overlay';
}

export function ExerciseDemo({ exerciseId, variant = 'card' }: ExerciseDemoProps) {
  const [expanded, setExpanded] = useState(variant === 'overlay');
  const [failed, setFailed] = useState(false);

  const uri = getExerciseDemoUri(exerciseId);

  // No demo for this exercise, not on web, or the image 404'd — render nothing
  // rather than a broken frame or an empty labelled box.
  if (!uri || Platform.OS !== 'web' || failed) return null;

  const image = (
    <View style={styles.imageWrap}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
        accessibilityLabel="Form diagram: start and end positions"
      />
      <Text style={styles.caption}>Start / end positions · reference only, not a form guide</Text>
    </View>
  );

  if (variant === 'overlay') {
    return <View style={styles.overlayContainer}>{image}</View>;
  }

  return (
    <View style={styles.cardContainer}>
      <Pressable
        style={styles.toggle}
        onPress={() => {
          haptics.tap();
          setExpanded((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide form diagram' : 'Show form diagram'}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.toggleText}>{expanded ? 'Hide demo' : 'Show demo'}</Text>
        <Text style={styles.toggleChevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded && image}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  overlayContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: spacing[4],
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
  },
  toggleText: {
    ...textStyles.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  toggleChevron: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  imageWrap: {
    marginTop: spacing[2],
    alignItems: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: DEMO_ASPECT_RATIO,
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
  },
  caption: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
    textAlign: 'center',
  },
});
