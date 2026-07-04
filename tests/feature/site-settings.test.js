import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

test('saving site settings updates title, description, and content backing provider', async () => {
  setupDom();
  const { initState, getConfig } = await import('../../src/app/state.js');
  const { showSiteSettingsModal } = await import('../../src/ui/site-settings-modal.js');
  await initState();

  showSiteSettingsModal();
  document.getElementById('ekSiteTitleInput').value = 'My Wiki';
  document.getElementById('ekSiteDescInput').value = 'A description';
  document.getElementById('ekProviderSelect').value = 'filesystem';
  document.querySelector('.ek-btn-primary').click();
  await tick();

  const config = getConfig();
  assert.equal(config.site.title, 'My Wiki');
  assert.equal(config.site.description, 'A description');
  assert.equal(config.settings.contentBackingProvider, 'filesystem');

  teardownDom();
});

test('changing the credential unlocks with the new value instead of the old one', async () => {
  setupDom();
  const { initState, getConfig } = await import('../../src/app/state.js');
  const { showSiteSettingsModal } = await import('../../src/ui/site-settings-modal.js');
  const { verifyCredential } = await import('../../src/auth/credential.js');
  await initState();

  showSiteSettingsModal();
  document.getElementById('ekNewCredInput').value = 'newSecret';
  document.querySelector('.ek-btn-primary').click();
  await tick();

  const config = getConfig();
  assert.equal(await verifyCredential('newSecret', config.settings.credentialSalt, config.settings.credentialHash), true);
  assert.equal(await verifyCredential('foobar', config.settings.credentialSalt, config.settings.credentialHash), false);

  teardownDom();
});

test('exporting then importing round-trips the site data via a real File object', async () => {
  setupDom();
  const { initState, getConfig, getPages } = await import('../../src/app/state.js');
  const { showSiteSettingsModal } = await import('../../src/ui/site-settings-modal.js');
  await initState();

  const originalTitle = getConfig().site.title;
  const exportedJson = JSON.stringify(getConfig());

  // Mutate local state so we can prove the import actually restores the export.
  getConfig().site.title = 'Mutated Locally';

  showSiteSettingsModal();
  const fileInput = document.querySelector('input[type="file"]');
  const file = new File([exportedJson], 'export.json', { type: 'application/json' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new window.Event('change'));
  await tick();

  // Confirm the destructive-import warning.
  document.querySelector('.ek-btn-danger').click();
  await tick();

  assert.equal(getConfig().site.title, originalTitle);
  assert.equal(getPages().length, 1); // the seeded Welcome page from the export

  teardownDom();
});
