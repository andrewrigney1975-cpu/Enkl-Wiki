import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

test('renderApp mounts a header, tree pane and main content area', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);

  assert.ok(root.querySelector('.ek-header'), 'header should be rendered');
  assert.ok(root.querySelector('.ek-logo'), 'logo should be rendered');
  assert.ok(root.querySelector('.ek-tree-pane'), 'tree pane should be rendered');
  assert.ok(root.querySelector('#ekMainContent'), 'main content mount point should exist');

  // renderApp kicks off an async hashbang redirect to the first page; let it
  // settle before tearing down the jsdom globals, or its pending timer fires
  // against already-deleted globals and fails the test as an unhandled rejection.
  await new Promise((resolve) => setTimeout(resolve, 20));
  await new Promise((resolve) => setTimeout(resolve, 20));

  teardownDom();
});
