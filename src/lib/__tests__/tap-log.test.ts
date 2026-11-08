import { type TargetLike, appendEntry, describeTarget, formatLog, parseStored } from '../tap-log';

const el = (
  tagName: string,
  attrs: Record<string, string> = {},
  extra: Partial<TargetLike> = {}
) => ({
  tagName,
  getAttribute: (name: string) => attrs[name] ?? null,
  textContent: null,
  parentElement: null,
  ...extra,
});

describe('describeTarget', () => {
  it('names the nearest labelled ancestor', () => {
    const backdrop = el('DIV', { 'aria-label': 'Close set input' });
    expect(describeTarget(el('DIV', {}, { parentElement: backdrop }))).toBe(
      'div [Close set input]'
    );
  });

  it('falls back to the text, shortened', () => {
    expect(describeTarget(el('DIV', {}, { textContent: '  +5\n ' }))).toBe('div "+5"');
  });

  it('handles a missing target', () => {
    expect(describeTarget(null)).toBe('none');
  });
});

describe('appendEntry', () => {
  it('keeps only the newest entries past the limit', () => {
    let log = [{ t: 1, kind: 'a', detail: '' }];
    log = appendEntry(log, { t: 2, kind: 'b', detail: '' }, 2);
    log = appendEntry(log, { t: 3, kind: 'c', detail: '' }, 2);
    expect(log.map((e) => e.kind)).toEqual(['b', 'c']);
  });
});

describe('formatLog', () => {
  it('prints times relative to the first entry', () => {
    const text = formatLog(
      [
        { t: 1000, kind: 'touchstart', detail: 'div "+5"' },
        { t: 2500, kind: 'step-reps', detail: '5' },
      ],
      'UA'
    );
    expect(text.split('\n').slice(1)).toEqual(['0.00s touchstart div "+5"', '1.50s step-reps 5']);
  });
});

describe('parseStored', () => {
  it('returns nothing for a missing or corrupt value', () => {
    expect(parseStored(null)).toEqual([]);
    expect(parseStored('{oops')).toEqual([]);
    expect(parseStored('{"a":1}')).toEqual([]);
  });
});
