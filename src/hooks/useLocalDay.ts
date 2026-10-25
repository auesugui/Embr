// =============================================================================
// useLocalDay — a clock that re-renders when the local calendar day changes
// =============================================================================
// Anything that reads `new Date()` during render and then stays mounted is
// wrong by one day as soon as the device crosses local midnight. Embr ships as
// a PWA, so "stays mounted" is the normal case: the home tab is suspended on
// Sunday night and resumed on Monday morning with the same component tree, and
// without this the week count, the day dots, the streak and the line under them
// all still describe Sunday.
//
// Two triggers, because neither is enough alone. A timer catches the boundary
// for an app that is actually open at midnight. The foreground event catches
// the far more common case, where the tab was suspended across the boundary and
// the timer fired late, or not at all, while it was frozen.

import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { localDayKey } from '@/lib/local-day';

/** Milliseconds from `from` to the first instant of the next local day. */
export function msUntilNextLocalDay(from: Date): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return next.getTime() - from.getTime();
}

/**
 * Call `onChange` with a fresh `Date` each time the local calendar day changes,
 * at the boundary and on the next foreground. Returns an unsubscribe.
 *
 * Exported separately from the hook so the day-change logic can be tested on a
 * fake clock without a renderer.
 */
export function watchLocalDay(onChange: (now: Date) => void): () => void {
  let day = localDayKey(new Date());
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (from: Date) => {
    if (timer !== undefined) clearTimeout(timer);
    // A second past the boundary. A timer that fires a hair early reads the day
    // it was scheduled in and would then not look again until tomorrow.
    timer = setTimeout(check, msUntilNextLocalDay(from) + 1000);
  };

  function check() {
    const now = new Date();
    schedule(now);

    const key = localDayKey(now);
    if (key === day) return;
    day = key;
    onChange(now);
  }

  schedule(new Date());

  const stopTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
  };

  if (Platform.OS === 'web') {
    // The static export prerenders without a DOM; the timer alone is correct
    // there, and the listener attaches on the client when the hook re-runs.
    if (typeof document === 'undefined') return stopTimer;

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') check();
  });
  return () => {
    stopTimer();
    subscription.remove();
  };
}

/**
 * The current moment, refreshed when the local day changes. Day-granular: the
 * value is stable through the day, so a memo keyed on it recomputes once.
 */
export function useLocalDay(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => watchLocalDay(setNow), []);
  return now;
}
