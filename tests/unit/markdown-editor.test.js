import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { htmlToMarkdown, createMarkdownEditor, buildTableHtml } from '../../src/content/markdown-editor.js';
import { renderStaticHtml } from '../../src/advtable/advtable-render.js';
import { createModel, setRawCell } from '../../src/advtable/advtable-model.js';

test('htmlToMarkdown round-trips headings, emphasis, links and lists', () => {
  setupDom();
  const div = document.createElement('div');
  div.innerHTML = '<h1>Title</h1><p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li><li>two</li></ul>';
  const md = htmlToMarkdown(div);
  assert.match(md, /^# Title/);
  assert.match(md, /\*\*bold\*\*/);
  assert.match(md, /\*italic\*/);
  assert.match(md, /- one/);
  assert.match(md, /- two/);
  teardownDom();
});

test('htmlToMarkdown preserves fenced code block language and content', () => {
  setupDom();
  const div = document.createElement('div');
  div.innerHTML = '<pre><code class="language-js">const x = 1;</code></pre>';
  const md = htmlToMarkdown(div);
  assert.equal(md.trim(), '```js\nconst x = 1;\n```');
  teardownDom();
});

test('a syntax-highlighted code block (with nested token spans) still serializes back to plain code text', () => {
  setupDom();
  const div = document.createElement('div');
  // Mimics what renderMarkdown() + Prism actually produce for a recognized language.
  div.innerHTML = '<pre><code class="language-js"><span class="token keyword">const</span> x <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span></code></pre>';
  const md = htmlToMarkdown(div);
  assert.equal(md.trim(), '```js\nconst x = 1;\n```');
  teardownDom();
});

test('a Markdown code fence with a recognized language survives a full WYSIWYG render -> serialize round trip', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '```js\nconst x = 1;\n```' });
  assert.ok(editor.root.querySelector('.ek-md-wysiwyg .token.keyword'), 'the WYSIWYG preview should show highlighted tokens');
  assert.equal(editor.getValue().trim(), '```js\nconst x = 1;\n```');
  teardownDom();
});

test('createMarkdownEditor initializes the WYSIWYG surface from Markdown and getValue() serializes it back', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '# Hello\n\nWorld' });
  assert.match(editor.root.querySelector('.ek-md-wysiwyg').innerHTML, /<h1>Hello<\/h1>/);
  assert.match(editor.getValue(), /# Hello/);
  assert.match(editor.getValue(), /World/);
  teardownDom();
});

test('the Markdown/rendered mode toggle swaps views and keeps the value consistent', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '# Hello' });
  const toggle = editor.root.querySelector('.ek-md-mode-toggle');

  toggle.click(); // wysiwyg -> raw
  const raw = editor.root.querySelector('.ek-md-raw');
  assert.ok(!raw.classList.contains('ek-hidden'));
  assert.match(raw.value, /# Hello/);

  toggle.click(); // raw -> wysiwyg
  assert.ok(raw.classList.contains('ek-hidden'));
  assert.match(editor.root.querySelector('.ek-md-wysiwyg').innerHTML, /<h1>/);

  teardownDom();
});

test('setValue updates the currently active view', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: 'first' });
  editor.setValue('# Updated');
  assert.match(editor.root.querySelector('.ek-md-wysiwyg').innerHTML, /<h1>Updated<\/h1>/);
  teardownDom();
});

test('insertText inserts at the cursor position in raw mode', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: 'before after' });
  editor.root.querySelector('.ek-md-mode-toggle').click(); // switch to raw
  const raw = editor.root.querySelector('.ek-md-raw');
  raw.selectionStart = raw.selectionEnd = 'before'.length;

  editor.insertText('[MID]');

  // htmlToMarkdown() appends a trailing newline for non-empty content.
  assert.equal(raw.value, 'before[MID] after\n');
  teardownDom();
});

test('insertText appends rendered content in WYSIWYG mode', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '' });
  editor.insertText('![alt](uploads/pic.png)');
  assert.match(editor.root.querySelector('.ek-md-wysiwyg').innerHTML, /<img src="uploads\/pic\.png"/);
  teardownDom();
});

test('htmlToMarkdown serializes a table into GFM-style Markdown with a header separator row', () => {
  setupDom();
  const div = document.createElement('div');
  div.innerHTML = '<table><thead><tr><th>Name</th><th>Age</th></tr></thead>'
    + '<tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table>';
  const md = htmlToMarkdown(div);
  assert.equal(md.trim(), ['| Name | Age |', '| --- | --- |', '| Alice | 30 |', '| Bob | 25 |'].join('\n'));
  teardownDom();
});

test('buildTableHtml builds a header row plus (rows - 1) body rows with the requested column count', () => {
  const html = buildTableHtml(3, 2);
  assert.ok(html.includes('<thead>'));
  assert.ok(html.includes('<tbody>'));
  assert.equal((html.match(/<th>/g) || []).length, 2);
  assert.equal((html.match(/<td>/g) || []).length, 4); // 2 body rows x 2 cols
});

