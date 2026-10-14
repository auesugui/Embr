// =============================================================================
// Card parser — reads a Boostcamp workout card from OCR lines
// =============================================================================
// A card is a title, a date line, a table of movements with each one's best set,
// and a footer with duration, volume and total sets. OCR returns those as lines of
// text, and this turns the lines into a ParsedCard.
//
// OCR gets some glyphs wrong on this layout: "lb" comes back as "1b", "lbx" or
// "|b", a stray "1" can land in front of the unit ("201lb" for 20 lb), and a
// capital I reads as "i". normalizeLine undoes those before anything is matched.
// Errors it cannot undo are caught by reading each photo twice (reconcile.ts).

export interface ParsedRow {
  /** Stable for the life of the reading, so the review screen can key rows that get edited. */
  id: string;
  name: string;
  /** Sets performed. The card shows only the best set, so this is a check, not data. */
  sets: number;
  /** Best-set weight in lb. Null for bodyweight movements, which show reps only. */
  weightLb: number | null;
  reps: number;
}

export interface ParsedCard {
  title: string | null;
  /** The line under the title without the date, such as "Workout A". */
  subtitle: string | null;
  /** YYYY-MM-DD, from the card's date line. */
  date: string | null;
  rows: ParsedRow[];
  durationMin: number | null;
  volumeLb: number | null;
  totalSets: number | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_LINE = /(?<mon>[A-Za-z]{3})[a-z]*\.?\s+(?<day>\d{1,2})[,.]?\s*(?<year>\d{4})/;
const WEEK_LINE = /Week\s*\d+\s*[-–·•.]\s*Day\s*\d+/i;
// The app's own text around the card: the status line, the PR sheet, the share row.
const APP_TEXT =
  /(Max|Estimated|1RM|BOOSTCAMP|DURATION|VOLUME|BEST SET|EXERCISE|Stories|Share|Save|Done|Solid one|workout in the books|Personal Records)/i;
const WEIGHT_ROW =
  /^(?<name>.+?)\s+(?<sets>\d{1,2})\s+(?<weight>\d+)\s*(?:lb\s*)?x\s*(?<reps>\d+)$/;
const REPS_ROW = /^(?<name>.+?)\s+(?<sets>\d{1,2})\s+(?<reps>\d+)\s*reps?$/i;

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

export function parseCard(rawLines: string[]): ParsedCard {
  const lines = rawLines.map(normalizeLine).filter((line) => line.length > 0);
  const card: ParsedCard = {
    title: null,
    subtitle: null,
    date: null,
    rows: [],
    durationMin: null,
    volumeLb: null,
    totalSets: null,
  };

  const dateAt = lines.findIndex((line) => DATE_LINE.test(line) || WEEK_LINE.test(line));
  if (dateAt >= 0) {
    const line = lines[dateAt];
    card.date = isoDate(line.match(DATE_LINE)?.groups);
    card.subtitle = line.replace(DATE_LINE, '').trim() || null;
    card.title =
      lines
        .slice(0, dateAt)
        .reverse()
        .find((text) => !APP_TEXT.test(text)) ?? null;
  }

  const headerAt = lines.findIndex((line) => /EXERCISE/i.test(line));
  const body = lines.slice(headerAt + 1);
  for (const line of body) {
    const groups = (line.match(WEIGHT_ROW) ?? line.match(REPS_ROW))?.groups;
    if (!groups) continue;
    card.rows.push({
      id: `r${card.rows.length}`,
      name: capitalize(groups.name.trim()),
      sets: Number(groups.sets),
      weightLb: groups.weight === undefined ? null : Number(groups.weight),
      reps: Number(groups.reps),
    });
  }

  const footer = body.find((line) => /\d\s*m\b/.test(line) && /lb/i.test(line));
  if (footer) {
    card.durationMin = numberIn(footer, /(\d{1,3})\s*m\b/);
    card.volumeLb = numberIn(footer, /(\d{1,2},\d{3}|\d{3,5})\s*lb/i);
    card.totalSets = numberIn(footer, /(\d{1,3})\s*$/);
  }
  return card;
}

/** Problems with a card on its own. None of them block a read; the review screen shows them. */
export function cardWarnings(card: ParsedCard): string[] {
  const warnings: string[] = [];
  if (!card.date) warnings.push('No date found on this card.');
  if (card.rows.length === 0) warnings.push('No movements found on this card.');
  const sets = card.rows.reduce((sum, row) => sum + row.sets, 0);
  if (card.totalSets !== null && sets !== card.totalSets) {
    warnings.push(`The movements add up to ${sets} sets, but the card says ${card.totalSets}.`);
  }
  return warnings;
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
