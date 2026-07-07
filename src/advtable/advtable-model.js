// Data model for the "advanced table" (spreadsheet) block: Excel-style
// column letters (A, B, C, ... Z, AA, AB, ...) and 1-based row numbers, a
// sparse map of raw cell source keyed by "A1"-style refs, and the escaping
// rule that lets a cell's literal text start with "=" without being read as
// a formula. Pure data/logic only — no DOM, no formula evaluation (that's
// formula-engine.js, which imports from here, not the other way around).

export const DEFAULT_ROWS = 6;
export const DEFAULT_COLS = 5;
// Generous but bounded, so a corrupt/malicious payload (e.g. a hand-edited
// export file) can't make computeDisplayGrid() try to build a
// billion-cell grid.
export const MAX_ROWS = 500;
export const MAX_COLS = 200;

export function colIndexToLabel(index) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function colLabelToIndex(label) {
  let n = 0;
  for (const ch of String(label).toUpperCase()) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) return -1;
    n = n * 26 + code;
  }
  return n - 1;
}

const CELL_REF_RE = /^([A-Za-z]+)(\d+)$/;

// Returns { row, col } (0-based) or null if `ref` isn't a well-formed cell
// reference (e.g. "A0", "1A", "").
export function cellRefToRowCol(ref) {
  const m = CELL_REF_RE.exec(String(ref || '').trim());
  if (!m) return null;
  const row = Number(m[2]) - 1;
  const col = colLabelToIndex(m[1]);
  if (col < 0 || row < 0) return null;
  return { row, col };
}

export function rowColToCellRef(row, col) {
  return `${colIndexToLabel(col)}${row + 1}`;
}

// Cells are keyed by their "A1"-style ref (not a "row,col" pair), since this
// is the same object that gets serialized verbatim into the page's Markdown
// — a human reading/hand-editing that JSON in raw mode should see familiar
// spreadsheet references, not internal row/col indices.
function cellKey(row, col) {
  return rowColToCellRef(row, col);
}

export function createModel(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return { rows: clampRows(rows), cols: clampCols(cols), cells: {} };
}

function clampRows(n) {
  return Math.min(MAX_ROWS, Math.max(1, Math.trunc(Number(n)) || 1));
}

function clampCols(n) {
  return Math.min(MAX_COLS, Math.max(1, Math.trunc(Number(n)) || 1));
}

export function getRawCell(model, row, col) {
  return model.cells[cellKey(row, col)] ?? '';
}

// Empty strings are deleted from the sparse map rather than stored, so a
// cleared cell doesn't linger in the serialized payload.
export function setRawCell(model, row, col, value) {
  const key = cellKey(row, col);
  const str = String(value ?? '');
  if (str === '') delete model.cells[key];
  else model.cells[key] = str;
}

export function addRow(model) {
  model.rows = clampRows(model.rows + 1);
}

export function addColumn(model) {
  model.cols = clampCols(model.cols + 1);
}

// A cell's raw source classifies into exactly one of:
//  - empty: nothing entered
//  - number: the whole trimmed value is a plain number literal
//  - text: literal text, either because it never started with "=" or
//    because it was wrapped in "double quotes" to escape a leading "="
//  - formula: starts with "=" (and wasn't quote-escaped) — `source` is the
//    part after the "=", still unparsed.
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function classifyRaw(raw) {
  const trimmed = String(raw ?? '');
  if (trimmed === '') return { kind: 'empty' };
  if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
    return { kind: 'text', value: trimmed.slice(1, -1) };
  }
  if (trimmed[0] === '=') {
    return { kind: 'formula', source: trimmed.slice(1) };
  }
  if (NUMBER_RE.test(trimmed)) {
    return { kind: 'number', value: Number(trimmed) };
  }
  return { kind: 'text', value: trimmed };
}

export function serializeModel(model) {
  return JSON.stringify({ rows: model.rows, cols: model.cols, cells: model.cells });
}

// Defensive against hand-edited/corrupted payloads: falls back to a blank
// default-sized model rather than throwing, since a broken advanced table
// shouldn't take the whole page render down with it.
export function deserializeModel(json) {
  try {
    const data = JSON.parse(json);
    const rows = clampRows(data.rows);
    const cols = clampCols(data.cols);
    const cells = {};
    if (data.cells && typeof data.cells === 'object') {
      for (const [key, value] of Object.entries(data.cells)) {
        if (typeof value === 'string' && value !== '') cells[key] = value;
      }
    }
    return { rows, cols, cells };
  } catch {
    return createModel();
  }
}
