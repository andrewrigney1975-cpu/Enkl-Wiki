// Formula tokenizer/parser/evaluator for the advanced table. Supports the
// spec's "basic formulas": + - * / between numbers, cell refs and
// parenthesized sub-expressions, plus SUM/COUNT/AVERAGE over Excel-style
// ranges (A1:A5) or comma-separated scalar/range arguments (mirrors Excel's
// own SUM(A1:A5, B2, 3) mixed-argument behavior).
//
// Evaluation is recursive with a memo cache and an "in progress" set per
// computeDisplayGrid() call, so a formula that (directly or indirectly)
// refers back to its own cell is caught as a circular reference (#REF!)
// instead of recursing forever.
import { getRawCell, classifyRaw, cellRefToRowCol } from './advtable-model.js';

export class CellError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const ERROR_DISPLAY = {
  DIV0: '#DIV/0!',
  REF: '#REF!',
  NAME: '#NAME?',
  VALUE: '#VALUE!',
  PARSE: '#ERROR!'
};

export function errorCodeToDisplay(code) {
  return ERROR_DISPLAY[code] || '#ERROR!';
}

// Rounds away binary floating-point noise (e.g. 0.1 + 0.2) without
// truncating legitimate precision, then lets Number->String drop trailing
// zeros the same way plain number literals already display.
export function formatNumber(n) {
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }

    if (/[0-9]/.test(ch)) {
      const m = /^\d+(\.\d+)?/.exec(source.slice(i));
      tokens.push({ type: 'NUM', value: Number(m[0]) });
      i += m[0].length;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      const cellMatch = /^[A-Za-z]+\d+/.exec(source.slice(i));
      if (cellMatch) {
        tokens.push({ type: 'CELL', value: cellMatch[0].toUpperCase() });
        i += cellMatch[0].length;
        continue;
      }
      const identMatch = /^[A-Za-z]+/.exec(source.slice(i));
      tokens.push({ type: 'IDENT', value: identMatch[0].toUpperCase() });
      i += identMatch[0].length;
      continue;
    }

    if ('+-*/(),:'.includes(ch)) {
      tokens.push({ type: ch });
      i++;
      continue;
    }

    throw new CellError('PARSE');
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// expr := term (('+'|'-') term)*
// term := unary (('*'|'/') unary)*
// unary := '-' unary | primary
// primary := NUM | CELL | '(' expr ')' | IDENT '(' arg (',' arg)* ')'
// arg := CELL ':' CELL (a range) | expr
function parseFormula(source) {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function expect(type) {
    if (peek().type !== type) throw new CellError('PARSE');
    return next();
  }

  function parseExpr() {
    let node = parseTerm();
    while (peek().type === '+' || peek().type === '-') {
      const op = next().type;
      node = { type: 'binop', op, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek().type === '*' || peek().type === '/') {
      const op = next().type;
      node = { type: 'binop', op, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek().type === '-') {
      next();
      return { type: 'neg', value: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (tok.type === 'NUM') { next(); return { type: 'num', value: tok.value }; }
    if (tok.type === 'CELL') { next(); return { type: 'cell', ref: tok.value }; }
    if (tok.type === '(') {
      next();
      const node = parseExpr();
      expect(')');
      return node;
    }
    if (tok.type === 'IDENT') {
      next();
      expect('(');
      const args = [];
      if (peek().type !== ')') {
        args.push(parseArg());
        while (peek().type === ',') {
          next();
          args.push(parseArg());
        }
      }
      expect(')');
      return { type: 'call', name: tok.value, args };
    }
    throw new CellError('PARSE');
  }

  function parseArg() {
    if (peek().type === 'CELL' && tokens[pos + 1] && tokens[pos + 1].type === ':') {
      const from = next().value;
      next(); // ':'
      const to = expect('CELL').value;
      return { type: 'range', from, to };
    }
    return parseExpr();
  }

  const result = parseExpr();
  expect('EOF');
  return result;
}

// Resolves one cell to { kind: 'empty'|'number'|'text', value }, evaluating
// its formula (recursively, through further cell refs) if it has one.
// Results are memoized per computeDisplayGrid() call; `evaluating` guards
// against a formula that refers back to itself, directly or through a
// chain of other formula cells.
function resolveCellValue(model, row, col, memo, evaluating) {
  const key = `${row},${col}`;
  if (memo.has(key)) {
    const cached = memo.get(key);
    if (cached.error) throw new CellError(cached.error);
    return cached;
  }
  if (evaluating.has(key)) throw new CellError('REF');

  const info = classifyRaw(getRawCell(model, row, col));
  if (info.kind === 'empty') return { kind: 'empty', value: 0 };
  if (info.kind === 'number') return { kind: 'number', value: info.value };
  if (info.kind === 'text') return { kind: 'text', value: info.value };

  evaluating.add(key);
  try {
    const ast = parseFormula(info.source);
    const value = evaluateAst(ast, { model, memo, evaluating });
    const result = { kind: 'number', value };
    memo.set(key, result);
    return result;
  } catch (err) {
    const code = err instanceof CellError ? err.code : 'PARSE';
    memo.set(key, { error: code });
    throw err instanceof CellError ? err : new CellError('PARSE');
  } finally {
    evaluating.delete(key);
  }
}

function cellNumericValue(ref, ctx) {
  const rc = cellRefToRowCol(ref);
  if (!rc) throw new CellError('REF');
  const resolved = resolveCellValue(ctx.model, rc.row, rc.col, ctx.memo, ctx.evaluating);
  if (resolved.kind === 'text') throw new CellError('VALUE');
  return resolved.value;
}

function evaluateAst(node, ctx) {
  switch (node.type) {
    case 'num': return node.value;
    case 'cell': return cellNumericValue(node.ref, ctx);
    case 'neg': return -evaluateAst(node.value, ctx);
    case 'binop': {
      const l = evaluateAst(node.left, ctx);
      const r = evaluateAst(node.right, ctx);
      if (node.op === '+') return l + r;
      if (node.op === '-') return l - r;
      if (node.op === '*') return l * r;
      if (r === 0) throw new CellError('DIV0');
      return l / r;
    }
    case 'call': return evaluateCall(node, ctx);
    default: throw new CellError('PARSE');
  }
}

// Ranges expand to every cell's *resolved* value (kind + value) rather than
// a bare number, so SUM/COUNT/AVERAGE can tell numeric cells apart from
// text/empty ones the same way Excel's own aggregate functions do (ignoring
// non-numeric cells rather than erroring on them).
function collectArgValues(node, ctx) {
  if (node.type === 'range') {
    const from = cellRefToRowCol(node.from);
    const to = cellRefToRowCol(node.to);
    if (!from || !to) throw new CellError('REF');
    const r0 = Math.min(from.row, to.row);
    const r1 = Math.max(from.row, to.row);
    const c0 = Math.min(from.col, to.col);
    const c1 = Math.max(from.col, to.col);
    const values = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        values.push(resolveCellValue(ctx.model, r, c, ctx.memo, ctx.evaluating));
      }
    }
    return values;
  }
  return [{ kind: 'number', value: evaluateAst(node, ctx) }];
}

function evaluateCall(node, ctx) {
  const name = node.name;
  const allValues = node.args.flatMap((arg) => collectArgValues(arg, ctx));
  const numeric = allValues.filter((v) => v.kind === 'number').map((v) => v.value);

  if (name === 'SUM') return numeric.reduce((a, b) => a + b, 0);
  if (name === 'COUNT') return numeric.length;
  if (name === 'AVERAGE') {
    if (!numeric.length) throw new CellError('DIV0');
    return numeric.reduce((a, b) => a + b, 0) / numeric.length;
  }
  throw new CellError('NAME');
}

// Computes every cell's display value for the whole grid: { raw, display,
// isFormula, isError, isNumeric }. Used both for the initial static render
// (advtable-render.js) and to refresh the interactive widget after an edit.
export function computeDisplayGrid(model) {
  const memo = new Map();
  const evaluating = new Set();
  const grid = [];

  for (let r = 0; r < model.rows; r++) {
    const row = [];
    for (let c = 0; c < model.cols; c++) {
      const raw = getRawCell(model, r, c);
      const info = classifyRaw(raw);
      let display = '';
      let isError = false;
      let isNumeric = false;
      let isFormula = info.kind === 'formula';

      if (info.kind === 'empty') {
        display = '';
      } else if (info.kind === 'text') {
        display = info.value;
      } else if (info.kind === 'number') {
        display = formatNumber(info.value);
        isNumeric = true;
      } else {
        try {
          const resolved = resolveCellValue(model, r, c, memo, evaluating);
          if (resolved.kind === 'text') {
            display = resolved.value;
          } else {
            display = formatNumber(resolved.value);
            isNumeric = true;
          }
        } catch (err) {
          display = errorCodeToDisplay(err instanceof CellError ? err.code : 'PARSE');
          isError = true;
        }
      }

      row.push({ raw, display, isFormula, isError, isNumeric });
    }
    grid.push(row);
  }

  return grid;
}
