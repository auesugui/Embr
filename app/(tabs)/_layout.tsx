// =============================================================================
// Embr Tab Navigation Layout
// =============================================================================

import { Tabs, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/icons/TabIcon';
import { ROUTE_TITLES } from '@/navigation/routeTitles';
import { roles, spacing, textStyles } from '@/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: roles.surface,
        },
        headerTintColor: roles.textPrimary,
        headerTitleStyle: {
          fontFamily: textStyles.h4.fontFamily,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: roles.surface,
          borderTopColor: roles.border,
          borderTopWidth: 1,
          // Height has to clear icon + label stacked, not just the icon.
          //
          // At wide viewports react-navigation puts the label BESIDE the icon,
          // which needs no vertical room, so this looked fine on a desktop
          // browser. At phone widths it moves the label BELOW the icon — and
          // the old 60px height, minus 8+8 bar padding, minus another 8 of
          // per-item padding, left about a pixel. The label didn't wrap or
          // truncate; it collapsed to height 0 and vanished silently.
          //
          // 24px icon + ~14px label + breathing room = 52 of content.
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: roles.accent,
        tabBarInactiveTintColor: roles.textMuted,
        // The label was rendering in the browser's system-ui font — the tab bar
        // was the last surface in the app not speaking in Embr's typeface.
        tabBarLabelStyle: {
          fontFamily: textStyles.caption.fontFamily,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ focused }) => <TabIcon name="quest" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
      {/* History is reachable from the home screen, not the tab bar. `href:
          null` keeps the route resolvable via router.push while hiding it as a
          tab. The explicit header back affordance returns to the Quest Board
          (tab navigators don't provide one themselves). */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Workout History',
          href: null,
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.headerBack}>
                <ChevronLeft size={20} color={roles.accent} />
                <Text style={styles.headerBackText}>Back</Text>
              </View>
            </Pressable>
          ),
        }}
      />
      {/* __DEV__-only dev panel, reached from the Profile screen. `href: null`
          keeps it out of the tab bar (same pattern as history). The route must
          be registered even in production builds (expo-router auto-shows
          unregistered files as tabs); the screen itself renders null there. */}
      <Tabs.Screen
        name="dev"
        options={{
          title: ROUTE_TITLES['(tabs)/dev'],
          href: null,
          headerLeft: () => (
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.headerBack}>
                <ChevronLeft size={20} color={roles.accent} />
                <Text style={styles.headerBackText}>Back</Text>
              </View>
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
  headerBackText: {
    ...textStyles.body,
    color: roles.accent,
  },
});
