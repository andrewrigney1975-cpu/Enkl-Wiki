import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, stripMarkdownToPlainText, isAllowedIframeUrl } from '../../src/content/markdown.js';

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
  const html = renderMarkdown('```text\nconst x = *not italic*;\n```');
  assert.equal(html, '<pre><code class="language-text">const x = *not italic*;</code></pre>');
});

test('fenced code blocks with a recognized language are syntax-highlighted', () => {
  const html = renderMarkdown('```js\nconst x = 1;\n```');
  assert.match(html, /^<pre><code class="language-js">/);
  assert.match(html, /<span class="token keyword">const<\/span>/);
  assert.match(html, /<span class="token number">1<\/span>/);
});

test('fenced code blocks with an unrecognized language fall back to plain escaped text', () => {
  const html = renderMarkdown('```made-up-lang\n<b>literal</b>\n```');
  assert.equal(html, '<pre><code class="language-made-up-lang">&lt;b&gt;literal&lt;/b&gt;</code></pre>');
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

test('a ```ek-table fence renders an advanced table block with computed cell values', () => {
  const payload = JSON.stringify({ rows: 2, cols: 2, cells: { 'A1': '2', 'B1': '3', 'A2': '=A1+B1' } });
  const html = renderMarkdown('```ek-table\n' + payload + '\n```');
  assert.match(html, /<div class="ek-advtable" data-advtable="/);
  assert.match(html, /<table class="ek-advtable-table">/);
  // Column letters across the top, row numbers down the left.
  assert.match(html, /<th>A<\/th><th>B<\/th>/);
  assert.match(html, /<th>1<\/th>/);
  assert.match(html, /<th>2<\/th>/);
  // A2's formula (=A1+B1) should already be computed in the static render.
  assert.match(html, /<td class="ek-advtable-numeric">5<\/td>/);
});

test('the ek-table data-advtable attribute round-trips the exact JSON payload (HTML-escaped)', () => {
  const payload = JSON.stringify({ rows: 1, cols: 1, cells: { 'A1': '"quoted & <escaped>"' } });
  const html = renderMarkdown('```ek-table\n' + payload + '\n```');
  const match = html.match(/data-advtable="([^"]*)"/);
  assert.ok(match, 'should emit a data-advtable attribute');
  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  assert.deepEqual(JSON.parse(decoded), JSON.parse(payload));
});

test('a malformed ek-table payload falls back to a blank default grid instead of breaking the render', () => {
  const html = renderMarkdown('```ek-table\nnot valid json at all\n```');
  assert.match(html, /<div class="ek-advtable"/);
  assert.match(html, /<th>A<\/th>/);
});

test('an error formula in an ek-table cell renders its error code with the error class', () => {
  const payload = JSON.stringify({ rows: 1, cols: 1, cells: { 'A1': '=1/0' } });
  const html = renderMarkdown('```ek-table\n' + payload + '\n```');
  assert.match(html, /<td class="ek-advtable-error">#DIV\/0!<\/td>/);
});

test('isAllowedIframeUrl accepts https: and relative URLs, rejects everything else', () => {
  assert.equal(isAllowedIframeUrl('https://example.com/embed'), true);
  assert.equal(isAllowedIframeUrl('/pages/embed.html'), true);
  assert.equal(isAllowedIframeUrl('embed.html'), true);
  assert.equal(isAllowedIframeUrl('../shared/embed.html'), true);

  assert.equal(isAllowedIframeUrl('http://example.com'), false);
  assert.equal(isAllowedIframeUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedIframeUrl('data:text/html,hi'), false);
  assert.equal(isAllowedIframeUrl('//evil.example.com/x'), false, 'protocol-relative URLs are rejected');
  assert.equal(isAllowedIframeUrl(''), false);
  assert.equal(isAllowedIframeUrl('   '), false);
});

test('a ```iframe fence with an https: URL renders a borderless <iframe>', () => {
  const payload = JSON.stringify({ url: 'https://example.com/embed', width: 600, widthUnit: 'px', height: 400 });
  const html = renderMarkdown('```iframe\n' + payload + '\n```');
  assert.match(html, /<iframe src="https:\/\/example\.com\/embed"/);
  assert.match(html, /style="width:600px;height:400px;border:0;display:block"/);
  assert.match(html, /title="Embedded content"/);
});

test('a ```iframe fence with a percentage width renders that unit', () => {
  const payload = JSON.stringify({ url: '/embed', width: 50, widthUnit: '%', height: 300 });
  const html = renderMarkdown('```iframe\n' + payload + '\n```');
  assert.match(html, /style="width:50%;height:300px;border:0;display:block"/);
});

test('an iframe fence with a disallowed URL scheme falls back to a plain code block, not an <iframe>', () => {
  const payload = JSON.stringify({ url: 'http://example.com', width: 600, widthUnit: 'px', height: 400 });
  const html = renderMarkdown('```iframe\n' + payload + '\n```');
  assert.ok(!html.includes('<iframe'));
  assert.match(html, /<pre><code class="language-iframe">/);
});

test('an iframe fence with malformed JSON falls back to a plain code block', () => {
  const html = renderMarkdown('```iframe\nnot valid json\n```');
  assert.ok(!html.includes('<iframe'));
  assert.match(html, /<pre><code class="language-iframe">/);
});

test('an iframe fence with a missing/non-positive width or height falls back to a plain code block', () => {
  const missingHeight = JSON.stringify({ url: 'https://example.com', width: 600, widthUnit: 'px' });
  assert.ok(!renderMarkdown('```iframe\n' + missingHeight + '\n```').includes('<iframe'));

  const zeroWidth = JSON.stringify({ url: 'https://example.com', width: 0, widthUnit: 'px', height: 400 });
  assert.ok(!renderMarkdown('```iframe\n' + zeroWidth + '\n```').includes('<iframe'));
});

test('an unrecognized widthUnit falls back to px rather than emitting unsafe/invalid CSS', () => {
  const payload = JSON.stringify({ url: 'https://example.com', width: 600, widthUnit: 'em; color:red', height: 400 });
  const html = renderMarkdown('```iframe\n' + payload + '\n```');
  assert.match(html, /style="width:600px;/);
});

test('the iframe data-iframe attribute round-trips the exact source JSON', () => {
  const payload = { url: 'https://example.com/embed', width: 600, widthUnit: 'px', height: 400 };
  const html = renderMarkdown('```iframe\n' + JSON.stringify(payload) + '\n```');
  const match = html.match(/data-iframe="([^"]*)"/);
  assert.ok(match);
  const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  assert.deepEqual(JSON.parse(decoded), payload);
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

test('a <!--full-width--> marker immediately above a table adds the ek-table-full class and is not itself rendered', () => {
  const html = renderMarkdown('<!--full-width-->\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(html, /^<table class="ek-table-full">/);
  assert.ok(!html.includes('full-width'));
});

test('the full-width marker is tolerant of extra spaces and case', () => {
  const html = renderMarkdown('<!-- FULL-WIDTH -->\n| A |\n|---|\n| 1 |');
  assert.match(html, /^<table class="ek-table-full">/);
});

test('a table without the marker has no width class', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(html, /^<table>/);
});

test('the marker only applies to a table that immediately follows it, not to an unrelated paragraph', () => {
  const html = renderMarkdown('<!--full-width-->\n\nJust a paragraph, no table here.');
  assert.match(html, /full-width/); // rendered as literal (escaped) text, not consumed
  assert.ok(!html.includes('ek-table-full'));
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
