import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

test('the toolstrip\'s Export Data button downloads the site config as JSON once unlocked', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';

  localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'My Wiki', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null },
    tags: [],
    pages: [
      { id: 'a', slug: 'home', parentId: null, title: 'Home', tagIds: [], archived: false, body: 'Home body', createdAt: '', updatedAt: '' }
    ]
  }));

  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  let downloadedName = null;
  dom.window.document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  const { renderApp } = await import('../../src/app/main.js');
  const { setUnlocked } = await import('../../src/auth/credential.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();

  // Not visible while locked.
  assert.equal(root.querySelector('.ek-toolstrip').classList.contains('ek-hidden'), true);

  setUnlocked(true);
  dom.window.dispatchEvent(new dom.window.Event('hashchange')); // re-run the route now that we're unlocked
  await tick();

  assert.equal(root.querySelector('.ek-toolstrip').classList.contains('ek-hidden'), false);

  const exportBtn = root.querySelector('.ek-toolstrip-btn[title="Export Data"]');
  assert.ok(exportBtn, 'Export Data button should be present in the toolstrip');
  exportBtn.click();

  assert.match(downloadedName, /^my-wiki-export\.json$/);

  teardownDom();
});
