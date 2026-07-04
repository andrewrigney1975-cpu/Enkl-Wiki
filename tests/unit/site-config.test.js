import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, isValidConfigShape, CONTENT_PROVIDER } from '../../src/storage/site-config.js';

test('createDefaultConfig produces a valid, embedded-mode config', () => {
  const config = createDefaultConfig();
  assert.equal(config.settings.contentBackingProvider, CONTENT_PROVIDER.EMBEDDED);
  assert.equal(isValidConfigShape(config), true);
});

test('isValidConfigShape rejects malformed input', () => {
  assert.equal(isValidConfigShape(null), false);
  assert.equal(isValidConfigShape({}), false);
  assert.equal(isValidConfigShape({ site: {}, settings: {}, tags: [], pages: [] }), false);
});
