import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { renderTree } from '../../src/ui/tree-view.js';

test('renders an empty state with no pages', () => {
  setupDom();
  const container = document.createElement('div');
  renderTree(container, { pages: [], activeId: null });
  assert.match(container.textContent, /No pages yet/);
  teardownDom();
});

test('renders a nested tree, hides archived pages, and marks the active page', () => {
  setupDom();
  const container = document.createElement('div');
  const pages = [
    { id: '1', parentId: null, slug: 'root', title: 'Root', archived: false },
    { id: '2', parentId: '1', slug: 'child', title: 'Child', archived: false },
    { id: '3', parentId: null, slug: 'hidden', title: 'Hidden', archived: true }
  ];
  renderTree(container, { pages, activeId: '2' });

  const labels = [...container.querySelectorAll('.ek-tree-label')].map((el) => el.textContent);
  assert.deepEqual(labels, ['Root', 'Child']);
  assert.ok(container.querySelector('.ek-tree-row.active').textContent.includes('Child'));
  teardownDom();
});

test("clicking a tree row navigates to that page's slug", () => {
  setupDom();
  const container = document.createElement('div');
  const pages = [{ id: '9', parentId: null, slug: 'about', title: 'About', archived: false }];
  renderTree(container, { pages, activeId: null });
  container.querySelector('.ek-tree-row').click();
  assert.equal(window.location.hash, '#!/about');
  teardownDom();
});

test('the collapse toggle hides and re-shows child nodes', () => {
  setupDom();
  const container = document.createElement('div');
  const pages = [
    { id: '10', parentId: null, slug: 'root2', title: 'Root2', archived: false },
    { id: '11', parentId: '10', slug: 'child2', title: 'Child2', archived: false }
  ];
  renderTree(container, { pages, activeId: null });
  assert.equal(container.querySelectorAll('.ek-tree-label').length, 2);

  container.querySelector('.ek-tree-toggle').click();
  assert.equal(container.querySelectorAll('.ek-tree-label').length, 1);

  container.querySelector('.ek-tree-toggle').click();
  assert.equal(container.querySelectorAll('.ek-tree-label').length, 2);
  teardownDom();
});
