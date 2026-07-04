import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

test('creating a page through the editor modal persists it and reports it via onSaved', async () => {
  setupDom();
  const { initState, getConfig } = await import('../../src/app/state.js');
  const { showPageEditorModal } = await import('../../src/ui/page-editor-modal.js');
  await initState();

  await new Promise((resolve) => {
    showPageEditorModal({
      mode: 'create',
      parentId: null,
      onSaved: (page) => {
        assert.equal(page.title, 'New Page Title');
        assert.equal(page.parentId, null);
        resolve();
      }
    });

    setTimeout(() => {
      document.getElementById('ekPageTitleInput').value = 'New Page Title';
      document.getElementById('ekPageTagsInput').value = '#draft';
      document.querySelector('.ek-btn-primary').click();
    }, 20);
  });

  const config = getConfig();
  const created = config.pages.find((p) => p.title === 'New Page Title');
  assert.ok(created, 'the new page should be in the config');
  assert.equal(created.body, '');
  const tagNames = created.tagIds.map((id) => config.tags.find((t) => t.id === id).name);
  assert.deepEqual(tagNames, ['draft']);

  teardownDom();
});

test('editing an existing page updates its title and body without changing its slug', async () => {
  setupDom();
  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'Test', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: [
      { id: 'p1', slug: 'original-slug', parentId: null, title: 'Original Title', tagIds: [], archived: false, body: 'Original body', createdAt: '', updatedAt: '' }
    ]
  }));

  const { initState, getConfig, findPageBySlug } = await import('../../src/app/state.js');
  const { showPageEditorModal } = await import('../../src/ui/page-editor-modal.js');
  await initState();
  const page = findPageBySlug('original-slug');

  await new Promise((resolve) => {
    showPageEditorModal({ mode: 'edit', page, onSaved: () => resolve() });

    setTimeout(() => {
      document.getElementById('ekPageTitleInput').value = 'Updated Title';
      document.querySelector('.ek-md-mode-toggle').click();
      document.querySelector('.ek-md-raw').value = 'Updated body';
      document.querySelector('.ek-btn-primary').click();
    }, 20);
  });

  const config = getConfig();
  const updated = config.pages.find((p) => p.id === 'p1');
  assert.equal(updated.title, 'Updated Title');
  assert.equal(updated.slug, 'original-slug');
  assert.equal(updated.body, 'Updated body');

  teardownDom();
});
