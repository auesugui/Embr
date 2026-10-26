// =============================================================================
// useSessionTimers — the clocks a session runs on
// =============================================================================
// Three of them: rest between sets, the window of a timed block, and the
// session's own elapsed time. Rest and the block tick independently, because
// they are different things and one running must not stop the other.
//
// None of them counts its own ticks. Every clock is anchored to a wall-clock
// instant and recomputed on read, so a dropped or throttled tick shows a stale
// number for a moment and then corrects itself rather than permanently losing
// that second. The foreground listener is what makes "a moment" honest: a
// hidden tab's interval is throttled to a minute or frozen outright, so coming
// back has to ask for a fresh read instead of waiting for the next fire.

import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { sessionElapsed } from '@/lib/session-clock';

interface Clock {
  running: boolean;
  paused: boolean;
}

/** Calls `onForeground` whenever the app or tab comes back. Returns a stop. */
function watchForeground(onForeground: () => void): () => void {
  if (Platform.OS === 'web') {
    // The static export prerenders without a DOM; the listener attaches on the
    // client when the effect re-runs there.
    if (typeof document === 'undefined') return () => {};

    const onVisible = () => {
      if (document.visibilityState === 'visible') onForeground();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onForeground();
  });
  return () => subscription.remove();
}

/** Runs `tick` once a second while the clock is running, and on every return. */
function useTick(clock: Clock, tick: () => void) {
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (clock.running && !clock.paused) {
      ref.current = setInterval(() => {
        tick();
      }, 1000);
    } else if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }

    const stopWatching = watchForeground(tick);

    return () => {
      if (ref.current) {
        clearInterval(ref.current);
      }
      stopWatching();
    };
  }, [clock.running, clock.paused, tick]);
}

/** Seconds since the session started, re-derived from its anchor every second. */
function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(() => sessionElapsed(startedAt, Date.now()));

  useEffect(() => {
    const read = () => setElapsed(sessionElapsed(startedAt, Date.now()));
    read();

    const interval = setInterval(read, 1000);
    const stopWatching = watchForeground(read);

    return () => {
      clearInterval(interval);
      stopWatching();
    };
  }, [startedAt]);

  return elapsed;
}

export function useSessionTimers(args: {
  /** ms epoch the session started — the elapsed clock's only anchor. */
  startedAt: number | null;
  restTimer: Clock;
  blockTimer: Clock;
  tickRestTimer: () => void;
  tickBlockTimer: () => void;
}): { elapsed: number } {
  useTick(args.restTimer, args.tickRestTimer);
  useTick(args.blockTimer, args.tickBlockTimer);
  const elapsed = useElapsed(args.startedAt);
  return { elapsed };
}
