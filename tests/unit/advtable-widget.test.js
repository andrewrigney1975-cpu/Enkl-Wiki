import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { renderStaticHtml } from '../../src/advtable/advtable-render.js';
import { createModel, setRawCell } from '../../src/advtable/advtable-model.js';
import { hydrateAdvancedTables } from '../../src/advtable/advtable-widget.js';

function mountAdvTable(model) {
  const container = document.createElement('div');
  container.innerHTML = renderStaticHtml(model);
  document.body.appendChild(container);
  hydrateAdvancedTables(container);
  return container.querySelector('.ek-advtable');
}

function cellInput(wrapper, row, col) {
  // row/col are 0-based; +1 to skip the corner/gutter header column, +1 to
  // skip the header row (thead has 2 rows: letters + filter).
  return wrapper.querySelectorAll('tbody tr')[row].children[col + 1].querySelector('input');
}

test('hydrateAdvancedTables builds a toolbar and an A/B/C + 1/2/3 header grid', () => {
  setupDom();
  const wrapper = mountAdvTable(createModel(2, 3));
  assert.ok(wrapper.querySelector('.ek-advtable-toolbar'));
  const letterHeaders = [...wrapper.querySelectorAll('thead tr:first-child th')].map((th) => th.textContent);
  assert.deepEqual(letterHeaders, ['', 'A', 'B', 'C']);
  const rowGutters = [...wrapper.querySelectorAll('tbody th')].map((th) => th.textContent);
  assert.deepEqual(rowGutters, ['1', '2']);
  teardownDom();
});

test('hydrateAdvancedTables is idempotent — calling it again does not rebuild an already-hydrated block', () => {
  setupDom();
  const wrapper = mountAdvTable(createModel(1, 1));
  const toolbarBefore = wrapper.querySelector('.ek-advtable-toolbar');
  hydrateAdvancedTables(wrapper.parentElement);
  assert.equal(wrapper.querySelector('.ek-advtable-toolbar'), toolbarBefore);
  teardownDom();
});

test('focusing a cell shows its raw formula source; committing recomputes the display everywhere', () => {
  setupDom();
  const model = createModel(2, 2);
  setRawCell(model, 0, 0, '2');
  setRawCell(model, 0, 1, '3');
  setRawCell(model, 1, 0, '=A1+B1');
  const wrapper = mountAdvTable(model);

  const sumInput = cellInput(wrapper, 1, 0);
  assert.equal(sumInput.value, '5', 'blurred cell shows its computed value');

  sumInput.dispatchEvent(new window.Event('focus'));
  assert.equal(sumInput.value, '=A1+B1', 'focusing swaps to the raw formula source');

  const a1Input = cellInput(wrapper, 0, 0);
  a1Input.dispatchEvent(new window.Event('focus'));
  a1Input.value = '10';
  a1Input.dispatchEvent(new window.Event('blur'));

  const newSumInput = cellInput(wrapper, 1, 0);
  assert.equal(newSumInput.value, '13', 'the formula recomputes after its dependency changes');

  teardownDom();
});

test('the formula bar mirrors the focused cell and can commit an edit itself', () => {
  setupDom();
  const model = createModel(1, 2);
  setRawCell(model, 0, 0, '7');
  const wrapper = mountAdvTable(model);
  const formulaInput = wrapper.querySelector('.ek-advtable-formula-input');

  const a1Input = cellInput(wrapper, 0, 0);
  a1Input.dispatchEvent(new window.Event('focus'));
  assert.equal(formulaInput.value, '7');

  formulaInput.value = '=1+1';
  formulaInput.dispatchEvent(new window.Event('blur'));

  assert.equal(cellInput(wrapper, 0, 0).value, '2');
  teardownDom();
});

test('an Enter keypress in a cell commits the value and moves focus down a row', () => {
  setupDom();
  const wrapper = mountAdvTable(createModel(2, 1));
  const a1 = cellInput(wrapper, 0, 0);
  a1.dispatchEvent(new window.Event('focus'));
  a1.value = '9';
  a1.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

  assert.equal(cellInput(wrapper, 0, 0).value, '9', 'the edited cell kept its committed value');
  assert.equal(document.activeElement, cellInput(wrapper, 1, 0), 'focus moved to the cell below');
  teardownDom();
});

test('clicking SUM/COUNT/AVERAGE inserts the function template into the active cell', () => {
  setupDom();
  const wrapper = mountAdvTable(createModel(2, 1));
  const a1 = cellInput(wrapper, 0, 0);
  a1.dispatchEvent(new window.Event('focus'));

  const sumBtn = [...wrapper.querySelectorAll('.ek-advtable-btn')].find((b) => b.textContent === 'SUM');
  sumBtn.click();

  assert.equal(cellInput(wrapper, 0, 0).value, '=SUM()');
  assert.equal(wrapper.querySelector('.ek-advtable-formula-input').value, '=SUM()');
  teardownDom();
});

