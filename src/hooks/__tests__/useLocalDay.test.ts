// =============================================================================
// useLocalDay — the day-change logic, on a fake clock
// =============================================================================
// `watchLocalDay` is tested rather than the hook itself: the hook is three
// lines of useState/useEffect around it, and the behaviour worth covering is
// the timer and the foreground event, neither of which needs a renderer.

import { AppState, Platform } from 'react-native';

import { localDayKey } from '@/lib/local-day';

import { msUntilNextLocalDay, watchLocalDay } from '../useLocalDay';

// Sunday 2026-10-25, late evening. Local parts throughout: an ISO string would
// be parsed as UTC and land on a different day in most time zones.
const SUNDAY_LATE = new Date(2026, 9, 25, 23, 59, 30);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(SUNDAY_LATE);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('msUntilNextLocalDay', () => {
  it('counts to the first instant of tomorrow', () => {
    expect(msUntilNextLocalDay(SUNDAY_LATE)).toBe(30_000);
    expect(msUntilNextLocalDay(new Date(2026, 9, 25, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
  });

  it('crosses a month boundary', () => {
    expect(msUntilNextLocalDay(new Date(2026, 9, 31, 23, 0, 0))).toBe(60 * 60 * 1000);
  });
});

describe('watchLocalDay', () => {
  it('reports the new day at the boundary', () => {
    const onChange = jest.fn();
    const stop = watchLocalDay(onChange);

    jest.advanceTimersByTime(29_000);
    expect(onChange).not.toHaveBeenCalled();

    // The timer is set a second past midnight, so the whole 31s has to elapse.
    jest.advanceTimersByTime(2_000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(localDayKey(onChange.mock.calls[0][0])).toBe('2026-10-26');

    stop();
  });

  it('keeps reporting on each following day', () => {
    const onChange = jest.fn();
    const stop = watchLocalDay(onChange);

    jest.advanceTimersByTime(31_000);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(localDayKey(onChange.mock.calls[1][0])).toBe('2026-10-27');

    stop();
  });

  it('stops when unsubscribed', () => {
    const onChange = jest.fn();
    watchLocalDay(onChange)();

    jest.advanceTimersByTime(31_000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports on foreground after the clock moved past midnight', () => {
    // This is the real case: the tab is frozen across the boundary, so the
    // timer never ran while it was asleep.
    const handlers: ((state: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (state: string) => void
    ) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    const onChange = jest.fn();
    const stop = watchLocalDay(onChange);

    jest.setSystemTime(new Date(2026, 9, 26, 7, 30));
    for (const handler of handlers) handler('active');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(localDayKey(onChange.mock.calls[0][0])).toBe('2026-10-26');

    stop();
    spy.mockRestore();
  });

  it('says nothing on a foreground within the same day', () => {
    const handlers: ((state: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (state: string) => void
    ) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    const onChange = jest.fn();
    const stop = watchLocalDay(onChange);

    jest.setSystemTime(new Date(2026, 9, 25, 23, 59, 50));
    for (const handler of handlers) handler('active');
    for (const handler of handlers) handler('background');

    expect(onChange).not.toHaveBeenCalled();

    stop();
    spy.mockRestore();
  });

  it('listens for visibility on web', () => {
    const listeners: Record<string, () => void> = {};
    const fakeDocument = {
      visibilityState: 'hidden',
      addEventListener: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
      removeEventListener: (event: string) => {
        delete listeners[event];
      },
    };
    const platform = jest.replaceProperty(Platform, 'OS', 'web');
    const globals = globalThis as { document?: unknown };
    globals.document = fakeDocument;

    const onChange = jest.fn();
    const stop = watchLocalDay(onChange);

    // Hidden tabs get no update — there is nobody looking at the stale screen.
    jest.setSystemTime(new Date(2026, 9, 26, 7, 30));
    listeners.visibilitychange();
    expect(onChange).not.toHaveBeenCalled();

    fakeDocument.visibilityState = 'visible';
    listeners.visibilitychange();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(localDayKey(onChange.mock.calls[0][0])).toBe('2026-10-26');

    stop();
    expect(listeners.visibilitychange).toBeUndefined();
    globals.document = undefined;
    platform.restore();
  });
});
