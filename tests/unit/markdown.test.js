import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, stripMarkdownToPlainText } from '../../src/content/markdown.js';

test('renders headings and paragraphs', () => {
  const html = renderMarkdown('# Title\n\nHello world.');
  assert.equal(html, '<h1>Title</h1>\n<p>Hello world.</p>');
});

test('escapes raw HTML in the source so it cannot inject markup', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renders bold, italic and inline code', () => {
  const html = renderMarkdown('**bold** and *italic* and `code`');
  assert.equal(html, '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>');
});

test('renders links with target=_blank and rel=noopener', () => {
  const html = renderMarkdown('[Enkl](https://example.com)');
  assert.equal(html, '<p><a href="https://example.com" target="_blank" rel="noopener">Enkl</a></p>');
});

test('internal hashbang links navigate in place instead of opening a new tab', () => {
  const html = renderMarkdown('[Home](#!/home)');
  assert.equal(html, '<p><a href="#!/home">Home</a></p>');
});

test('neutralizes javascript: URLs', () => {
  const html = renderMarkdown('[bad](javascript:alert(1))');
  assert.ok(html.includes('href="#"'));
});

test('embeds images as <img>, audio files as <audio>, video files as <video>', () => {
  assert.match(renderMarkdown('![a photo](uploads/photo.png)'), /<img src="uploads\/photo\.png" alt="a photo"/);
  assert.match(renderMarkdown('![a clip](uploads/clip.mp3)'), /<audio controls src="uploads\/clip\.mp3">/);
  assert.match(renderMarkdown('![a video](uploads/movie.mp4)'), /<video controls src="uploads\/movie\.mp4">/);
});

test('renders fenced code blocks without interpreting their contents as markdown', () => {
  const html = renderMarkdown('```js\nconst x = *not italic*;\n```');
  assert.equal(html, '<pre><code class="language-js">const x = *not italic*;</code></pre>');
});

test('a fenced code block never leaks its internal placeholder text, even when content looks block-like', () => {
  const html = renderMarkdown('```\nsome code\n# not a real heading\n- not a real list item\n```');
  assert.ok(!html.includes('CODEBLOCK'));
  assert.ok(!/\bCODE\d/.test(html));
  assert.equal(html, '<pre><code>some code\n# not a real heading\n- not a real list item</code></pre>');
});

test('a closing fence is only recognized when it is alone on its own line', () => {
  // Regression test: a naive "nearest triple-backtick" match would treat the
  // ``` on the content line below as the closing fence, truncate the block,
  // and leak the placeholder text used internally to protect it.
  const html = renderMarkdown('```\nHeres how to open one: ```js\nactual end\n```');
  assert.ok(!html.includes('CODEBLOCK'));
  assert.match(html, /Heres how to open one: ```js/);
  assert.match(html, /actual end/);
  assert.equal((html.match(/<pre>/g) || []).length, 1);
});

test('two separate fenced code blocks in the same document parse independently', () => {
  const html = renderMarkdown('```\nfirst\n```\n\nbetween\n\n```\nsecond\n```');
  assert.match(html, /<pre><code>first<\/code><\/pre>/);
  assert.match(html, /<p>between<\/p>/);
  assert.match(html, /<pre><code>second<\/code><\/pre>/);
});

test('renders unordered and ordered lists', () => {
  assert.equal(renderMarkdown('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
  assert.equal(renderMarkdown('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('renders blockquotes recursively', () => {
  const html = renderMarkdown('> quoted **text**');
  assert.equal(html, '<blockquote><p>quoted <strong>text</strong></p></blockquote>');
});

test('renders a horizontal rule', () => {
  assert.equal(renderMarkdown('---'), '<hr>');
});

test('renders a GFM-lite table', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.equal(
    html,
    '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
  );
});

test('stripMarkdownToPlainText strips syntax down to plain words', () => {
  const text = stripMarkdownToPlainText('# Title\n\n**Bold** and _italic_ with `code` and [a link](https://example.com).\n\n- one\n- two');
  assert.ok(!text.includes('#'));
  assert.ok(!text.includes('*'));
  assert.ok(!text.includes('`'));
  assert.ok(!text.includes('['));
  assert.match(text, /Title/);
  assert.match(text, /Bold/);
  assert.match(text, /a link/);
  assert.match(text, /one/);
});

test('stripMarkdownToPlainText drops fenced code and image syntax entirely', () => {
  const text = stripMarkdownToPlainText('before\n```js\nconst x = 1;\n```\nafter ![alt](uploads/x.png) done');
  assert.ok(!text.includes('const x'));
  assert.ok(!text.includes('uploads/x.png'));
  assert.match(text, /before/);
  assert.match(text, /after/);
  assert.match(text, /done/);
});
