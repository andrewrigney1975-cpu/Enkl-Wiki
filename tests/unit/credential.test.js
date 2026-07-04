import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { hashCredential, verifyCredential, ensureDefaultCredential, isUnlocked, setUnlocked } from '../../src/auth/credential.js';

test('hashCredential produces a salt/hash pair that verifyCredential accepts', async () => {
  const { salt, hash } = await hashCredential('mySecret');
  assert.equal(await verifyCredential('mySecret', salt, hash), true);
  assert.equal(await verifyCredential('wrongSecret', salt, hash), false);
});

test('two hashes of the same credential use different salts', async () => {
  const a = await hashCredential('same');
  const b = await hashCredential('same');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('ensureDefaultCredential seeds "foobar" only when nothing is set', async () => {
  const config = { settings: { credentialSalt: null, credentialHash: null } };
  await ensureDefaultCredential(config);
  assert.ok(config.settings.credentialSalt);
  assert.ok(config.settings.credentialHash);
  assert.equal(await verifyCredential('foobar', config.settings.credentialSalt, config.settings.credentialHash), true);

  const { credentialSalt, credentialHash } = config.settings;
  await ensureDefaultCredential(config);
  assert.equal(config.settings.credentialSalt, credentialSalt, 'should not overwrite an existing credential');
  assert.equal(config.settings.credentialHash, credentialHash);
});

test('isUnlocked/setUnlocked round-trip through sessionStorage', () => {
  setupDom();
  assert.equal(isUnlocked(), false);
  setUnlocked(true);
  assert.equal(isUnlocked(), true);
  setUnlocked(false);
  assert.equal(isUnlocked(), false);
  teardownDom();
});
