import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colIndexToLabel, colLabelToIndex, cellRefToRowCol, rowColToCellRef,
  createModel, getRawCell, setRawCell, addRow, addColumn,
  serializeModel, deserializeModel, classifyRaw, MAX_ROWS, MAX_COLS
} from '../../src/advtable/advtable-model.js';

test('colIndexToLabel produces A, B, ... Z, AA, AB, ... AZ, BA', () => {
  assert.equal(colIndexToLabel(0), 'A');
  assert.equal(colIndexToLabel(25), 'Z');
  assert.equal(colIndexToLabel(26), 'AA');
  assert.equal(colIndexToLabel(27), 'AB');
  assert.equal(colIndexToLabel(51), 'AZ');
  assert.equal(colIndexToLabel(52), 'BA');
});

test('colLabelToIndex is the inverse of colIndexToLabel', () => {
  for (const i of [0, 1, 25, 26, 27, 51, 52, 700]) {
    assert.equal(colLabelToIndex(colIndexToLabel(i)), i);
  }
  assert.equal(colLabelToIndex('a'), 0, 'lowercase labels are accepted');
});

test('cellRefToRowCol parses A1-style refs (0-based row/col)', () => {
  assert.deepEqual(cellRefToRowCol('A1'), { row: 0, col: 0 });
  assert.deepEqual(cellRefToRowCol('D3'), { row: 2, col: 3 });
  assert.deepEqual(cellRefToRowCol('AA10'), { row: 9, col: 26 });
});

test('cellRefToRowCol returns null for malformed refs', () => {
  assert.equal(cellRefToRowCol('A0'), null, 'rows are 1-based, so A0 is invalid');
  assert.equal(cellRefToRowCol('1A'), null);
  assert.equal(cellRefToRowCol(''), null);
  assert.equal(cellRefToRowCol('A'), null);
});

test('rowColToCellRef is the inverse of cellRefToRowCol', () => {
  assert.equal(rowColToCellRef(0, 0), 'A1');
  assert.equal(rowColToCellRef(2, 3), 'D3');
  assert.equal(rowColToCellRef(9, 26), 'AA10');
});

test('createModel clamps rows/cols to at least 1 and at most the max caps', () => {
  const model = createModel(0, -5);
  assert.equal(model.rows, 1);
  assert.equal(model.cols, 1);
  const huge = createModel(MAX_ROWS + 100, MAX_COLS + 100);
  assert.equal(huge.rows, MAX_ROWS);
  assert.equal(huge.cols, MAX_COLS);
});

test('getRawCell/setRawCell round-trip, and clearing to empty removes the sparse entry', () => {
  const model = createModel(2, 2);
  assert.equal(getRawCell(model, 0, 0), '');
  setRawCell(model, 0, 0, '=1+1');
  assert.equal(getRawCell(model, 0, 0), '=1+1');
  assert.equal(Object.keys(model.cells).length, 1);
  setRawCell(model, 0, 0, '');
  assert.equal(getRawCell(model, 0, 0), '');
  assert.equal(Object.keys(model.cells).length, 0, 'clearing a cell should remove its sparse entry');
});

test('addRow/addColumn increment the grid size, bounded by the max caps', () => {
  const model = createModel(1, 1);
  addRow(model);
  addColumn(model);
  assert.equal(model.rows, 2);
  assert.equal(model.cols, 2);

  const atCap = createModel(MAX_ROWS, MAX_COLS);
  addRow(atCap);
  addColumn(atCap);
  assert.equal(atCap.rows, MAX_ROWS);
  assert.equal(atCap.cols, MAX_COLS);
});

test('classifyRaw distinguishes empty, number, text, quote-escaped text and formula', () => {
  assert.deepEqual(classifyRaw(''), { kind: 'empty' });
  assert.deepEqual(classifyRaw('42'), { kind: 'number', value: 42 });
  assert.deepEqual(classifyRaw('-3.5'), { kind: 'number', value: -3.5 });
  assert.deepEqual(classifyRaw('hello'), { kind: 'text', value: 'hello' });
  assert.deepEqual(classifyRaw('"=5"'), { kind: 'text', value: '=5' });
  assert.deepEqual(classifyRaw('=SUM(A1:A2)'), { kind: 'formula', source: 'SUM(A1:A2)' });
});

test('serializeModel/deserializeModel round-trip rows, cols and cells', () => {
  const model = createModel(3, 4);
  setRawCell(model, 0, 0, '=SUM(A1:A2)');
  setRawCell(model, 1, 2, 'hello');
  const json = serializeModel(model);
  const restored = deserializeModel(json);
  assert.equal(restored.rows, 3);
  assert.equal(restored.cols, 4);
  assert.equal(getRawCell(restored, 0, 0), '=SUM(A1:A2)');
  assert.equal(getRawCell(restored, 1, 2), 'hello');
});

test('deserializeModel falls back to a blank default model on malformed JSON', () => {
  const restored = deserializeModel('{ not valid json');
  assert.ok(restored.rows >= 1 && restored.cols >= 1);
  assert.deepEqual(restored.cells, {});
});

test('deserializeModel ignores non-string cell values and clamps rows/cols', () => {
  const restored = deserializeModel(JSON.stringify({ rows: 0, cols: -1, cells: { 'A1': 5, 'B2': 'ok' } }));
  assert.equal(restored.rows, 1);
  assert.equal(restored.cols, 1);
  assert.equal(restored.cells['A1'], undefined, 'non-string values should be dropped');
  assert.equal(restored.cells['B2'], 'ok');
});
