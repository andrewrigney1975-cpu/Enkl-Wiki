import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { showAuthModal } from '../../src/ui/auth-modal.js';
import { hashCredential, isUnlocked, isAdmin } from '../../src/auth/credential.js';

// verifyCredentialTier can require up to two sequential PBKDF2 derivations
// (100k iterations each) before it resolves, which can occasionally exceed a
// fixed short timeout under CPU contention from other concurrently-running
// test files. Poll instead of waiting a fixed duration so these tests aren't
// flaky under load.
async function waitUntilUnlocked(timeoutMs = 2000) {
  const start = Date.now();
  while (!isUnlocked() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

test('showAuthModal unlocks and closes on the correct credential', async () => {
  setupDom();
  const { salt, hash } = await hashCredential('foobar');
  const config = { settings: { credentialSalt: salt, credentialHash: hash } };

  let unlocked = false;
  showAuthModal({ config, onUnlocked: () => { unlocked = true; } });

  document.getElementById('ekAuthInput').value = 'foobar';
  document.getElementById('ekAuthInput').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(unlocked, true);
  assert.equal(isUnlocked(), true);
  assert.equal(document.querySelector('.ek-overlay'), null, 'modal should have closed');

  teardownDom();
});

test('showAuthModal unlocks as admin (not just editor) when the admin credential is entered', async () => {
  setupDom();
  const editor = await hashCredential('foobar');
  const admin = await hashCredential('siteadmin');
  const config = {
    settings: {
      credentialSalt: editor.salt, credentialHash: editor.hash,
      adminCredentialSalt: admin.salt, adminCredentialHash: admin.hash
    }
  };

  showAuthModal({ config, onUnlocked: () => {} });
  document.getElementById('ekAuthInput').value = 'siteadmin';
  document.querySelector('.ek-btn-primary').click();
  await waitUntilUnlocked();

  assert.equal(isUnlocked(), true);
  assert.equal(isAdmin(), true);

  teardownDom();
});

test('showAuthModal unlocks editing but not admin when the editor credential is entered', async () => {
  setupDom();
  const editor = await hashCredential('foobar');
  const admin = await hashCredential('siteadmin');
  const config = {
    settings: {
      credentialSalt: editor.salt, credentialHash: editor.hash,
      adminCredentialSalt: admin.salt, adminCredentialHash: admin.hash
    }
  };

  showAuthModal({ config, onUnlocked: () => {} });
  document.getElementById('ekAuthInput').value = 'foobar';
  document.querySelector('.ek-btn-primary').click();
  await waitUntilUnlocked();

  assert.equal(isUnlocked(), true);
  assert.equal(isAdmin(), false);

  teardownDom();
});

test('showAuthModal shows an error and stays open on the wrong credential', async () => {
  setupDom();
  const { salt, hash } = await hashCredential('foobar');
  const config = { settings: { credentialSalt: salt, credentialHash: hash } };

  let unlocked = false;
  showAuthModal({ config, onUnlocked: () => { unlocked = true; } });

  document.getElementById('ekAuthInput').value = 'wrong';
  document.querySelector('.ek-btn-primary').click();

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(unlocked, false);
  assert.ok(document.querySelector('.ek-overlay'), 'modal should still be open');
  assert.ok(!document.getElementById('ekAuthError').classList.contains('ek-hidden'));

  teardownDom();
});
