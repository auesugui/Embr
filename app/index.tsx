// =============================================================================
// Embr Index Screen
// =============================================================================
// This gates first run. It used to gate it for the game layer — an onboarding
// wizard whose whole job was picking and naming a pet — and that wizard died
// with the game layer (ADR-0014). What replaced it asks one question: your
// name. There is no account and no sync, so there is nothing else to collect.
//
// expo-router resolves "/" here, and an installed PWA launches at "/" from its
// home-screen icon, so this is the one place every cold start passes through.
//
// Reading the store here is safe because the root layout holds first paint
// until every store has hydrated. Without that gate a returning user would
// flash the onboarding screen on every launch, since a pre-hydration store
// looks exactly like a new install.

import { Redirect } from 'expo-router';

import { selectNeedsOnboarding, usePlayerStore } from '@/stores';

export default function IndexScreen() {
  const needsName = usePlayerStore(selectNeedsOnboarding);

  return <Redirect href={needsName ? '/onboarding/name' : '/(tabs)'} />;
}
