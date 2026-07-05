import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCode, SUPPORTED_LANGUAGES } from '../../src/content/syntax-highlight.js';

test('highlightCode wraps recognized tokens in <span class="token ...">', () => {
  const html = highlightCode('const x = 1;', 'javascript');
  assert.match(html, /<span class="token keyword">const<\/span>/);
  assert.match(html, /<span class="token number">1<\/span>/);
});

test('highlightCode resolves common aliases to their real grammar', () => {
  const viaAlias = highlightCode('const x = 1;', 'js');
  const viaFullName = highlightCode('const x = 1;', 'javascript');
  assert.equal(viaAlias, viaFullName);
});

test('highlightCode returns null for an unrecognized language so callers can fall back', () => {
  assert.equal(highlightCode('some text', 'not-a-real-language'), null);
  assert.equal(highlightCode('some text', ''), null);
});

test('highlightCode escapes HTML-sensitive characters in the source', () => {
  const html = highlightCode('<script>', 'markup');
  assert.ok(!html.includes('<script>'));
});

test('SUPPORTED_LANGUAGES only lists languages highlightCode can actually resolve', () => {
  for (const { value } of SUPPORTED_LANGUAGES) {
    assert.notEqual(highlightCode('x', value), null, `expected a grammar for "${value}"`);
  }
});
