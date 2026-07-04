import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, uniqueSlug, createPage, validatePage, buildPageTree, getChildren, getDescendantIds,
  moveSiblingPage, deletePageWithChildren
} from '../../src/content/page-model.js';

test('slugify lowercases, strips accents/punctuation, and hyphenates', () => {
  assert.equal(slugify('Café Rules!'), 'cafe-rules');
  assert.equal(slugify('  Multiple   Spaces  '), 'multiple-spaces');
  assert.equal(slugify(''), '');
});

test('uniqueSlug avoids collisions', () => {
  assert.equal(uniqueSlug('home', ['about']), 'home');
  assert.equal(uniqueSlug('home', ['home']), 'home-2');
  assert.equal(uniqueSlug('home', ['home', 'home-2']), 'home-3');
});

test('createPage builds a valid page with a unique slug', () => {
  const page = createPage({ title: 'Getting Started', existingSlugs: ['getting-started'] });
  assert.equal(page.slug, 'getting-started-2');
  assert.equal(page.title, 'Getting Started');
  assert.equal(page.parentId, null);
  assert.equal(page.archived, false);
  assert.doesNotThrow(() => validatePage(page));
});

test('createPage requires a title', () => {
  assert.throws(() => createPage({ title: '' }));
});

test('buildPageTree nests children under their parent', () => {
  const pages = [
    { id: '1', parentId: null, title: 'Root' },
    { id: '2', parentId: '1', title: 'Child' },
    { id: '3', parentId: '2', title: 'Grandchild' },
    { id: '4', parentId: 'missing-parent', title: 'Orphaned falls back to root' }
  ];
  const tree = buildPageTree(pages);
  assert.equal(tree.length, 2); // Root + the orphan-fallback page
  const root = tree.find((p) => p.id === '1');
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].children[0].id, '3');
});

test('getChildren and getDescendantIds', () => {
  const pages = [
    { id: '1', parentId: null },
    { id: '2', parentId: '1' },
    { id: '3', parentId: '2' },
    { id: '4', parentId: null }
  ];
  assert.deepEqual(getChildren(pages, '1').map((p) => p.id), ['2']);
  assert.deepEqual(getDescendantIds(pages, '1').sort(), ['2', '3']);
});

test('moveSiblingPage swaps a page with its previous/next sibling, ignoring non-siblings', () => {
  const pages = [
    { id: 'a', parentId: null },
    { id: 'x', parentId: 'other' },
    { id: 'b', parentId: null },
    { id: 'c', parentId: null }
  ];
  moveSiblingPage(pages, 'b', 'up');
  assert.deepEqual(pages.map((p) => p.id), ['b', 'x', 'a', 'c']);

  moveSiblingPage(pages, 'b', 'down');
  assert.deepEqual(pages.map((p) => p.id), ['a', 'x', 'b', 'c']);
});

test('moveSiblingPage is a no-op at either end of the sibling list', () => {
  const pages = [{ id: 'a', parentId: null }, { id: 'b', parentId: null }];
  moveSiblingPage(pages, 'a', 'up');
  assert.deepEqual(pages.map((p) => p.id), ['a', 'b']);
  moveSiblingPage(pages, 'b', 'down');
  assert.deepEqual(pages.map((p) => p.id), ['a', 'b']);
});

test('deletePageWithChildren removes a childless page outright', () => {
  const pages = [{ id: '1', parentId: null }, { id: '2', parentId: null }];
  const result = deletePageWithChildren(pages, '1', { type: 'cascade' });
  assert.deepEqual(result.map((p) => p.id), ['2']);
});

test('deletePageWithChildren cascade removes the page and all descendants', () => {
  const pages = [
    { id: '1', parentId: null },
    { id: '2', parentId: '1' },
    { id: '3', parentId: '2' },
    { id: '4', parentId: null }
  ];
  const result = deletePageWithChildren(pages, '1', { type: 'cascade' });
  assert.deepEqual(result.map((p) => p.id), ['4']);
});

test('deletePageWithChildren repoint moves the top-most child to a new parent and nests its siblings under it', () => {
  const pages = [
    { id: 'p', parentId: null },
    { id: 'first', parentId: 'p' },
    { id: 'second', parentId: 'p' },
    { id: 'target', parentId: null }
  ];
  const result = deletePageWithChildren(pages, 'p', { type: 'repoint', newParentId: 'target' });
  assert.equal(result.find((p) => p.id === 'first').parentId, 'target');
  assert.equal(result.find((p) => p.id === 'second').parentId, 'first');
  assert.ok(!result.some((p) => p.id === 'p'));
});

test('deletePageWithChildren promote makes the top-most child top-level and nests siblings under it', () => {
  const pages = [
    { id: 'p', parentId: null },
    { id: 'first', parentId: 'p' },
    { id: 'second', parentId: 'p' }
  ];
  const result = deletePageWithChildren(pages, 'p', { type: 'promote' });
  assert.equal(result.find((p) => p.id === 'first').parentId, null);
  assert.equal(result.find((p) => p.id === 'second').parentId, 'first');
});
