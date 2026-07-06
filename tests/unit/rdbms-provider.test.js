import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RdbmsProvider } from '../../src/storage/rdbms-provider.js';

test('RdbmsProvider.getPageBody fetches the page body over HTTP', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, 'http://api.example/api/pages/p1/body');
    return { ok: true, json: async () => ({ body: '# Hello' }) };
  };

  const provider = new RdbmsProvider({ apiBaseUrl: 'http://api.example' });
  assert.equal(await provider.getPageBody({ id: 'p1' }), '# Hello');

  global.fetch = originalFetch;
});

test('RdbmsProvider.getPageBody throws with the HTTP status on failure', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404 });

  const provider = new RdbmsProvider({ apiBaseUrl: 'http://api.example' });
  await assert.rejects(() => provider.getPageBody({ id: 'missing' }), /404/);

  global.fetch = originalFetch;
});

test('RdbmsProvider.savePageBody PUTs the body with a bearer token and updates updatedAt', async () => {
  const originalFetch = global.fetch;
  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true };
  };

  const provider = new RdbmsProvider({ apiBaseUrl: 'http://api.example/', getToken: () => 'tok123' });
  const page = { id: 'p1', updatedAt: null };
  await provider.savePageBody(page, '# Updated');

  assert.equal(capturedUrl, 'http://api.example/api/pages/p1/body');
  assert.equal(capturedOptions.method, 'PUT');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer tok123');
  assert.deepEqual(JSON.parse(capturedOptions.body), { body: '# Updated' });
  assert.ok(page.updatedAt);

  global.fetch = originalFetch;
});

test('RdbmsProvider.savePageBody omits the Authorization header when no token is available', async () => {
  const originalFetch = global.fetch;
  let capturedOptions;
  global.fetch = async (url, options) => {
    capturedOptions = options;
    return { ok: true };
  };

  const provider = new RdbmsProvider({ apiBaseUrl: 'http://api.example' });
  await provider.savePageBody({ id: 'p1' }, 'text');
  assert.equal('Authorization' in capturedOptions.headers, false);

  global.fetch = originalFetch;
});

test('RdbmsProvider.savePageBody throws with the HTTP status on failure', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401 });

  const provider = new RdbmsProvider({ apiBaseUrl: 'http://api.example' });
  await assert.rejects(() => provider.savePageBody({ id: 'p1' }, 'text'), /401/);

  global.fetch = originalFetch;
});
