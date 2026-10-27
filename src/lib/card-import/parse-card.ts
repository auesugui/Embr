// =============================================================================
// Card parser — reads a Boostcamp card from OCR lines
// =============================================================================
// Two cards are read. A finished-workout card is a title, a date line, a table of
// movements with each one's best set, and a footer with duration, volume and total
// sets. A "Next up" plan card is a week-and-day line, a title, the program, a
// progress bar, and a movement per line with its sets and its rep range.
//
// OCR gets some glyphs wrong on this layout: "lb" comes back as "1b", "lbx" or
// "|b", a stray "1" can land in front of the unit ("201lb" for 20 lb), and a
// capital I reads as "i". normalizeLine undoes those before anything is matched.
// Errors it cannot undo are caught by reading each photo twice (reconcile.ts).

/**
 * The two values a copy is built from. Each one is in exactly one of two states:
 *
 *   valid   — readSets or readReps can read it, and it is what gets copied
 *   missing — anything else: not read, read as something a copy cannot use ("0
 *             sets", "2.5", "12-3"), typed as something else, or emptied
 *
 * Both are held as the text they were read or typed as, so a field always shows what
 * it holds and nothing is corrected behind the person. Missing is flagged on the
 * field, counted in "N values need checking", and never copied; only a valid
 * replacement makes a field valid again. The one check lives in readSets and readReps
 * and every caller asks them, so the screen and the copy cannot disagree.
 */
export interface ParsedRow {
  /** Stable for the life of the reading, so the review screen can key rows that get edited. */
  id: string;
  name: string;
  /**
   * Sets prescribed or performed, as read or typed. A finished card shows only its
   * best set, so this is a check, not data.
   */
  sets: string;
  /** Best-set weight in lb. Null for a bodyweight movement and for every plan row. */
  weightLb: number | null;
  /** A count ("8") or a range ("3-12"), as read or typed. Copied into a template as written. */
  reps: string;
}

