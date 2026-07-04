import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { renderPageView } from '../../src/ui/page-view.js';

test('renders a placeholder when no page is selected', async () => {
  setupDom();
  const container = document.createElement('div');
  await renderPageView(container, { page: null, provider: null, tags: [] });
  assert.match(container.textContent, /No page selected/);
  teardownDom();
});

test('renders the page title, tags and markdown body', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', title: 'Getting Started', tagIds: ['t1'] };
  const provider = { getPageBody: async () => '# Hello\n\nWorld' };
  const tags = [{ id: 't1', name: 'guide' }];

  await renderPageView(container, { page, provider, tags });

  assert.equal(container.querySelector('.ek-page-title').textContent, 'Getting Started');
  assert.match(container.querySelector('.ek-page-tags').textContent, /#guide/);
  assert.ok(container.querySelector('.ek-page-body h1'));

  teardownDom();
});

test('the export button downloads a standalone HTML file for the current page', async () => {
  setupDom();
  const originalCreateElement = document.createElement.bind(document);
  let downloadedName = null;
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  const container = document.createElement('div');
  const page = { id: '1', title: 'Getting Started', slug: 'getting-started', tagIds: [] };
  const provider = { getPageBody: async () => '# Hello' };
  await renderPageView(container, { page, provider, tags: [] });

  container.querySelector('.ek-page-export-btn').click();
  assert.equal(downloadedName, 'getting-started.html');

  teardownDom();
});

test('a slower render started earlier is superseded by a faster, later one', async () => {
  setupDom();
  const container = document.createElement('div');
  let resolveSlow;
  const slowProvider = { getPageBody: () => new Promise((r) => { resolveSlow = r; }) };
  const fastProvider = { getPageBody: async () => 'fast content' };

  const first = renderPageView(container, { page: { id: '1', title: 'Slow' }, provider: slowProvider, tags: [] });
  const second = renderPageView(container, { page: { id: '2', title: 'Fast' }, provider: fastProvider, tags: [] });

  await second;
  resolveSlow('slow content');
  await first;

  assert.equal(container.querySelector('.ek-page-title').textContent, 'Fast');
  teardownDom();
});
