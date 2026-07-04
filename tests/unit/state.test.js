import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

test('initState seeds a default config with a Welcome page on first run', async () => {
  setupDom();
  const { initState, getPages, findPageBySlug, firstVisiblePage } = await import('../../src/app/state.js');
  const config = await initState();

  assert.equal(config.pages.length, 1);
  assert.equal(config.pages[0].slug, 'welcome');
  assert.equal(getPages().length, 1);
  assert.ok(findPageBySlug('welcome'));
  assert.equal(firstVisiblePage().slug, 'welcome');

  teardownDom();
});

test('initState reuses a previously stored config instead of reseeding', async () => {
  setupDom();
  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Existing', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: []
  }));

  const { initState } = await import('../../src/app/state.js');
  const config = await initState();

  assert.equal(config.site.title, 'Existing');
  assert.equal(config.pages.length, 0);

  teardownDom();
});

test('firstVisiblePage prefers a top-level, non-archived page', async () => {
  setupDom();
  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Existing', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: [
      { id: '1', slug: 'archived-root', parentId: null, title: 'Archived Root', tagIds: [], archived: true },
      { id: '2', slug: 'child', parentId: '3', title: 'Child', tagIds: [], archived: false },
      { id: '3', slug: 'root', parentId: null, title: 'Root', tagIds: [], archived: false }
    ]
  }));

  const { initState, firstVisiblePage } = await import('../../src/app/state.js');
  await initState();
  assert.equal(firstVisiblePage().slug, 'root');

  teardownDom();
});