export interface ParsedCard {
  /** Which card was read, or null when no movements were found and it is neither. */
  format: 'workout' | 'plan' | null;
  title: string | null;
  /**
   * The line under the title. On a finished card that is the week and day
   * ("Week 2 - Day 1"); on a plan card it is the program ("Dumbbell PPL"), which
   * is what names a blank template, since a week number is stale the next time.
   */
  subtitle: string | null;
  /** YYYY-MM-DD, from a finished card's date line. A plan card has no date. */
  date: string | null;
  /** "Week 8 · Day 3" from a plan card, shown on the card's check line. Never stored. */
  weekDay: string | null;
  rows: ParsedRow[];
  durationMin: number | null;
  volumeLb: number | null;
  totalSets: number | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_LINE = /(?<mon>[A-Za-z]{3})[a-z]*\.?\s+(?<day>\d{1,2})[,.]?\s*(?<year>\d{4})/;
const WEEK_LINE = /Week\s*(?<week>\d+)\s*[-–·•.]\s*Day\s*(?<day>\d+)/i;
// The app's own text around the card: the status line, the PR sheet, the share row.
const APP_TEXT =
  /(Max|Estimated|1RM|BOOSTCAMP|DURATION|VOLUME|BEST SET|EXERCISE|Stories|Share|Save|Done|Solid one|workout in the books|Personal Records)/i;
// A plan card's progress bar, read as a percentage with a little artwork in front of it.
const PROGRESS_LINE = /^\D{0,4}\d{1,3}\s*%/;

/**
 * One movement, in one grammar that covers both cards:
 *
 *     row     := name figures
 *     name    := the text before the first digit, holding at least one letter
 *     figures := sets? separator (weight | range | count)?
 *     sets    := number "sets"?          — the bare count a finished card prints
 *     weight  := number "lb"? "x" number — a best set, giving the weight and the reps
 *                (the number may be a half, "12.5 lb x 8")
 *     range   := number ("-"|"–"|"to") number "reps"?
 *     count   := number "reps"
 *     separator := one of  x · • | - –, or a spaced . , : ~, or nothing
 *
 * Two rules settle what a figure is when it could be read twice:
 *
 *   1. A dash or "to" BETWEEN TWO NUMBERS is a range, never a separator. So
 *      "3-12 reps" is a rep range with no set count, not three sets of twelve,
 *      and "3 sets - 3-12 reps" is three sets of "3-12" because the dash there
 *      follows the word "sets" rather than a number.
 *   2. A period, comma, colon or tilde is the separator only with a space on each
 *      side, which is how OCR renders the card's middle dot. A decimal weight
 *      ("12.5 lb") and a thousands comma have none, so neither is split in two.
 *   3. Every number is read whole. "70 lb x 8" with no set count is a 70 lb best
 *      set, not 7 sets of a 0 lb one.
 *   4. A figure the grammar reads but a copy cannot use ("0 sets", "2.5 sets",
 *      "150 reps") keeps its movement, with that value missing. Dropping the row
 *      would take the movement off the screen along with the figure.
 *
 * A row needs a set count or a rep count, and a lone bare number is neither: it
 * could be a week, a percentage or a total. Everything the grammar does not
 * consume whole is not a row, which is how the title, the week-and-day line, the
 * progress bar, "Show less" and the finished card's footer stay out of the table.
 */
const ROW =
  /^(?<name>[^\d]*[A-Za-z][^\d]*?)\s*(?:(?<sets>\d{1,3}(?:\.\d{1,2})?)(?!\d)(?!\s*(?:-|–|to)\s*\d)\s*(?<worded>sets?\b)?)?(?:\s*[x·•|]\s*|\s*[-–]\s*|\s+[.,:~]\s+|\s*)(?:(?<weight>\d{1,4}(?:\.\d{1,2})?)\s*(?:lbs?)?\s*x\s*(?<weightReps>\d{1,3}(?:\.\d{1,2})?)|(?<low>\d{1,3}(?:\.\d{1,2})?)\s*(?:-|–|to)\s*(?<high>\d{1,3}(?:\.\d{1,2})?)\s*(?:reps?\b)?|(?<count>\d{1,3}(?:\.\d{1,2})?)\s*reps?\b)?\s*$/i;

/** Undoes the OCR glitches that show up on Boostcamp cards. */
export function normalizeLine(line: string): string {
  return line
    .replace(/[×✕*]/g, 'x')
    .replace(/(\d)\s*1\s?\|\s?b/gi, '$1 lb')
    .replace(/(\d)\s*[1Il|]\s?b/gi, '$1 lb')
    .replace(/\s(?:lb|1b|Ib|l|1)?bx\b/gi, ' lb x')
    .replace(/lbx/gi, 'lb x')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The most sets or reps a copy can be given. A card writes either figure in two
 * digits, and three of them is a read error rather than a workout. The grammar reads
 * a wider number than this on purpose, so the row is still found and the figure is
 * asked for, instead of the movement going missing with it.
 */
const MOST = 99;

const REPS = /^(?<low>\d{1,2})(?:\s*(?:-|–|to)\s*(?<high>\d{1,2}))?$/i;

/**
 * A rep count or a rep range as a template stores it, or null when the text is
 * neither. A range is two whole numbers from 1 to MOST, low first; a count is one of
 * them. Spacing, an en dash and the word "to" all come out of OCR on the same card,
 * so each reads as the same range and is written back as "3-12".
 *
 * One rule for both ways a value arrives: read off the card, or typed by the person
 * on the review screen. A reading it refuses is a value nobody has given yet.
 */
export function readReps(text: string): string | null {
  const found = text.trim().match(REPS)?.groups;
  if (!found) return null;
  const low = Number(found.low);
  if (low < 1) return null;
  if (found.high === undefined) return String(low);
  const high = Number(found.high);
  return high > low ? `${low}-${high}` : null;
}

/**
 * A set count a copy can be given, or null for anything else: a zero, a hundred, a
 * fraction, a value the card never named. The companion to readReps, and the same
 * rule for a value read off the card and one typed on the review screen.
 */
export function readSets(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const count = Number(trimmed);
  return Number.isInteger(count) && count >= 1 && count <= MOST ? count : null;
}

/**
 * True when Boostcamp cut the name off to fit the card, so the rest of it is not
 * in the photo: it ends in an ellipsis, or it opens a bracket it never closes.
 */
export function isCutOffName(name: string): boolean {
  const text = name.trim();
  return /(…|\.\.\.)$/.test(text) || (text.includes('(') && !text.includes(')'));
}

export function parseCard(rawLines: string[]): ParsedCard {
  const lines = rawLines.map(normalizeLine).filter((line) => line.length > 0);
  const card: ParsedCard = {
    format: null,
    title: null,
    subtitle: null,
    date: null,
    weekDay: null,
    rows: [],
    durationMin: null,
    volumeLb: null,
    totalSets: null,
  };

  const headerAt = lines.findIndex((line) => /EXERCISE/i.test(line));
  const body = lines.slice(headerAt + 1);
  let firstRowAt = lines.length;
  body.forEach((line, index) => {
    const row = parseRow(line, card.rows.length);
    if (!row) return;
    if (card.rows.length === 0) firstRowAt = headerAt + 1 + index;
    card.rows.push(row);
  });

  const footer = body.find((line) => /\d\s*m\b/.test(line) && /lb/i.test(line));
  if (footer) {
    card.durationMin = numberIn(footer, /(\d{1,3})\s*m\b/);
    card.volumeLb = numberIn(footer, /(\d{1,2},\d{3}|\d{3,5})\s*lb/i);
    card.totalSets = numberIn(footer, /(\d{1,3})\s*$/);
  }

  const dateAt = lines.findIndex((line) => DATE_LINE.test(line) || WEEK_LINE.test(line));
  const dated = dateAt >= 0 ? isoDate(lines[dateAt].match(DATE_LINE)?.groups) : null;

  // A finished workout card is the one carrying what only a finished workout has:
  // the table header, the duration and volume footer, a date, or a weight on a row.
  // A card with movements and none of those is a plan card.
  const plan =
    card.rows.length > 0 &&
    !(headerAt >= 0 || footer || dated || card.rows.some((row) => row.weightLb !== null));
  card.format = card.rows.length === 0 ? null : plan ? 'plan' : 'workout';

  if (plan) {
    const match = lines
      .slice(0, firstRowAt)
      .find((line) => WEEK_LINE.test(line))
      ?.match(WEEK_LINE)?.groups;
    card.weekDay = match ? `Week ${match.week} · Day ${match.day}` : null;
    // The title and the program are the last two lines above the movements, once the
    // week-and-day line, the progress bar and the app's own text are out of the way.
    const header = lines
      .slice(0, firstRowAt)
      .filter((line) => !WEEK_LINE.test(line) && !PROGRESS_LINE.test(line) && !APP_TEXT.test(line))
      .slice(-2)
      .map(dropIconNoise);
    card.title = header[0] ?? null;
    card.subtitle = header[1] ?? null;
  } else if (dateAt >= 0) {
    card.date = dated;
    card.subtitle = lines[dateAt].replace(DATE_LINE, '').trim() || null;
    card.title =
      lines
        .slice(0, dateAt)
        .reverse()
        .find((text) => !APP_TEXT.test(text)) ?? null;
  }

  return card;
}

/**
 * Problems with a card's movements and sets. None of them block a read; the review screen
 * shows them. A missing date is not a problem: a copied workout has none.
 */
export function cardWarnings(card: ParsedCard): string[] {
  const warnings: string[] = [];
  if (card.rows.length === 0) {
    warnings.push(
      'No workout found in this photo. Embr reads two Boostcamp cards: the summary after you finish a workout, and the “Next up” card on the program screen.'
    );
  }
  const sets = card.rows.reduce((sum, row) => sum + (readSets(row.sets) ?? 0), 0);
  if (card.totalSets !== null && sets !== card.totalSets) {
    warnings.push(`The movements add up to ${sets} sets, but the card says ${card.totalSets}.`);
  }
  return warnings;
}

function parseRow(line: string, index: number): ParsedRow | null {
  if (APP_TEXT.test(line) || DATE_LINE.test(line) || WEEK_LINE.test(line)) return null;
  const groups = line.match(ROW)?.groups;
  if (!groups) return null;

  const counted = groups.weightReps ?? (groups.low ? `${groups.low}-${groups.high}` : groups.count);
  // A bare set count on its own is any number at all; only a worded one is a row.
  if (counted === undefined && (groups.sets === undefined || groups.worded === undefined)) {
    return null;
  }
  // A figure the card named but a copy cannot use ("0 sets", "2.5", "10 reps" read as
  // "1 0 reps") is left missing, the same as one the card never named. The movement
  // keeps its row either way, and the review screen asks for the value.
  const sets = groups.sets === undefined ? null : readSets(groups.sets);
  const reps = counted === undefined ? null : readReps(counted);

  return {
    id: `r${index}`,
    name: capitalize(groups.name.trim().replace(/\s+[-–·•|x]$/i, '')),
    sets: sets === null ? '' : String(sets),
    weightLb: groups.weight === undefined ? null : Number(groups.weight),
    reps: reps ?? '',
  };
}

/**
 * The values a copy is built from that this row does not have. One rule, used by the
 * review screen to flag the field, to count what still needs checking, and to hold the
 * copy back: a movement is never copied on a value nobody read.
 */
export function missingValues(row: ParsedRow): ('sets' | 'reps')[] {
  const missing: ('sets' | 'reps')[] = [];
  if (readSets(row.sets) === null) missing.push('sets');
  if (readReps(row.reps) === null) missing.push('reps');
  return missing;
}

/**
 * A plan card's icon tile sits to the left of the title and the program, and OCR
 * reads its artwork as a few short tokens in front of the text. Drops a leading run
 * of tokens no longer than three characters, and only while a longer word follows,
 * so a short title ("DB Day A") is left alone.
 */
function dropIconNoise(line: string): string {
  const words = line.split(' ');
  let at = 0;
  while (
    at < words.length &&
    words[at].length <= 3 &&
    words.slice(at + 1).some((word) => word.length > 3)
  ) {
    at++;
  }
  return words.slice(at).join(' ');
}

function isoDate(groups: Record<string, string> | undefined): string | null {
  if (!groups) return null;
  const month = MONTHS.indexOf(groups.mon.toLowerCase()) + 1;
  if (month === 0) return null;
  return `${groups.year}-${String(month).padStart(2, '0')}-${groups.day.padStart(2, '0')}`;
}

function numberIn(text: string, pattern: RegExp): number | null {
  const found = text.match(pattern)?.[1];
  return found === undefined ? null : Number(found.replace(/,/g, ''));
}

// OCR reads a capital I as a lowercase i ("incline"). Every movement name on a
// card starts with a capital, so the first letter can always be fixed.
const capitalize = (text: string): string => text.replace(/^[a-z]/, (c) => c.toUpperCase());
