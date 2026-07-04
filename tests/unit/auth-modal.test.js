import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { showAuthModal } from '../../src/ui/auth-modal.js';
import { hashCredential, isUnlocked } from '../../src/auth/credential.js';

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
