// =============================================================================
// Component size guard
// =============================================================================
// No component file over 400 lines.
//
// This is not a style preference dressed up as a test. Every one of the files
// this was written to break up had the same shape: a screen that had accreted
// six unrelated surfaces, its derived state, every handler, and a 400-line
// stylesheet, until the only way to find anything was search. Splitting them
// once fixes nothing if the next feature lands in the same file.
//
// The line is drawn at 400 because that is roughly the point past which a file
// stops fitting in a scroll-and-skim. A file that has to grow past it is
// usually telling you it holds more than one thing.
//
// If a file legitimately needs to be longer — one long JSX tree that genuinely
// has no seam — add it to ALLOWED with the reason. An exemption you can read
// is fine; a limit nobody enforces is not.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '../..');
const DIRS = ['app', 'src'];
const LIMIT = 400;

/** Files permitted to exceed the limit, each with the reason it has to. */
const ALLOWED: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('component size', () => {
  const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it('finds component files to check', () => {
    // Guards the guard: a walk that silently matches nothing would pass
    // forever while enforcing nothing.
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no component over 400 lines', () => {
    const oversized = files
      .map((file) => ({
        file: path.relative(ROOT, file),
        lines: fs.readFileSync(file, 'utf8').split('\n').length,
      }))
      .filter(({ file, lines }) => lines > LIMIT && !(file in ALLOWED))
      .map(({ file, lines }) => `${file} (${lines})`);

    expect(oversized).toEqual([]);
  });
});
