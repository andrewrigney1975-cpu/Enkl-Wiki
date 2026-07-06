import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import {
  hashCredential, verifyCredential, verifyCredentialTier, ensureDefaultCredential,
  isUnlocked, setUnlocked, isAdmin, setAdmin
} from '../../src/auth/credential.js';

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
  const config = { settings: { credentialSalt: null, credentialHash: null, adminCredentialSalt: null, adminCredentialHash: null } };
  await ensureDefaultCredential(config);
  assert.ok(config.settings.credentialSalt);
  assert.ok(config.settings.credentialHash);
  assert.equal(await verifyCredential('foobar', config.settings.credentialSalt, config.settings.credentialHash), true);

  const { credentialSalt, credentialHash } = config.settings;
  await ensureDefaultCredential(config);
  assert.equal(config.settings.credentialSalt, credentialSalt, 'should not overwrite an existing credential');
  assert.equal(config.settings.credentialHash, credentialHash);
});

test('ensureDefaultCredential also seeds a separate "siteadmin" admin credential', async () => {
  const config = { settings: { credentialSalt: null, credentialHash: null, adminCredentialSalt: null, adminCredentialHash: null } };
  await ensureDefaultCredential(config);

  assert.ok(config.settings.adminCredentialSalt);
  assert.ok(config.settings.adminCredentialHash);
  assert.notEqual(config.settings.adminCredentialSalt, config.settings.credentialSalt);
  assert.equal(await verifyCredential('siteadmin', config.settings.adminCredentialSalt, config.settings.adminCredentialHash), true);
});

test('verifyCredentialTier returns "admin", "editor" or null depending on which credential matches', async () => {
  const editor = await hashCredential('foobar');
  const admin = await hashCredential('siteadmin');
  const config = {
    settings: {
      credentialSalt: editor.salt, credentialHash: editor.hash,
      adminCredentialSalt: admin.salt, adminCredentialHash: admin.hash
    }
  };

  assert.equal(await verifyCredentialTier('siteadmin', config), 'admin');
  assert.equal(await verifyCredentialTier('foobar', config), 'editor');
  assert.equal(await verifyCredentialTier('nope', config), null);
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

test('isAdmin/setAdmin round-trip through sessionStorage, independently of isUnlocked', () => {
  setupDom();
  assert.equal(isAdmin(), false);
  setUnlocked(true);
  assert.equal(isAdmin(), false, 'unlocking as editor should not imply admin');
  setAdmin(true);
  assert.equal(isAdmin(), true);
  setAdmin(false);
  assert.equal(isAdmin(), false);
  teardownDom();
});
