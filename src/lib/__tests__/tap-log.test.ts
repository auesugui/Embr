import {
  type TargetLike,
  appendEntry,
  describeTarget,
  eventDetail,
  formatLog,
  parseStored,
} from '../tap-log';

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

  it('drops an array holding a malformed entry', () => {
    expect(parseStored('[null]')).toEqual([]);
    expect(parseStored('[{}]')).toEqual([]);
    expect(
      parseStored('[{"t":1,"kind":"a","detail":""},{"t":"x","kind":"b","detail":""}]')
    ).toEqual([]);
  });

  it('restores well-formed entries', () => {
    const entry = { t: 1, kind: 'touchstart', detail: 'div' };
    expect(parseStored(JSON.stringify([entry]))).toEqual([entry]);
  });
});

describe('eventDetail', () => {
  const target = el('DIV', {}, { textContent: '+1' });

  it('reads position from the changed touch of a touch event', () => {
    expect(eventDetail({ target, changedTouches: [{ clientX: 10.4, clientY: 20.6 }] }, 1)).toBe(
      'div "+1" @10,21 touches=1'
    );
  });

  it('reads position and pointer type from a click or pointercancel', () => {
    expect(eventDetail({ target, clientX: 5, clientY: 6, pointerType: 'touch' }, 0)).toBe(
      'div "+1" @5,6 touches=0 touch'
    );
  });

  it('omits a position the event lacks', () => {
    expect(eventDetail({ target }, 2)).toBe('div "+1" touches=2');
  });
});
