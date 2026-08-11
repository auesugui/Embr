// =============================================================================
// Embr Tab Bar Icons
// =============================================================================
// Thin wrapper over Lucide (ADR-0013).
//
// This file used to hand-draw four 24x24 Feather-convention paths in
// react-native-svg. That was the right call when four icons were all the app
// needed — but everywhere *outside* the tab bar the app was using Unicode glyphs
// (✎ ↻ ⧉ ✕ ▴ ▾ › ●) as icons, and that inconsistency read "amateur" faster than
// anything else in the UI. Forty hand-drawn icons is a month of work for a
// personal app; Lucide is Feather's successor and matches the four that were
// already here.
//
// lucide-react-native renders through react-native-svg, which was already a
// dependency (pet avatar, radar chart) and behaves identically on web, iOS, and
// Android. The web-invisibility problem that ruled out expo-symbols does not
// apply.
//
// A custom, owned icon set is still the eventual goal — see ADR-0013's queued
// passes. This is the interim that makes the app consistent today.

import { Castle, ClipboardList, Heart, User } from 'lucide-react-native';

import { roles } from '@/theme';

export type TabIconName = 'quest' | 'den' | 'tower' | 'profile';

interface TabIconProps {
  name: TabIconName;
  /**
   * Whether the owning tab is currently focused. We derive the icon color from
   * `focused` (rather than the `color` argument expo-router passes to
   * `tabBarIcon`) because on web expo-router forwards the active tint as
   * `color` to every tab regardless of focus, so the `color` prop cannot
   * produce an inactive state. Reading `focused` + theme tokens works
   * identically on web, iOS, and Android.
   */
  focused: boolean;
  /** Pixel size of the icon square. Defaults to 24. */
  size?: number;
}

const STROKE_WIDTH = 2;

const ICONS = {
  quest: ClipboardList,
  den: Heart,
  tower: Castle,
  profile: User,
} as const;

/**
 * Single tab icon. Color comes from theme roles by `focused`: the ember accent
 * when active, muted text when not — matching the tab bar's configured tints.
 */
export function TabIcon({ name, focused, size = 24 }: TabIconProps) {
  const Icon = ICONS[name];
  if (!Icon) return null;

  return (
    <Icon size={size} color={focused ? roles.accent : roles.textMuted} strokeWidth={STROKE_WIDTH} />
  );
}