test('buildTableHtml with a single row produces a header-only table', () => {
  const html = buildTableHtml(1, 3);
  assert.equal((html.match(/<th>/g) || []).length, 3);
  assert.equal((html.match(/<td>/g) || []).length, 0);
});

test('a Markdown table survives a render -> WYSIWYG -> serialize round trip', () => {
  setupDom();
  const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
  const editor = createMarkdownEditor({ initialValue: md });
  assert.ok(editor.root.querySelector('.ek-md-wysiwyg table'));
  const roundTripped = editor.getValue();
  assert.match(roundTripped, /\| A \| B \|/);
  assert.match(roundTripped, /\| 1 \| 2 \|/);
  teardownDom();
});

// Places the caret inside `node` and dispatches a click on it, the same
// pair of signals a real click in the editor produces (a browser both moves
// the selection and fires the click event).
function clickInside(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

test('clicking inside a table reveals the floating width toolbar; clicking outside hides it', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '| A |\n| --- |\n| 1 |' });
  document.body.appendChild(editor.root); // selection/Range behavior needs the node attached to the document
  const cell = editor.root.querySelector('.ek-md-wysiwyg td, .ek-md-wysiwyg th');
  const tableToolbar = editor.root.querySelector('.ek-table-toolbar');
  assert.ok(tableToolbar.classList.contains('ek-hidden'));

  clickInside(cell);
  assert.ok(!tableToolbar.classList.contains('ek-hidden'));

  document.body.click();
  assert.ok(tableToolbar.classList.contains('ek-hidden'));

  teardownDom();
});

test('the full-width toolbar button marks the table full width and getValue() includes the marker', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '| A |\n| --- |\n| 1 |' });
  document.body.appendChild(editor.root);
  const cell = editor.root.querySelector('.ek-md-wysiwyg td, .ek-md-wysiwyg th');
  clickInside(cell);

  const table = editor.root.querySelector('.ek-md-wysiwyg table');
  const [responsiveBtn, fullWidthBtn] = editor.root.querySelectorAll('.ek-table-toolbar-btn');
  assert.ok(responsiveBtn.classList.contains('active'));
  assert.ok(!fullWidthBtn.classList.contains('active'));

  fullWidthBtn.click();
  assert.ok(table.classList.contains('ek-table-full'));
  assert.ok(fullWidthBtn.classList.contains('active'));
  assert.match(editor.getValue(), /^<!--full-width-->\n\| A \|/);

  responsiveBtn.click();
  assert.ok(!table.classList.contains('ek-table-full'));
  assert.ok(!editor.getValue().includes('full-width'));

  teardownDom();
});

test('a full-width table loaded from Markdown shows the toolbar with "full width" already active', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '<!--full-width-->\n| A |\n| --- |\n| 1 |' });
  document.body.appendChild(editor.root);
  const table = editor.root.querySelector('.ek-md-wysiwyg table');
  assert.ok(table.classList.contains('ek-table-full'));

  clickInside(table.querySelector('td, th'));
  const [responsiveBtn, fullWidthBtn] = editor.root.querySelectorAll('.ek-table-toolbar-btn');
  assert.ok(fullWidthBtn.classList.contains('active'));
  assert.ok(!responsiveBtn.classList.contains('active'));

  teardownDom();
});

test('switching to raw mode hides the table toolbar', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '| A |\n| --- |\n| 1 |' });
  document.body.appendChild(editor.root);
  const cell = editor.root.querySelector('.ek-md-wysiwyg td, .ek-md-wysiwyg th');
  clickInside(cell);
  const tableToolbar = editor.root.querySelector('.ek-table-toolbar');
  assert.ok(!tableToolbar.classList.contains('ek-hidden'));

  editor.root.querySelector('.ek-md-mode-toggle').click();
  assert.ok(tableToolbar.classList.contains('ek-hidden'));

  teardownDom();
});

test('the heading dropdown applies formatBlock via execCommand and resets to Paragraph', () => {
  setupDom();
  const calls = [];
  document.execCommand = (command, showUi, value) => { calls.push({ command, value }); return true; };

  const editor = createMarkdownEditor({ initialValue: '' });
  const select = editor.root.querySelector('.ek-md-heading-select');
  select.value = 'h2';
  select.dispatchEvent(new window.Event('change'));

  assert.deepEqual(calls, [{ command: 'formatBlock', value: 'h2' }]);
  assert.equal(select.value, '');

  delete document.execCommand;
  teardownDom();
});

test('the heading dropdown offers Paragraph and Heading 1-6', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '' });
  const labels = [...editor.root.querySelector('.ek-md-heading-select').options].map((o) => o.textContent);
  assert.deepEqual(labels, ['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6']);
  teardownDom();
});

