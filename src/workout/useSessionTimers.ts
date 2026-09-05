// =============================================================================
// useSessionTimers — the two clocks a session can be running
// =============================================================================
// Rest and the block clock tick independently: a rest timer between sets and a
// block window are different things, and one running must not stop the other.
// Both are separate intervals for that reason, not one shared tick.
//
// The intervals only ask the store to recompute. Neither clock counts its own
// ticks — the store derives elapsed from a wall-clock anchor — so a dropped or
// throttled tick shows a stale number for a moment and then corrects itself,
// rather than permanently losing that second.

import { useEffect, useRef } from 'react';

interface Clock {
  running: boolean;
  paused: boolean;
}

/** Runs `tick` once a second while the clock is running and not paused. */
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

    return () => {
      if (ref.current) {
        clearInterval(ref.current);
      }
    };
  }, [clock.running, clock.paused, tick]);
}

export function useSessionTimers(args: {
  restTimer: Clock;
  blockTimer: Clock;
  tickRestTimer: () => void;
  tickBlockTimer: () => void;
}) {
  useTick(args.restTimer, args.tickRestTimer);
  useTick(args.blockTimer, args.tickBlockTimer);
}
