import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { JSDOM } from 'jsdom';
import { buildHtml } from '../../scripts/build.js';

function tick(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exercises the exact production build pipeline (esbuild bundling +
// minification + HTML templating) end-to-end. Unlike every other test in
// this suite, which imports source modules directly, this is the only test
// that would have caught a prior bug where build.js's template.replace()
// misinterpreted literal `$`-patterns inside a vendored library's minified
// source, silently corrupting the built script.
test('the production build compiles to valid JS and boots correctly', async () => {
  const html = await buildHtml('0.0.0-test');

  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scriptMatches.length, 2, 'expected the inline theme-flash script plus the bundled app script');
  const mainScript = scriptMatches[1][1];

  // Fails fast with a clear message if the bundle is malformed, before ever
  // touching a browser-like environment.
  assert.doesNotThrow(() => new vm.Script(mainScript), 'the built script must be syntactically valid JS');

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;

  // jsdom's own window doesn't implement these; polyfill with Node's real
  // versions so the app's crypto/upload code paths don't throw on load.
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};

  await tick();

  const doc = window.document;
  assert.ok(doc.querySelector('.ek-header'), 'header should render');
  assert.ok(doc.querySelector('.ek-tree-pane'), 'tree pane should render');
  assert.match(doc.querySelector('.ek-page-title')?.textContent || '', /Welcome/);
});