test('Add Row and Add Column grow the grid and preserve existing values', () => {
  setupDom();
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '5');
  const wrapper = mountAdvTable(model);

  const addRowBtn = [...wrapper.querySelectorAll('.ek-advtable-btn')].find((b) => b.title === 'Add a row');
  const addColBtn = [...wrapper.querySelectorAll('.ek-advtable-btn')].find((b) => b.title === 'Add a column');
  addRowBtn.click();
  addColBtn.click();

  assert.equal(wrapper.querySelectorAll('tbody tr').length, 2);
  assert.equal(wrapper.querySelectorAll('thead tr:first-child th').length, 3); // corner + A + B
  assert.equal(cellInput(wrapper, 0, 0).value, '5', 'existing value survives a grid resize');
  teardownDom();
});

test('the filter toggle shows/hides the filter row, and a text filter hides non-matching rows', () => {
  setupDom();
  const model = createModel(3, 1);
  setRawCell(model, 0, 0, 'Apple');
  setRawCell(model, 1, 0, 'Banana');
  setRawCell(model, 2, 0, 'Grape');
  const wrapper = mountAdvTable(model);

  const filterRow = wrapper.querySelector('.ek-advtable-filter-row');
  assert.ok(filterRow.classList.contains('ek-hidden'));

  const toggleBtn = wrapper.querySelector('.ek-advtable-filter-toggle-btn');
  toggleBtn.click();
  assert.ok(!wrapper.querySelector('.ek-advtable-filter-row').classList.contains('ek-hidden'));

  const filterInput = wrapper.querySelector('.ek-advtable-filter-row input[type="text"]');
  filterInput.value = 'ap';
  filterInput.dispatchEvent(new window.Event('input'));

  const visibleRows = [...wrapper.querySelectorAll('tbody tr')].filter((tr) => tr.style.display !== 'none');
  assert.equal(visibleRows.length, 2); // Apple, Grape

  teardownDom();
});

test('clearing filters resets visibility and hides the clear button again', () => {
  setupDom();
  const model = createModel(2, 1);
  setRawCell(model, 0, 0, 'Apple');
  setRawCell(model, 1, 0, 'Banana');
  const wrapper = mountAdvTable(model);
  wrapper.querySelector('.ek-advtable-filter-toggle-btn').click();

  const filterInput = wrapper.querySelector('.ek-advtable-filter-row input[type="text"]');
  filterInput.value = 'apple';
  filterInput.dispatchEvent(new window.Event('input'));
  assert.ok(!wrapper.querySelector('.ek-advtable-clear-filters-btn').classList.contains('ek-hidden'));

  wrapper.querySelector('.ek-advtable-clear-filters-btn').click();
  const visibleRows = [...wrapper.querySelectorAll('tbody tr')].filter((tr) => tr.style.display !== 'none');
  assert.equal(visibleRows.length, 2);
  assert.ok(wrapper.querySelector('.ek-advtable-clear-filters-btn').classList.contains('ek-hidden'));

  teardownDom();
});

test('exporting a sheet as CSV downloads the computed grid with column letters as headers', () => {
  setupDom();
  const model = createModel(1, 2);
  setRawCell(model, 0, 0, '1');
  setRawCell(model, 0, 1, '=A1+1');
  const wrapper = mountAdvTable(model);

  let downloadedName = null;
  let downloadedBlob = null;
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = (blob) => { downloadedBlob = blob; return 'blob:mock'; };
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  wrapper.querySelector('.ek-advtable-export-btn').click();

  assert.equal(downloadedName, 'sheet.csv');
  assert.equal(downloadedBlob.type, 'text/csv;charset=utf-8');

  URL.createObjectURL = originalCreateObjectURL;
  teardownDom();
});

test('hydrateAdvancedTables numbers CSV filenames when multiple sheets are on the same page', () => {
  setupDom();
  const container = document.createElement('div');
  container.innerHTML = renderStaticHtml(createModel(1, 1)) + renderStaticHtml(createModel(1, 1));
  document.body.appendChild(container);
  hydrateAdvancedTables(container, { filenameHint: 'my-page' });

  const wrappers = [...container.querySelectorAll('.ek-advtable')];
  assert.equal(wrappers.length, 2);

  let downloadedName = null;
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = () => 'blob:mock';
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  wrappers[1].querySelector('.ek-advtable-export-btn').click();
  assert.equal(downloadedName, 'my-page-2.csv');

  URL.createObjectURL = originalCreateObjectURL;
  teardownDom();
});

test('an error-producing formula displays its error code and gets the error styling class', () => {
  setupDom();
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1/0');
  const wrapper = mountAdvTable(model);
  const input = cellInput(wrapper, 0, 0);
  assert.equal(input.value, '#DIV/0!');
  assert.ok(input.classList.contains('ek-advtable-error'));
  teardownDom();
});
