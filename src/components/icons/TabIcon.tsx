// =============================================================================
// Embr Tab Bar Icons
// =============================================================================
// Thin wrapper over the app's own icon set (src/components/icons).
//
// History worth keeping: this file originally hand-drew four Feather-convention
// paths, then moved to Lucide (ADR-0013) because everywhere *outside* the tab
// bar was still using Unicode glyphs as icons and consistency mattered more
// than ownership. That was the right interim call. The set is now drawn and
// owned, so the wrapper points at it instead.
//
// The `den` and `tower` entries are gone with the game layer (ADR-0014). They
// survived here as dead map keys long after the routes were deleted.

import { ClipboardList, User } from '@/components/icons';
import { roles } from '@/theme';

export type TabIconName = 'quest' | 'profile';

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

const ICONS = {
  quest: ClipboardList,
  profile: User,
} as const;

/**
 * Single tab icon. Color comes from theme roles by `focused`: the ember accent
 * when active, muted text when not — matching the tab bar's configured tints.
 */
export function TabIcon({ name, focused, size = 24 }: TabIconProps) {
  const Icon = ICONS[name];
  if (!Icon) return null;

  return <Icon size={size} color={focused ? roles.accent : roles.textMuted} />;
}
