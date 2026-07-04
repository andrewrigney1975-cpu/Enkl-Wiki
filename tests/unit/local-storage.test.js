import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

test('loadStoredConfig / saveStoredConfig / clearStoredConfig round-trip', async () => {
  setupDom();
  const { loadStoredConfig, saveStoredConfig, clearStoredConfig } = await import('../../src/storage/local-storage.js');

  assert.equal(loadStoredConfig(), null);
  const config = { site: { title: 'Test' }, settings: {}, tags: [], pages: [] };
  assert.equal(saveStoredConfig(config), true);
  assert.deepEqual(loadStoredConfig(), config);
  clearStoredConfig();
  assert.equal(loadStoredConfig(), null);

  teardownDom();
});

test('loadStoredConfig returns null for corrupt JSON instead of throwing', async () => {
  setupDom();
  localStorage.setItem('enklwiki_site', '{not json');
  const { loadStoredConfig } = await import('../../src/storage/local-storage.js');
  assert.equal(loadStoredConfig(), null);
  teardownDom();
});
