// =============================================================================
// Embr Tab Navigation Layout
// =============================================================================

import { ChevronLeft } from '@/components/icons';
import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/icons/TabIcon';
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
          // 64 was the first height that cleared that. On a phone the bar
          // also carries `insets.bottom` (~34px for the home indicator) on
          // top of whatever we set here, so 64 read as too tall.
          //
          // 56 is the floor, and only because the stack below it is pinned:
          //
          //   24  icon      `tabBarIconStyle` — react-navigation's icon
          //                 wrapper is a hardcoded 28 regardless of the size
          //                 TabIcon draws at, so 4px was pure padding.
          //   13  label     explicit `lineHeight`. Without one the label
          //                 renders at `normal` and flex-shrinks to fit,
          //                 which is how it silently squeezed to 9px.
          //   10  item      5px top + bottom, applied by BottomTabItem to an
          //                 element `tabBarItemStyle` doesn't reach. Not
          //                 removable from here.
          //    6  bar       the paddingTop/paddingBottom below.
          //    1  border    borderTopWidth.
          //   --
          //   54            2px of slack in a 56px bar.
          //
          // Don't shrink this further without measuring the label's rendered
          // height at 390px width. It doesn't wrap or truncate when it runs
          // out of room — it collapses toward 0 and vanishes.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 3,
          paddingTop: 3,
        },
        // Trims react-navigation's 28px icon wrapper to the 24px the icon
        // actually draws at. See the height budget above.
        tabBarIconStyle: {
          height: 24,
        },
        tabBarActiveTintColor: roles.accent,
        tabBarInactiveTintColor: roles.textMuted,
        // The label was rendering in the browser's system-ui font — the tab bar
        // was the last surface in the app not speaking in Embr's typeface.
        //
        // `lineHeight` is not cosmetic — it's what makes the bar's height
        // budget deterministic. See tabBarStyle above.
        tabBarLabelStyle: {
          fontFamily: textStyles.caption.fontFamily,
          fontSize: 11,
          lineHeight: 13,
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
