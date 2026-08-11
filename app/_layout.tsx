// =============================================================================
// Embr App Root Layout
// =============================================================================

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config';
import { ROUTE_TITLES } from '@/navigation/routeTitles';
import {
  useBaselineStore,
  usePRStore,
  usePlayerStore,
  useSettingsStore,
  useTemplateStore,
  useWeightHistoryStore,
  useWorkoutHistoryStore,
  useWorkoutStore,
} from '@/stores';
import { ACTIVE_THEME, getFontMap, roles, textStyles } from '@/theme';
import { migrateStorage } from '@/utils/storage';

export default function RootLayout() {
  // Embr's two faces (ADR-0013). Loading is gated with hydration below so text
  // never paints in the system fallback and then reflows.
  const [fontsLoaded, fontError] = useFonts(getFontMap());

  const hydratePlayer = usePlayerStore((state) => state.hydrate);
  const hydrateWorkout = useWorkoutStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const hydrateWeightHistory = useWeightHistoryStore((state) => state.hydrate);
  const hydratePR = usePRStore((state) => state.hydrate);
  const hydrateBaseline = useBaselineStore((state) => state.hydrate);
  const hydrateTemplates = useTemplateStore((state) => state.hydrate);
  const hydrateWorkoutHistory = useWorkoutHistoryStore((state) => state.hydrate);
  const theme = useSettingsStore((state) => state.theme);

  // A8 hydration gate: stores hydrate from AsyncStorage asynchronously, but the
  // web build uses static rendering ("output": "static" in app.json), so the
  // server renders default store state while the client renders persisted state
  // -> React #418 hydration mismatch on every page load. We gate first paint
  // behind `isHydrated`: until stores are ready we render a stable placeholder
  // (a single background-colored View, no store-derived values), which is
  // identical on the server and the client's first paint. The transition to
  // real content happens via a normal state update after hydration — not during
  // React's hydration reconciliation — so #418 cannot fire.
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate all stores on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await migrateStorage();
        await Promise.all([
          hydratePlayer(),
          hydrateWorkout(),
          hydrateSettings(),
          hydrateWeightHistory(),
          hydratePR(),
          hydrateBaseline(),
          hydrateTemplates(),
          hydrateWorkoutHistory(),
        ]);
      } catch (error) {
        console.warn('Storage initialization error:', error);
      } finally {
        // Always reveal the app, even if hydration errored, so we never hang on
        // the placeholder forever — default store state is preferable to a
        // permanent blank screen.
        if (!cancelled) setIsHydrated(true);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [
    hydratePlayer,
    hydrateWorkout,
    hydrateSettings,
    hydrateWeightHistory,
    hydratePR,
    hydrateBaseline,
    hydrateTemplates,
    hydrateWorkoutHistory,
  ]);

  // Document title for web (browser tab, home-screen icon label, SEO).
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = APP_NAME;
    }
  }, []);

  // The palette is resolved before this component ever runs (see
  // src/theme/theme-boot.ts) — the settings value is read there, from
  // localStorage on web, so `theme` here is only useful for reacting to a change
  // the user just made. Changing it triggers a reload, handled in Profile.
  void theme;

  // Fonts failing to load is not fatal — better to paint in the system face than
  // to hang on a blank screen — but it should be loud, since it silently undoes
  // the entire typographic identity.
  if (fontError) {
    console.warn('Font load failed; falling back to system face:', fontError);
  }
  const fontsReady = fontsLoaded || !!fontError;

  // Stable pre-hydration shell. No store-derived content reaches the DOM here,
  // so server HTML and client first paint are byte-identical.
  if (!isHydrated || !fontsReady) {
    return (
      <SafeAreaProvider>
        {/* Transparent on web: the document background is already painted the
            right color by the boot script, and keeping this shell theme-free is
            what lets server HTML and client first paint stay identical. */}
        <View
          style={{
            flex: 1,
            backgroundColor: Platform.OS === 'web' ? 'transparent' : roles.surface,
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={ACTIVE_THEME === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: roles.surface,
          },
          headerTintColor: roles.textPrimary,
          headerTitleStyle: {
            fontFamily: textStyles.h4.fontFamily,
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: roles.surface,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Phase 2 onboarding (issue #33): chrome-free first-run wizard. */}
        <Stack.Screen name="onboarding/type" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/name" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/template" options={{ headerShown: false }} />
        {/* A2: explicit human titles so headers never show raw route paths.
            Titles live in ROUTE_TITLES (single source of truth, regression-
            tested in src/__tests__/routeTitles.unit.test.ts). */}
        <Stack.Screen
          name="workout/session"
          options={{
            headerShown: true,
            title: ROUTE_TITLES['workout/session'],
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen name="workout/loadout" options={{ title: ROUTE_TITLES['workout/loadout'] }} />
        <Stack.Screen name="workout/summary" options={{ title: ROUTE_TITLES['workout/summary'] }} />
        <Stack.Screen
          name="workout/template/[id]"
          options={{ title: ROUTE_TITLES['workout/template/[id]'] }}
        />
        <Stack.Screen
          name="workout/template-edit/[id]"
          options={{ title: ROUTE_TITLES['workout/template-edit/[id]'] }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
