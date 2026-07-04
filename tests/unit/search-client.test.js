import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDocuments, createSearchClient } from '../../src/search/search-client.js';

test('buildSearchDocuments skips archived pages and repeats title/tags for weighting', async () => {
  const pages = [
    { id: 'a', title: 'Onboarding Guide', tagIds: ['t1'], archived: false },
    { id: 'b', title: 'Old Draft', tagIds: [], archived: true }
  ];
  const tags = [{ id: 't1', name: 'hr' }];
  const provider = { getPageBody: async (page) => (page.id === 'a' ? 'Welcome to the team.' : 'ignored') };

  const docs = await buildSearchDocuments(pages, tags, provider);

  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, 'a');
  assert.match(docs[0].text, /Onboarding Guide.*Onboarding Guide/);
  assert.match(docs[0].text, /hr.*hr.*hr/);
  assert.match(docs[0].text, /Welcome to the team/);
});

test('createSearchClient runs inline (no bundled worker in this environment) and finds a strong match', async () => {
  const client = createSearchClient();
  await client.buildSearchIndex([
    { id: 'p1', text: 'How to configure the deployment pipeline for production' },
    { id: 'p2', text: 'A recipe for chocolate chip cookies' }
  ]);

  const results = await client.runSearch('deployment pipeline configuration');
  assert.equal(results[0].id, 'p1');

  client.destroy(); // no-op without a real worker, but should not throw
});

test('createSearchClient returns no results before an index has been built', async () => {
  const client = createSearchClient();
  assert.deepEqual(await client.runSearch('anything'), []);
});
