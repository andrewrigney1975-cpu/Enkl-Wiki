import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

test('the hamburger button opens the tree drawer, and navigating a page closes it again', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';

  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Test', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: [
      { id: 'a', slug: 'home', parentId: null, title: 'Home', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' },
      { id: 'b', slug: 'second', parentId: null, title: 'Second', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' }
    ]
  }));

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();
  await tick();

  const menuBtn = root.querySelector('.ek-mobile-menu-btn');
  const treePane = root.querySelector('.ek-tree-pane');
  const backdrop = root.querySelector('.ek-drawer-backdrop');

  assert.ok(!treePane.classList.contains('open'));
  menuBtn.click();
  assert.ok(treePane.classList.contains('open'));
  assert.ok(backdrop.classList.contains('open'));

  const secondRow = [...root.querySelectorAll('.ek-tree-row')].find((r) => r.textContent.includes('Second'));
  secondRow.click();
  await tick();

  assert.ok(!treePane.classList.contains('open'), 'navigating should close the drawer');
  assert.ok(!backdrop.classList.contains('open'));

  teardownDom();
});

test('clicking the backdrop closes the drawer without navigating', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();
  await tick();

  root.querySelector('.ek-mobile-menu-btn').click();
  assert.ok(root.querySelector('.ek-tree-pane').classList.contains('open'));

  root.querySelector('.ek-drawer-backdrop').click();
  assert.ok(!root.querySelector('.ek-tree-pane').classList.contains('open'));

  teardownDom();
});
