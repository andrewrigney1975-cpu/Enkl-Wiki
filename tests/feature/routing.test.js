import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test('boots to the seeded Welcome page, then navigating a tree row swaps the reading pane', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';

  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Test Site', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: [
      { id: 'a', slug: 'home', parentId: null, title: 'Home', tagIds: [], archived: false, body: 'Home body', createdAt: '', updatedAt: '' },
      { id: 'b', slug: 'second', parentId: null, title: 'Second', tagIds: [], archived: false, body: 'Second body', createdAt: '', updatedAt: '' }
    ]
  }));

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();
  await tick();

  assert.equal(dom.window.location.hash, '#!/home');
  assert.equal(root.querySelector('.ek-page-title').textContent, 'Home');
  assert.ok(root.querySelector('.ek-tree-row.active').textContent.includes('Home'));

  const rows = [...root.querySelectorAll('.ek-tree-row')];
  const secondRow = rows.find((r) => r.textContent.includes('Second'));
  secondRow.click();
  await tick();
  await tick();

  assert.equal(dom.window.location.hash, '#!/second');
  assert.equal(root.querySelector('.ek-page-title').textContent, 'Second');
  assert.match(root.querySelector('.ek-page-body').textContent, /Second body/);

  teardownDom();
});