test('hovering the table grid highlights the rows x cols rectangle and updates the label', () => {
  setupDom();
  const editor = createMarkdownEditor({ initialValue: '' });
  editor.root.querySelector('.ek-md-toolbar-btn[title="Insert table"]').click();

  const cells = [...editor.root.querySelectorAll('.ek-md-table-grid-cell')];
  const target = cells.find((c) => c.dataset.row === '2' && c.dataset.col === '3');
  target.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));

  const activeCells = cells.filter((c) => c.classList.contains('active'));
  assert.equal(activeCells.length, 3 * 4); // rows 0-2, cols 0-3
  assert.equal(editor.root.querySelector('.ek-md-table-picker-label').textContent, '3 x 4');

  teardownDom();
});

test('clicking a grid cell inserts a table of that size via execCommand and closes the popover', () => {
  setupDom();
  const calls = [];
  document.execCommand = (command, showUi, value) => { calls.push({ command, value }); return true; };

  const editor = createMarkdownEditor({ initialValue: '' });
  const tableBtn = editor.root.querySelector('.ek-md-toolbar-btn[title="Insert table"]');
  tableBtn.click();

  const cells = [...editor.root.querySelectorAll('.ek-md-table-grid-cell')];
  cells.find((c) => c.dataset.row === '1' && c.dataset.col === '2').click();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'insertHTML');
  assert.equal((calls[0].value.match(/<th>/g) || []).length, 3); // 3 columns
  assert.equal((calls[0].value.match(/<tr>/g) || []).length, 2); // 2 rows total

  assert.ok(editor.root.querySelector('.ek-md-table-picker').classList.contains('ek-hidden'));

  delete document.execCommand;
  teardownDom();
});

test('the "Insert advanced table" button requests an ek-advtable skeleton via execCommand', () => {
  setupDom();
  const calls = [];
  document.execCommand = (command, showUi, value) => { calls.push({ command, value }); return true; };

  const editor = createMarkdownEditor({ initialValue: '' });
  const btn = editor.root.querySelector('.ek-md-toolbar-btn[title^="Insert advanced table"]');
  assert.ok(btn, 'the master toolbar should have an insert-advanced-table button');
  btn.click();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'insertHTML');
  assert.match(calls[0].value, /class="ek-advtable"/);
  assert.match(calls[0].value, /data-advtable="/);

  delete document.execCommand;
  teardownDom();
});

test('clicking "Insert advanced table" immediately hydrates the inserted block into the interactive widget', () => {
  setupDom();
  let wysiwyg;
  // A real browser's execCommand('insertHTML', ...) inserts synchronously at
  // the caret; appending approximates that closely enough here to exercise
  // the hydration call that follows it in markdown-editor.js.
  document.execCommand = (command, showUi, value) => {
    if (command === 'insertHTML') wysiwyg.innerHTML += value;
    return true;
  };

  const editor = createMarkdownEditor({ initialValue: '' });
  wysiwyg = editor.root.querySelector('.ek-md-wysiwyg');
  editor.root.querySelector('.ek-md-toolbar-btn[title^="Insert advanced table"]').click();

  assert.ok(wysiwyg.querySelector('.ek-advtable-toolbar'), 'the inserted block should already be interactive');
  assert.match(editor.getValue(), /```ek-table/);

  delete document.execCommand;
  teardownDom();
});

test('htmlToMarkdown serializes an advanced table as a ```ek-table fence carrying its data-advtable JSON', () => {
  setupDom();
  const model = createModel(1, 1);
  setRawCell(model, 0, 0, '=1+1');
  const div = document.createElement('div');
  div.innerHTML = renderStaticHtml(model);
  const md = htmlToMarkdown(div);
  assert.match(md, /^```ek-table\n/);
  assert.match(md, /"A1":"=1\+1"/);
  assert.match(md, /```\s*$/);
  teardownDom();
});

test('an advanced table survives a render -> WYSIWYG (hydrated) -> serialize round trip', () => {
  setupDom();
  const model = createModel(2, 2);
  setRawCell(model, 0, 0, '3');
  setRawCell(model, 0, 1, '4');
  setRawCell(model, 1, 0, '=A1+B1');
  const initialValue = '```ek-table\n' + JSON.stringify({ rows: model.rows, cols: model.cols, cells: model.cells }) + '\n```';

  const editor = createMarkdownEditor({ initialValue });
  const wysiwyg = editor.root.querySelector('.ek-md-wysiwyg');
  assert.ok(wysiwyg.querySelector('.ek-advtable-toolbar'), 'loading existing Markdown should hydrate the block');

  const roundTripped = editor.getValue();
  assert.match(roundTripped, /```ek-table/);
  assert.match(roundTripped, /"A2":"=A1\+B1"/);

  teardownDom();
});

test('clicking inside an advanced table\'s grid does not show the plain full-width table toolbar', () => {
  setupDom();
  const model = createModel(1, 1);
  const initialValue = '```ek-table\n' + JSON.stringify({ rows: model.rows, cols: model.cols, cells: {} }) + '\n```';
  const editor = createMarkdownEditor({ initialValue });
  document.body.appendChild(editor.root);

  const cellInput = editor.root.querySelector('.ek-advtable-cell-input');
  clickInside(cellInput);

  assert.ok(editor.root.querySelector('.ek-table-toolbar').classList.contains('ek-hidden'));
  teardownDom();
});
