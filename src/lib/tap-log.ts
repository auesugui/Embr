// =============================================================================
// Tap log — temporary diagnosis for the Edit Set steppers going dead
// =============================================================================
// On iPhone the sheet's ±buttons stop responding mid-workout and only an app
// restart recovers. It doesn't reproduce in Chrome. This records raw touches
// beside the app's own reactions, so a stuck log shows which layer drops them:
// no touchstart means the browser never delivered the tap, a touch with no
// `step` mark after it means the press system swallowed it.
//
// Always on, because a home-screen app doesn't share storage with Safari and
// can't be switched on by a link. Local only: nothing leaves the device until
// Adrian copies it (five taps on the version line in Profile). Remove once the
// cause is found.

import { Platform } from 'react-native';

import { downloadTextFile } from '@/lib/backup-file';

const STORAGE_KEY = 'embr.tapLog';
const LIMIT = 400;
const SAVE_DELAY_MS = 1500;

export interface TapEntry {
  /** Milliseconds since the epoch. */
  t: number;
  kind: string;
  detail: string;
}

/** The fields describeTarget reads, so tests can pass plain objects. */
export interface TargetLike {
  tagName?: string;
  getAttribute?: (name: string) => string | null;
  textContent?: string | null;
  parentElement?: TargetLike | null;
}

/**
 * A short label for what a touch landed on: the nearest label or test id, else
 * the tag and its text. Enough to tell a stepper from the backdrop.
 */
export function describeTarget(target: TargetLike | null | undefined): string {
  if (!target?.tagName) return 'none';
  const tag = target.tagName.toLowerCase();
  let node: TargetLike | null | undefined = target;
  for (let depth = 0; node && depth < 4; depth += 1) {
    const label = node.getAttribute?.('aria-label') ?? node.getAttribute?.('data-testid');
    if (label) return `${tag} [${label}]`;
    node = node.parentElement;
  }
  const text = (target.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return text ? `${tag} "${text}"` : tag;
}

/** Appends, dropping the oldest past `limit`. */
export function appendEntry(entries: TapEntry[], entry: TapEntry, limit = LIMIT): TapEntry[] {
  const next =
    entries.length >= limit ? entries.slice(entries.length - limit + 1) : entries.slice();
  next.push(entry);
  return next;
}

/** One line per entry, times relative to the first so gaps are readable. */
export function formatLog(entries: TapEntry[], userAgent = ''): string {
  if (entries.length === 0) return 'Tap log is empty.';
  const start = entries[0].t;
  const lines = entries.map((e) =>
    `${((e.t - start) / 1000).toFixed(2)}s ${e.kind} ${e.detail}`.trimEnd()
  );
  return [`Embr tap log, ${new Date(start).toISOString()}, ${userAgent}`, ...lines].join('\n');
}

function isEntry(value: unknown): value is TapEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { t, kind, detail } = value as Record<string, unknown>;
  return Number.isFinite(t) && typeof kind === 'string' && typeof detail === 'string';
}

/** Parses the stored log. A missing or corrupt value, or one bad entry, yields an empty log. */
export function parseStored(raw: string | null): TapEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isEntry) ? parsed.slice(-LIMIT) : [];
  } catch {
    return [];
  }
}

/** The fields eventDetail reads from a touch or pointer event. */
export interface EventLike {
  target: unknown;
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
}

/**
 * Target, position and fingers down for one event. Touch events carry their own
 * count; a click or pointercancel gets the count from the last touch event.
 */
export function eventDetail(event: EventLike, touchesDown: number): string {
  const point = event.changedTouches?.[0] ?? event;
  const at =
    point.clientX === undefined || point.clientY === undefined
      ? ''
      : ` @${Math.round(point.clientX)},${Math.round(point.clientY)}`;
  const via = event.pointerType ? ` ${event.pointerType}` : '';
  return `${describeTarget(event.target as TargetLike)}${at} touches=${touchesDown}${via}`;
}

let entries: TapEntry[] = [];
let touchesDown = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function save(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: the in-memory log still copies.
  }
}

/** Records an app-side event, such as the sheet opening or a stepper firing. */
export function tapLogMark(kind: string, detail = ''): void {
  if (!started) return;
  entries = appendEntry(entries, { t: Date.now(), kind, detail });
  if (!saveTimer) saveTimer = setTimeout(save, SAVE_DELAY_MS);
}

function onTouch(event: TouchEvent): void {
  touchesDown = event.touches.length;
  tapLogMark(event.type, eventDetail(event, touchesDown));
}

function onPointer(event: PointerEvent): void {
  tapLogMark(event.type, eventDetail(event, touchesDown));
}

function onVisibility(): void {
  tapLogMark('visibility', document.visibilityState);
  if (document.visibilityState === 'hidden') save();
}

/** Starts recording. Web only, and once per page load. */
export function startTapLog(): void {
  if (Platform.OS !== 'web' || started || typeof document === 'undefined') return;
  started = true;
  try {
    entries = parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    entries = [];
  }
  tapLogMark('launch', location.pathname);
  const options = { capture: true, passive: true };
  for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) {
    document.addEventListener(type, onTouch, options);
  }
  for (const type of ['pointercancel', 'click'] as const) {
    document.addEventListener(type, onPointer as EventListener, options);
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);
}

/** The log as text, for copying. */
export function tapLogText(): string {
  return formatLog(entries, typeof navigator === 'undefined' ? '' : navigator.userAgent);
}

/**
 * Copies the log, or saves it as a file where the clipboard refuses. Call from
 * a tap handler: Safari only allows clipboard writes inside a user gesture.
 */
export async function copyTapLog(): Promise<'copied' | 'saved'> {
  const text = tapLogText();
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    downloadTextFile('embr-tap-log.txt', text);
    return 'saved';
  }
}
