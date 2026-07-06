import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

function seedSite(dom) {
  dom.window.localStorage.setItem('enklwiki_site', JSON.stringify({
    site: { title: 'My Wiki', description: '' },
    settings: { contentBackingProvider: 'embedded', credentialSalt: null, credentialHash: null, adminCredentialSalt: null, adminCredentialHash: null },
    tags: [],
    pages: []
  }));
}

test('the Site Settings button is hidden while locked', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';
  seedSite(dom);

  const { renderApp } = await import('../../src/app/main.js');
  await renderApp(dom.window.document.getElementById('app'));
  await tick();

  assert.equal(document.querySelector('[aria-label="Site settings"]').classList.contains('ek-hidden'), true);

  teardownDom();
});

test('unlocking with the editor credential does not reveal Site Settings', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';
  seedSite(dom);

  const { setUnlocked, setAdmin } = await import('../../src/auth/credential.js');
  setUnlocked(true);
  setAdmin(false);

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();

  // Editing tools show up...
  assert.equal(root.querySelector('.ek-toolstrip').classList.contains('ek-hidden'), false);
  // ...but Site Settings specifically requires the admin credential.
  assert.equal(root.querySelector('[aria-label="Site settings"]').classList.contains('ek-hidden'), true);

  teardownDom();
});

test('unlocking with the admin credential reveals Site Settings', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';
  seedSite(dom);

  const { setUnlocked, setAdmin } = await import('../../src/auth/credential.js');
  setUnlocked(true);
  setAdmin(true);

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();

  assert.equal(root.querySelector('.ek-toolstrip').classList.contains('ek-hidden'), false);
  assert.equal(root.querySelector('[aria-label="Site settings"]').classList.contains('ek-hidden'), false);

  teardownDom();
});

test('locking again hides Site Settings and clears the admin flag', async () => {
  const dom = setupDom();
  dom.window.document.body.innerHTML = '<div id="app"></div>';
  seedSite(dom);

  const { setUnlocked, setAdmin, isAdmin } = await import('../../src/auth/credential.js');
  setUnlocked(true);
  setAdmin(true);

  const { renderApp } = await import('../../src/app/main.js');
  const root = dom.window.document.getElementById('app');
  await renderApp(root);
  await tick();

  const lockBtn = [...root.querySelectorAll('.ek-header-btn')].find((b) => b.title.includes('unlocked'));
  lockBtn.click();
  await tick();

  assert.equal(isAdmin(), false);
  assert.equal(root.querySelector('[aria-label="Site settings"]').classList.contains('ek-hidden'), true);

  teardownDom();
});
