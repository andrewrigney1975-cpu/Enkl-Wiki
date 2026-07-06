import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

const API = 'http://api.example';

// A tiny in-memory stand-in for the real API, keyed by "METHOD path" —
// enough to exercise state.js's rdbms-mode branches (initState, the
// semantic mutation functions, syncSiteFromApi) without a real server.
function installFakeApi() {
  const site = { title: 'Fake Site', description: 'desc', tags: [], pages: [], uploads: [] };
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    const path = url.replace(API, '');
    const method = options.method || 'GET';

    if (method === 'GET' && path === '/api/site') {
      return { ok: true, status: 200, json: async () => site };
    }
    if (method === 'POST' && path === '/api/pages') {
      const body = JSON.parse(options.body);
      const page = {
        id: `p${site.pages.length + 1}`,
        slug: body.title.toLowerCase().replace(/\s+/g, '-'),
        parentId: body.parentId || null,
        title: body.title,
        tagIds: (body.tagNames || []).map((n) => {
          let tag = site.tags.find((t) => t.name === n);
          if (!tag) { tag = { id: `t${site.tags.length + 1}`, name: n }; site.tags.push(tag); }
          return tag.id;
        }),
        archived: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };
      site.pages.push(page);
      return { ok: true, status: 200, json: async () => page };
    }
    if (method === 'PUT' && /^\/api\/pages\/[^/]+$/.test(path)) {
      const id = path.split('/').pop();
      const page = site.pages.find((p) => p.id === id);
      const body = JSON.parse(options.body);
      page.title = body.title;
      return { ok: true, status: 204 };
    }
    if (method === 'PUT' && /^\/api\/pages\/[^/]+\/archived$/.test(path)) {
      const id = path.split('/')[3];
      const page = site.pages.find((p) => p.id === id);
      page.archived = JSON.parse(options.body).archived;
      return { ok: true, status: 204 };
    }
    if (method === 'PUT' && /^\/api\/pages\/[^/]+\/parent$/.test(path)) {
      const id = path.split('/')[3];
      const page = site.pages.find((p) => p.id === id);
      page.parentId = JSON.parse(options.body).newParentId;
      return { ok: true, status: 204 };
    }
    if (method === 'DELETE' && /^\/api\/pages\/[^/]+$/.test(path)) {
      const id = path.split('/').pop();
      site.pages = site.pages.filter((p) => p.id !== id);
      return { ok: true, status: 204 };
    }
    if (method === 'PUT' && path === '/api/site') {
      const body = JSON.parse(options.body);
      site.title = body.title;
      site.description = body.description;
      return { ok: true, status: 204 };
    }
    if (method === 'DELETE' && path === '/api/tags/unused') {
      site.tags = site.tags.filter((t) => site.pages.some((p) => p.tagIds.includes(t.id)));
      return { ok: true, status: 200, json: async () => ({ removed: 0 }) };
    }
    if (method === 'POST' && path === '/api/auth/login') {
      const { credential } = JSON.parse(options.body);
      if (credential !== 'foobar') return { ok: false, status: 401 };
      return { ok: true, status: 200, json: async () => ({ token: 'fake-jwt' }) };
    }
    if (method === 'POST' && path === '/api/uploads') {
      const upload = { id: 'u1', fileName: 'stored.png', originalFileName: 'x.png', contentType: 'image/png', size: 3, createdAt: '2026-01-01T00:00:00Z' };
      site.uploads.push(upload);
      return { ok: true, status: 200, json: async () => upload };
    }

    throw new Error(`Unhandled fake API call: ${method} ${path}`);
  };

  return { site, restore: () => { global.fetch = originalFetch; } };
}

test('initState boots into rdbms mode when a connection pointer is stored, and isRdbmsMode reflects it', async () => {
  setupDom();
  const { restore } = installFakeApi();
  localStorage.setItem('enklwiki_connection', JSON.stringify({ contentBackingProvider: 'rdbms', apiBaseUrl: API }));

  const state = await import('../../src/app/state.js');
  const config = await state.initState();

  assert.equal(config.settings.contentBackingProvider, 'rdbms');
  assert.equal(state.isRdbmsMode(), true);
  assert.equal(state.getApiBaseUrl(), API);
  assert.equal(config.site.title, 'Fake Site');

  restore();
  teardownDom();
});

test('createPage, updatePageMetadata, setPageArchived, reparentPage and deletePage all round-trip through the fake API', async () => {
  setupDom();
  const { restore } = installFakeApi();
  localStorage.setItem('enklwiki_connection', JSON.stringify({ contentBackingProvider: 'rdbms', apiBaseUrl: API }));

  const state = await import('../../src/app/state.js');
  await state.initState();

  const page = await state.createPage({ title: 'Alpha', tagNames: ['x', 'y'] });
  assert.equal(page.title, 'Alpha');
  assert.equal(page.tagIds.length, 2);

  const renamed = await state.updatePageMetadata(page, { title: 'Alpha Renamed', tagNames: [] });
  assert.equal(renamed.title, 'Alpha Renamed');

  await state.setPageArchived(page, true);
  assert.equal(state.findPageById(page.id).archived, true);

  const child = await state.createPage({ title: 'Beta', parentId: page.id, tagNames: [] });
  await state.reparentPage(child, null);
  assert.equal(state.findPageById(child.id).parentId, null);

  await state.deletePage(child, { type: 'cascade' });
  assert.equal(state.findPageById(child.id), null);

  restore();
  teardownDom();
});

test('recordUpload posts multipart form data and normalizes fileName to filename', async () => {
  setupDom();
  const { restore } = installFakeApi();
  localStorage.setItem('enklwiki_connection', JSON.stringify({ contentBackingProvider: 'rdbms', apiBaseUrl: API }));

  const state = await import('../../src/app/state.js');
  await state.initState();

  const upload = await state.recordUpload(new Blob(['abc'], { type: 'image/png' }), 'x.png');
  assert.equal(upload.filename, 'stored.png');
  assert.equal(upload.url, `${API}/api/uploads/stored.png`);
  assert.deepEqual(state.getUploads().map((u) => u.filename), ['stored.png']);

  restore();
  teardownDom();
});

test('loginToApi resolves a token on success and rejects with status 401 on a wrong credential', async () => {
  setupDom();
  const { restore } = installFakeApi();

  const state = await import('../../src/app/state.js');
  const token = await state.loginToApi(API, 'foobar');
  assert.equal(token, 'fake-jwt');

  await assert.rejects(() => state.loginToApi(API, 'wrong'), (err) => err.status === 401);

  restore();
  teardownDom();
});
