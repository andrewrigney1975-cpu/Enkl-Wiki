import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddedProvider } from '../../src/storage/embedded-provider.js';

test('EmbeddedProvider reads and writes page.body in place', async () => {
  const provider = new EmbeddedProvider();
  const page = { body: 'old', updatedAt: '2020-01-01T00:00:00.000Z' };
  assert.equal(await provider.getPageBody(page), 'old');
  await provider.savePageBody(page, 'new content');
  assert.equal(page.body, 'new content');
  assert.notEqual(page.updatedAt, '2020-01-01T00:00:00.000Z');
});

test('EmbeddedProvider treats a missing body as an empty string', async () => {
  const provider = new EmbeddedProvider();
  assert.equal(await provider.getPageBody({}), '');
});
