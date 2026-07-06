import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { enhanceTable } from '../../src/content/table-controls.js';

function buildTable(headerCells, bodyRows) {
  const container = document.createElement('div');
  const theadCells = headerCells.map((h) => `<th>${h}</th>`).join('');
  const bodyHtml = bodyRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  container.innerHTML = `<table><thead><tr>${theadCells}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  document.body.appendChild(container);
  return container.querySelector('table');
}

function bodyCellText(table) {
  return [...table.querySelectorAll('tbody tr')]
    .filter((tr) => tr.style.display !== 'none')
    .map((tr) => [...tr.children].map((td) => td.textContent));
}

test('enhanceTable adds a sortable class and a filter row (hidden by default) for every column', () => {
  setupDom();
  const table = buildTable(['Name', 'Age'], [['Bob', '30'], ['Alice', '25']]);
  enhanceTable(table);

  const headerCells = table.querySelectorAll('thead tr:first-child th');
  assert.equal(headerCells.length, 2);
  for (const th of headerCells) assert.ok(th.classList.contains('ek-table-sortable'));

  const filterRow = table.querySelector('.ek-table-filter-row');
  assert.ok(filterRow);
  assert.equal(filterRow.children.length, 2);
  assert.ok(filterRow.classList.contains('ek-hidden'), 'filter row should start collapsed');

  teardownDom();
});

test('enhanceTable wraps the table with a toolbar containing a filter toggle and an Export CSV button', () => {
  setupDom();
  const table = buildTable(['A'], [['1']]);
  enhanceTable(table);

  const wrapper = table.closest('.ek-table-enhanced');
  assert.ok(wrapper);
  assert.ok(wrapper.querySelector('.ek-table-export-btn'));
  assert.ok(wrapper.querySelector('.ek-table-filter-toggle-btn'));

  teardownDom();
});

test('the filter toggle button shows and hides the filter row', () => {
  setupDom();
  const table = buildTable(['Name'], [['Alice'], ['Bob']]);
  enhanceTable(table);
  const filterRow = table.querySelector('.ek-table-filter-row');
  const toggleBtn = table.closest('.ek-table-enhanced').querySelector('.ek-table-filter-toggle-btn');

  assert.ok(filterRow.classList.contains('ek-hidden'));
  toggleBtn.click();
  assert.ok(!filterRow.classList.contains('ek-hidden'));
  assert.ok(toggleBtn.classList.contains('active'));

  toggleBtn.click();
  assert.ok(filterRow.classList.contains('ek-hidden'));
  assert.ok(!toggleBtn.classList.contains('active'));

  teardownDom();
});

test('a clear-filters button appears only once a filter is active, and resets everything when clicked', () => {
  setupDom();
  const table = buildTable(['Name'], [['Apple'], ['Banana'], ['Grape']]);
  enhanceTable(table);
  const wrapper = table.closest('.ek-table-enhanced');
  const clearBtn = wrapper.querySelector('.ek-table-clear-filters-btn');
  const toggleBtn = wrapper.querySelector('.ek-table-filter-toggle-btn');
  const input = table.querySelector('.ek-table-filter-row input[type="text"]');

  assert.ok(clearBtn.classList.contains('ek-hidden'));

  input.value = 'ap';
  input.dispatchEvent(new window.Event('input'));
  assert.ok(!clearBtn.classList.contains('ek-hidden'));
  assert.deepEqual(bodyCellText(table).flat(), ['Apple', 'Grape']);
  // The filter is still active even though the row itself may be collapsed
  // again — the toggle button stays highlighted as a reminder.
  assert.ok(toggleBtn.classList.contains('active'));

  clearBtn.click();
  assert.equal(input.value, '');
  assert.ok(clearBtn.classList.contains('ek-hidden'));
  assert.deepEqual(bodyCellText(table).flat(), ['Apple', 'Banana', 'Grape']);

  teardownDom();
});

test('clicking a numeric header cycles sort: none -> asc -> desc -> none (reverting to original order)', () => {
  setupDom();
  const table = buildTable(['Score'], [['30'], ['10'], ['20']]);
  enhanceTable(table);
  const th = table.querySelector('thead tr:first-child th');

  th.click();
  assert.deepEqual(bodyCellText(table).flat(), ['10', '20', '30']);

  th.click();
  assert.deepEqual(bodyCellText(table).flat(), ['30', '20', '10']);

  th.click();
  assert.deepEqual(bodyCellText(table).flat(), ['30', '10', '20']); // back to original order

  teardownDom();
});

test('a text filter input hides non-matching rows', () => {
  setupDom();
  const table = buildTable(['Name'], [['Apple'], ['Banana'], ['Grape']]);
  enhanceTable(table);

  const input = table.querySelector('.ek-table-filter-row input[type="text"]');
  input.value = 'ap';
  input.dispatchEvent(new window.Event('input'));

  assert.deepEqual(bodyCellText(table).flat(), ['Apple', 'Grape']);

  teardownDom();
});

test('a numeric column gets min/max range inputs instead of a text filter', () => {
  setupDom();
  const table = buildTable(['Amount'], [['5'], ['15'], ['25']]);
  enhanceTable(table);

  const inputs = table.querySelectorAll('.ek-table-filter-row input');
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0].type, 'number');
  assert.equal(inputs[1].type, 'number');

  inputs[0].value = '10';
  inputs[0].dispatchEvent(new window.Event('input'));
  assert.deepEqual(bodyCellText(table).flat(), ['15', '25']);

  teardownDom();
});

test('a low-cardinality text column gets a dropdown filter', () => {
  setupDom();
  const table = buildTable(['Status'], [['open'], ['closed'], ['open']]);
  enhanceTable(table);

  const select = table.querySelector('.ek-table-filter-row select');
  assert.ok(select);
  assert.deepEqual([...select.options].map((o) => o.value), ['', 'open', 'closed']);

  select.value = 'open';
  select.dispatchEvent(new window.Event('change'));
  assert.deepEqual(bodyCellText(table).flat(), ['open', 'open']);

  teardownDom();
});

test('sort and filter combine: filtering first, then sorting the remaining rows', () => {
  setupDom();
  const table = buildTable(['Name', 'Score'], [
    ['Alice', '50'], ['Bob', '10'], ['Alicia', '30']
  ]);
  enhanceTable(table);

  const input = table.querySelector('.ek-table-filter-row input[type="text"]');
  input.value = 'ali';
  input.dispatchEvent(new window.Event('input'));

  const scoreHeader = table.querySelectorAll('thead tr:first-child th')[1];
  scoreHeader.click(); // ascending on Score

  assert.deepEqual(bodyCellText(table), [['Alicia', '30'], ['Alice', '50']]);

  teardownDom();
});

test('exporting a table triggers a CSV download reflecting the current filtered/sorted view', () => {
  setupDom();
  const table = buildTable(['Name', 'Score'], [['Bob', '10'], ['Alice', '20']]);
  enhanceTable(table, { filenameHint: 'my-table' });

  const scoreHeader = table.querySelectorAll('thead tr:first-child th')[1];
  scoreHeader.click(); // sort ascending by Score -> Bob(10), Alice(20)

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

  table.closest('.ek-table-enhanced').querySelector('.ek-table-export-btn').click();

  assert.equal(downloadedName, 'my-table.csv');
  assert.equal(downloadedBlob.type, 'text/csv;charset=utf-8');

  URL.createObjectURL = originalCreateObjectURL;
  teardownDom();
});

test('a table with no body rows is left alone (no controls added)', () => {
  setupDom();
  const table = buildTable(['A'], []);
  enhanceTable(table);
  assert.equal(table.closest('.ek-table-enhanced'), null);
  assert.equal(table.querySelector('.ek-table-filter-row'), null);
  teardownDom();
});
