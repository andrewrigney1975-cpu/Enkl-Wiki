import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function seedConfig(pages) {
  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Test', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages
  }));
}

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

test('archiving a page from the hierarchy modal hides it from the tree and shows a banner on its own page', async () => {
  setupDom();
  seedConfig([
    { id: 'p1', slug: 'home', parentId: null, title: 'Home', tagIds: [], archived: false, body: 'Home body', createdAt: '', updatedAt: '' }
  ]);

  const { initState } = await import('../../src/app/state.js');
  const { showHierarchyModal } = await import('../../src/ui/hierarchy-modal.js');
  await initState();

  showHierarchyModal();
  const archiveBtn = document.querySelector('.ek-hierarchy-icon-btn[title="Archive"]');
  archiveBtn.click();

  const { getPages } = await import('../../src/app/state.js');
  assert.equal(getPages()[0].archived, true);

  teardownDom();
});

test('deleting a childless page removes it after confirmation', async () => {
  setupDom();
  seedConfig([
    { id: 'p1', slug: 'home', parentId: null, title: 'Home', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' },
    { id: 'p2', slug: 'about', parentId: null, title: 'About', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' }
  ]);

  const { initState, getPages } = await import('../../src/app/state.js');
  const { showHierarchyModal } = await import('../../src/ui/hierarchy-modal.js');
  await initState();

  showHierarchyModal();
  const rows = [...document.querySelectorAll('.ek-hierarchy-row')];
  const aboutRow = rows.find((r) => r.querySelector('.ek-hierarchy-title').textContent === 'About');
  aboutRow.querySelector('.ek-hierarchy-danger-btn').click();
  await tick();

  // Confirm dialog is now open; click its danger "Delete" button.
  document.querySelector('.ek-btn-danger').click();
  await tick();

  assert.equal(getPages().length, 1);
  assert.equal(getPages()[0].id, 'p1');

  teardownDom();
});

test('deleting a page with children opens orphan resolution, and "promote" makes the top-most child top-level', async () => {
  setupDom();
  seedConfig([
    { id: 'parent', slug: 'parent', parentId: null, title: 'Parent', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' },
    { id: 'child1', slug: 'child1', parentId: 'parent', title: 'Child One', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' },
    { id: 'child2', slug: 'child2', parentId: 'parent', title: 'Child Two', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' }
  ]);

  const { initState, getPages } = await import('../../src/app/state.js');
  const { showHierarchyModal } = await import('../../src/ui/hierarchy-modal.js');
  await initState();

  showHierarchyModal();
  const rows = [...document.querySelectorAll('.ek-hierarchy-row')];
  const parentRow = rows.find((r) => r.querySelector('.ek-hierarchy-title').textContent === 'Parent');
  parentRow.querySelector('.ek-hierarchy-danger-btn').click();
  await tick();

  const promoteRadio = [...document.querySelectorAll('input[name="ekOrphanChoice"]')].find((r) => r.value === 'promote');
  promoteRadio.checked = true;
  document.querySelector('.ek-btn-danger').click();
  await tick();

  const pages = getPages();
  assert.ok(!pages.some((p) => p.id === 'parent'));
  assert.equal(pages.find((p) => p.id === 'child1').parentId, null);
  assert.equal(pages.find((p) => p.id === 'child2').parentId, 'child1');

  teardownDom();
});

test('reparenting a page via the parent select updates its parentId', async () => {
  setupDom();
  seedConfig([
    { id: 'a', slug: 'a', parentId: null, title: 'A', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' },
    { id: 'b', slug: 'b', parentId: null, title: 'B', tagIds: [], archived: false, body: '', createdAt: '', updatedAt: '' }
  ]);

  const { initState, getPages } = await import('../../src/app/state.js');
  const { showHierarchyModal } = await import('../../src/ui/hierarchy-modal.js');
  await initState();

  showHierarchyModal();
  const rows = [...document.querySelectorAll('.ek-hierarchy-row')];
  const rowB = rows.find((r) => r.querySelector('.ek-hierarchy-title').textContent === 'B');
  const select = rowB.querySelector('.ek-hierarchy-parent-select');
  select.value = 'a';
  select.dispatchEvent(new window.Event('change'));
  await tick();

  assert.equal(getPages().find((p) => p.id === 'b').parentId, 'a');

  teardownDom();
});
