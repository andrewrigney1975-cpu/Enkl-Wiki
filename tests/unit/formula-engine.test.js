import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDisplayGrid, formatNumber, errorCodeToDisplay } from '../../src/advtable/formula-engine.js';
import { createModel, setRawCell } from '../../src/advtable/advtable-model.js';

function displayAt(model, row, col) {
  return computeDisplayGrid(model)[row][col].display;
}

test('a plain number literal displays as-is and is flagged numeric', () => {
  const model = createModel(2, 2);
  setRawCell(model, 0, 0, '42');
  const cell = computeDisplayGrid(model)[0][0];
  assert.equal(cell.display, '42');
  assert.equal(cell.isNumeric, true);
  assert.equal(cell.isFormula, false);
  assert.equal(cell.isError, false);
});

test('plain text displays as-is and is not numeric', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, 'hello');
  const cell = computeDisplayGrid(model)[0][0];
  assert.equal(cell.display, 'hello');
  assert.equal(cell.isNumeric, false);
});

test('a formula wrapped cell is flagged isFormula', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1+1');
  assert.equal(computeDisplayGrid(model)[0][0].isFormula, true);
});

test('a leading "=" escaped with double quotes is treated as literal text, not a formula', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '"=5+3"');
  const cell = computeDisplayGrid(model)[0][0];
  assert.equal(cell.display, '=5+3');
  assert.equal(cell.isFormula, false);
  assert.equal(cell.isNumeric, false);
});

test('basic arithmetic: + - * / with correct precedence and parentheses', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1+2*3');
  assert.equal(displayAt(model, 0, 0), '7');
  setRawCell(model, 0, 0, '=(1+2)*3');
  assert.equal(displayAt(model, 0, 0), '9');
  setRawCell(model, 0, 0, '=10-4/2');
  assert.equal(displayAt(model, 0, 0), '8');
  setRawCell(model, 0, 0, '=-3+5');
  assert.equal(displayAt(model, 0, 0), '2');
});

test('a formula can reference other cells by A1-style ref', () => {
  const model = createModel(2, 2);
  setRawCell(model, 0, 0, '5'); // A1
  setRawCell(model, 0, 1, '10'); // B1
  setRawCell(model, 1, 0, '=A1+B1'); // A2
  assert.equal(displayAt(model, 1, 0), '15');
});

test('a formula chain resolves through multiple levels of indirection', () => {
  const model = createModel(3, 1);
  setRawCell(model, 0, 0, '2'); // A1
  setRawCell(model, 1, 0, '=A1*3'); // A2 = 6
  setRawCell(model, 2, 0, '=A2+1'); // A3 = 7
  assert.equal(displayAt(model, 2, 0), '7');
});

test('SUM/COUNT/AVERAGE over an Excel-style range', () => {
  const model = createModel(5, 1);
  setRawCell(model, 0, 0, '1');
  setRawCell(model, 1, 0, '2');
  setRawCell(model, 2, 0, '3');
  setRawCell(model, 3, 0, '4');
  setRawCell(model, 4, 0, '=SUM(A1:A4)');
  assert.equal(displayAt(model, 4, 0), '10');

  setRawCell(model, 4, 0, '=COUNT(A1:A4)');
  assert.equal(displayAt(model, 4, 0), '4');

  setRawCell(model, 4, 0, '=AVERAGE(A1:A4)');
  assert.equal(displayAt(model, 4, 0), '2.5');
});

test('a two-dimensional range (D3:E9-style) is fully expanded', () => {
  const model = createModel(3, 3);
  setRawCell(model, 0, 0, '1'); setRawCell(model, 0, 1, '2'); setRawCell(model, 0, 2, '3');
  setRawCell(model, 1, 0, '4'); setRawCell(model, 1, 1, '5'); setRawCell(model, 1, 2, '6');
  setRawCell(model, 2, 0, '=SUM(A1:C2)');
  assert.equal(displayAt(model, 2, 0), '21'); // 1+2+3+4+5+6
});

test('a range can be given in either corner order', () => {
  const model = createModel(3, 1);
  setRawCell(model, 0, 0, '1');
  setRawCell(model, 1, 0, '2');
  setRawCell(model, 2, 0, '=SUM(A2:A1)');
  assert.equal(displayAt(model, 2, 0), '3');
});

test('SUM/COUNT/AVERAGE ignore non-numeric cells within a range', () => {
  const model = createModel(4, 1);
  setRawCell(model, 0, 0, '1');
  setRawCell(model, 1, 0, 'text');
  setRawCell(model, 2, 0, '3');
  setRawCell(model, 3, 0, '=SUM(A1:A3)');
  assert.equal(displayAt(model, 3, 0), '4');
  setRawCell(model, 3, 0, '=COUNT(A1:A3)');
  assert.equal(displayAt(model, 3, 0), '2');
  setRawCell(model, 3, 0, '=AVERAGE(A1:A3)');
  assert.equal(displayAt(model, 3, 0), '2');
});

test('a function accepts mixed range and scalar arguments, Excel-style', () => {
  const model = createModel(3, 2);
  setRawCell(model, 0, 0, '1');
  setRawCell(model, 1, 0, '2');
  setRawCell(model, 2, 0, '3'); // B1 used as a scalar arg below
  setRawCell(model, 2, 1, '=SUM(A1:A2,A3,10)');
  assert.equal(displayAt(model, 2, 1), '16');
});

test('division by zero produces #DIV/0!', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1/0');
  const cell = computeDisplayGrid(model)[0][0];
  assert.equal(cell.display, '#DIV/0!');
  assert.equal(cell.isError, true);
});

test('AVERAGE of an all-empty/non-numeric range produces #DIV/0!', () => {
  const model = createModel(2, 1);
  setRawCell(model, 0, 0, '=AVERAGE(A2:A2)');
  const cell = computeDisplayGrid(model)[0][0];
  assert.equal(cell.display, '#DIV/0!');
});

test('a direct arithmetic reference to a text cell produces #VALUE!', () => {
  const model = createModel(2, 1);
  setRawCell(model, 0, 0, 'hello');
  setRawCell(model, 1, 0, '=A1+1');
  assert.equal(displayAt(model, 1, 0), '#VALUE!');
});

test('an unknown function name produces #NAME?', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=FOO(1,2)');
  assert.equal(displayAt(model, 0, 0), '#NAME?');
});

test('malformed formula syntax produces #ERROR!', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1+');
  assert.equal(displayAt(model, 0, 0), '#ERROR!');
});

test('a direct self-reference produces #REF! instead of hanging', () => {
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=A1');
  assert.equal(displayAt(model, 0, 0), '#REF!');
});

test('a circular reference through a chain of cells produces #REF!', () => {
  const model = createModel(3, 1);
  setRawCell(model, 0, 0, '=A2');
  setRawCell(model, 1, 0, '=A3');
  setRawCell(model, 2, 0, '=A1');
  const grid = computeDisplayGrid(model);
  assert.equal(grid[0][0].display, '#REF!');
  assert.equal(grid[1][0].display, '#REF!');
  assert.equal(grid[2][0].display, '#REF!');
});

test('an empty cell referenced in arithmetic behaves as 0', () => {
  const model = createModel(1, 2);
  setRawCell(model, 0, 1, '=A1+5');
  assert.equal(displayAt(model, 0, 1), '5');
});

test('formatNumber rounds away floating point noise', () => {
  assert.equal(formatNumber(0.1 + 0.2), '0.3');
});

test('errorCodeToDisplay falls back to #ERROR! for an unrecognized code', () => {
  assert.equal(errorCodeToDisplay('SOMETHING_UNKNOWN'), '#ERROR!');
});
