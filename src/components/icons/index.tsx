// =============================================================================
// Embr icon set
// =============================================================================
// Eighteen icons, drawn on one 24×24 grid with one set of rules. This replaces
// `@/components/icons`, which was the last third-party visual system left in
// the app after ADR-0013 replaced the fonts, the palette and the art.
//
// BE HONEST ABOUT WHAT THIS BUYS. Most of these are generic affordances — a
// chevron is a chevron, and nobody will look at ours and think "that's Embr".
// What owning the file actually gets you is threefold: the marks that DO carry
// brand (the flame, the figure) are ours and match the app icon; every glyph
// obeys the same optical rules rather than a vendor's; and the set can't drift
// when a dependency bumps. The chevrons are the price of the flame.
//
// THE RULES, applied to all of them:
//   - 24×24 viewBox, geometry inset ~2.5 units so nothing touches the edge
//   - stroke 1.75 by default, scaling with size so a 34px icon isn't spindly
//   - round caps and joins everywhere — the app's whole register is soft, and
//     mitred corners are the single loudest "system default" tell
//   - open chevrons (5 across, 5.5 down) rather than Lucide's 45°, which reads
//     a touch gentler at the sizes we use them
//   - no fills except the flame, which is the brand mark and needs the weight
//
// Sizing note: `strokeWidth` scales off `size` so the same glyph reads
// correctly in a 14px row affordance and a 34px empty-state mark.

import type { ReactNode } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { roles } from '@/theme';

export interface IconProps {
  size?: number;
  color?: ColorValue;
  /** Overrides the size-derived default. Rarely needed. */
  strokeWidth?: number;
  /** Layout only. A couple of call sites nudge spacing on the glyph itself. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Stroke width in viewBox units, compensated for render size.
 *
 * The SVG scales, so a fixed 1.75 renders thinner and thinner in real pixels as
 * the icon shrinks. Nudging the viewBox stroke up for small sizes and down for
 * large ones keeps the apparent weight roughly constant from a 14px row
 * affordance to a 34px empty-state mark.
 */
const strokeFor = (size: number, override?: number): number => {
  if (override !== undefined) return override;
  return Math.max(1.4, Math.min(2.1, 1.75 + (24 - size) * 0.02));
};

interface BaseProps extends IconProps {
  children: ReactNode;
}

function Icon({ size = 24, color = '#000', strokeWidth, style, children }: BaseProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color as string}
      strokeWidth={strokeFor(size, strokeWidth)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </Svg>
  );
}

// -----------------------------------------------------------------------------
// Brand marks — the two that are actually ours
// -----------------------------------------------------------------------------

/**
 * The ember. Filled, not stroked: it is the app's mark and it has to hold at
 * 14px in a stat row, where a hollow outline turns into a smudge. The inner
 * curl is the same shape as the outer body, scaled — that self-similarity is
 * what stops it reading as a generic teardrop.
 */
export function Flame({ size = 24, color = '#000', style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M12 2.2c1.6 3.4 3.2 5.2 4.7 7 1.3 1.6 2 3.3 2 5.3a6.7 6.7 0 0 1-13.4 0c0-2.3 1-4.2 2.6-5.7.2 1.5.8 2.4 1.8 2.9.2-3.4.7-6.5 2.3-9.5z"
        fill={color as string}
      />
      {/* The ember inside. Punched out with the surface colour rather than a
          white overlay so it reads on both themes — a translucent white on the
          dark palette turned the core into a grey smudge. */}
      <Path
        d="M12 21.2a3.4 3.4 0 0 0 3.4-3.4c0-1.8-1-3-3.4-5.4-2.4 2.4-3.4 3.6-3.4 5.4a3.4 3.4 0 0 0 3.4 3.4z"
        fill={roles.surfaceRaised}
        fillOpacity={0.55}
      />
    </Svg>
  );
}

/** The figure. Rounder head and a wider shoulder arc than the stock glyph. */
export function User({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Circle cx={12} cy={8.2} r={3.7} />
      <Path d="M4.8 20.2c0-3.8 3.2-5.8 7.2-5.8s7.2 2 7.2 5.8" />
    </Icon>
  );
}

// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------

export function ChevronRight({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M9.8 6.5 15 12l-5.2 5.5" />
    </Icon>
  );
}

export function ChevronLeft({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M14.2 6.5 9 12l5.2 5.5" />
    </Icon>
  );
}

export function ChevronDown({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M6.5 9.8 12 15l5.5-5.2" />
    </Icon>
  );
}

export function ChevronUp({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M6.5 14.2 12 9l5.5 5.2" />
    </Icon>
  );
}

export function ArrowUp({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M12 19.5v-15M6.3 10.2 12 4.5l5.7 5.7" />
    </Icon>
  );
}

export function ArrowDown({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M12 4.5v15M6.3 13.8 12 19.5l5.7-5.7" />
    </Icon>
  );
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export function Plus({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}

export function X({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4" />
    </Icon>
  );
}

export function Check({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="m5 12.6 4.6 4.6L19 6.8" />
    </Icon>
  );
}

/** Export. The tray is the constant; the arrow moves against it. */
export function Download({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M12 3.5v11M7.6 10.2 12 14.6l4.4-4.4M4.5 19.5h15" />
    </Icon>
  );
}

/** Restore. Deliberately the exact mirror of Download — same tray, arrow up. */
export function Upload({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M12 14.6v-11M7.6 7.9 12 3.5l4.4 4.4M4.5 19.5h15" />
    </Icon>
  );
}

export function Copy({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M10.2 8.6h7.6a1.9 1.9 0 0 1 1.9 1.9v7.6a1.9 1.9 0 0 1-1.9 1.9h-7.6a1.9 1.9 0 0 1-1.9-1.9v-7.6a1.9 1.9 0 0 1 1.9-1.9z" />
      <Path d="M5.6 15.4a1.9 1.9 0 0 1-1.4-1.8V6a1.9 1.9 0 0 1 1.9-1.9h7.6A1.9 1.9 0 0 1 15.4 5.5" />
    </Icon>
  );
}

export function Pencil({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M15.6 5.4a1.7 1.7 0 0 1 2.4 0l.6.6a1.7 1.7 0 0 1 0 2.4L8.4 18.6l-3.9.9.9-3.9z" />
      <Path d="m14.6 6.4 3 3" />
    </Icon>
  );
}

/** Swap. Two arcs turning the same way, each with its own head. */
export function RefreshCw({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M3.8 12a8.2 8.2 0 0 1 14-5.8" />
      <Path d="M18.4 2.9v3.6h-3.6" />
      <Path d="M20.2 12a8.2 8.2 0 0 1-14 5.8" />
      <Path d="M5.6 21.1v-3.6h3.6" />
    </Icon>
  );
}

// -----------------------------------------------------------------------------
// Objects
// -----------------------------------------------------------------------------

/**
 * Delete. Lid, body, two staves.
 *
 * The one destructive glyph in the set, so it is drawn slightly narrower than
 * the lid line implies — a bin that reads as an object rather than a shouting
 * X, which is the register the rest of the app is in.
 */
export function Trash({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M4.4 6.6h15.2" />
      <Path d="M9.4 6.6V5.2a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.4" />
      <Path d="M6.6 6.6l.9 12.1a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l.9-12.1" />
      <Path d="M10.4 10.4v6.2M13.6 10.4v6.2" />
    </Icon>
  );
}

/** The workout log. The clip is the recognisable part, so it carries weight. */
export function ClipboardList({ size = 24, color = '#000', strokeWidth, style }: IconProps) {
  return (
    <Icon size={size} color={color} strokeWidth={strokeWidth} style={style}>
      <Path d="M9 4.4H6.9a2 2 0 0 0-2 2v12.7a2 2 0 0 0 2 2h10.2a2 2 0 0 0 2-2V6.4a2 2 0 0 0-2-2H15" />
      <Path d="M9.4 2.6h5.2a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2H9.4a1.2 1.2 0 0 1-1.2-1.2V3.8a1.2 1.2 0 0 1 1.2-1.2z" />
      <Path d="M8.8 11.4h6.4M8.8 15.4h4.2" />
    </Icon>
  );
}
