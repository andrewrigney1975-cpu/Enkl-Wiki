import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { htmlToMarkdown, createMarkdownEditor } from '../../src/content/markdown-editor.js';

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
