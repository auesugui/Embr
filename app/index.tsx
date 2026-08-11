// =============================================================================
// Embr Index Screen
// =============================================================================
// This used to gate first run: with the game layer on it routed into an
// onboarding wizard whose whole job was picking and naming a pet, falling
// through to the tab navigator only once one existed. The game layer is gone
// (ADR-0014), so there's nothing to choose and nothing to gate on.
//
// The route stays rather than being deleted — expo-router resolves "/" here,
// and an installed PWA launches at "/" from its home-screen icon.

import { Redirect } from 'expo-router';

export default function IndexScreen() {
  return <Redirect href="/(tabs)" />;
}
