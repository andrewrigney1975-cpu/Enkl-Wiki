import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { htmlToMarkdown, createMarkdownEditor, buildTableHtml } from '../../src/content/markdown-editor.js';

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
