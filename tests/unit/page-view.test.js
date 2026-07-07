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

test('shows the page\'s last-updated date/time, zero-padded, in the top meta row', async () => {
  setupDom();
  const container = document.createElement('div');
  // Built from local wall-clock components (not a UTC literal) so the
  // expected formatted output below is correct regardless of which time
  // zone this test happens to run in.
  const localDate = new Date(2026, 0, 5, 9, 5); // Jan 5 2026, 09:05 local
  const page = { id: '1', title: 'X', tagIds: [], updatedAt: localDate.toISOString() };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page, provider, tags: [] });

  const lastUpdated = container.querySelector('.ek-page-last-updated');
  assert.ok(lastUpdated);
  assert.equal(lastUpdated.textContent, 'Last Updated : 09:05 05, January 2026');

  // Lives in the same top meta row as the breadcrumb (not down by the
  // title), so its top edge lines up with the "On this page" panel.
  const metaRow = container.querySelector('.ek-page-meta-row');
  assert.ok(metaRow);
  assert.ok(metaRow.contains(lastUpdated));

  const articleChildren = [...container.querySelector('.ek-page').children];
  assert.ok(articleChildren.indexOf(metaRow) < articleChildren.indexOf(container.querySelector('.ek-page-title-row')));

  teardownDom();
});

test('a page with no updatedAt renders no last-updated element', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', title: 'X', tagIds: [] };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page, provider, tags: [] });

  assert.equal(container.querySelector('.ek-page-last-updated'), null);
  teardownDom();
});

test('renders a clickable breadcrumb trail above the title, using a right-arrow separator', async () => {
  setupDom();
  const container = document.createElement('div');
  const grandparent = { id: 'gp', slug: 'guides', title: 'Guides', parentId: null };
  const parent = { id: 'p', slug: 'setup', title: 'Setup', parentId: 'gp' };
  const page = { id: 'c', slug: 'install', title: 'Install', parentId: 'p', tagIds: [] };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page, provider, tags: [], pages: [grandparent, parent, page] });

  const breadcrumb = container.querySelector('.ek-breadcrumb');
  assert.ok(breadcrumb);
  // Should appear before the title, inside the shared top meta row.
  assert.ok(container.querySelector('.ek-page-meta-row').contains(breadcrumb));
  const articleChildren = [...container.querySelector('.ek-page').children];
  assert.ok(articleChildren.indexOf(container.querySelector('.ek-page-meta-row')) < articleChildren.indexOf(container.querySelector('.ek-page-title-row')));

  const links = [...breadcrumb.querySelectorAll('.ek-breadcrumb-link')].map((el) => el.textContent);
  assert.deepEqual(links, ['Guides', 'Setup']);
  assert.equal(breadcrumb.querySelector('.ek-breadcrumb-current').textContent, 'Install');

  const seps = [...breadcrumb.querySelectorAll('.ek-breadcrumb-sep')].map((el) => el.textContent);
  assert.deepEqual(seps, ['→', '→']);

  window.location.hash = '';
  breadcrumb.querySelectorAll('.ek-breadcrumb-link')[1].click();
  assert.equal(window.location.hash, '#!/setup');

  teardownDom();
});

test('a page with neither ancestors nor an updatedAt renders no meta row at all', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', slug: 'home', title: 'Home', parentId: null, tagIds: [] };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page, provider, tags: [], pages: [page] });

  assert.equal(container.querySelector('.ek-page-meta-row'), null);
  teardownDom();
});

test('a top-level page (no ancestors) renders no breadcrumb at all', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', slug: 'home', title: 'Home', parentId: null, tagIds: [] };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page, provider, tags: [], pages: [page] });

  assert.equal(container.querySelector('.ek-breadcrumb'), null);
  teardownDom();
});

test('a corrupt/circular parentId chain does not hang the breadcrumb build', async () => {
  setupDom();
  const container = document.createElement('div');
  const a = { id: 'a', slug: 'a', title: 'A', parentId: 'b', tagIds: [] };
  const b = { id: 'b', slug: 'b', title: 'B', parentId: 'a', tagIds: [] };
  const provider = { getPageBody: async () => 'body' };

  await renderPageView(container, { page: a, provider, tags: [], pages: [a, b] });

  const breadcrumb = container.querySelector('.ek-breadcrumb');
  assert.ok(breadcrumb, 'should still render, just truncated at the cycle');
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

test('a table in the page body gets interactive sort/filter/export controls', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', title: 'Data', slug: 'data', tagIds: [] };
  const provider = { getPageBody: async () => '| A | B |\n| --- | --- |\n| 1 | 2 |' };

  await renderPageView(container, { page, provider, tags: [] });

  assert.ok(container.querySelector('.ek-table-enhanced'));
  assert.ok(container.querySelector('.ek-table-filter-row'));
  assert.ok(container.querySelector('.ek-table-export-btn'));
  assert.ok(container.querySelector('th.ek-table-sortable'));

  teardownDom();
});

test('an advanced table in the page body hydrates into a live grid that anyone can play with', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', title: 'Sheet', slug: 'sheet', tagIds: [] };
  const payload = JSON.stringify({ rows: 2, cols: 2, cells: { 'A1': '2', 'B1': '3', 'A2': '=A1+B1' } });
  const provider = { getPageBody: async () => '```ek-table\n' + payload + '\n```' };

  await renderPageView(container, { page, provider, tags: [] });

  const advTable = container.querySelector('.ek-advtable');
  assert.ok(advTable);
  assert.ok(advTable.querySelector('.ek-advtable-toolbar'), 'the read-only page view should still hydrate an interactive widget');

  // Editing a cell recomputes dependent formulas live, entirely in-browser —
  // nothing here is persisted back to page storage.
  const inputs = [...advTable.querySelectorAll('.ek-advtable-cell-input')];
  const b1 = inputs[1];
  b1.dispatchEvent(new window.Event('focus'));
  b1.value = '10';
  b1.dispatchEvent(new window.Event('blur'));

  const a2 = advTable.querySelectorAll('.ek-advtable-cell-input')[2];
  assert.equal(a2.value, '12');

  teardownDom();
});

test('an advanced table is excluded from the plain-table sort/filter enhancement pass', async () => {
  setupDom();
  const container = document.createElement('div');
  const page = { id: '1', title: 'Sheet', slug: 'sheet', tagIds: [] };
  const payload = JSON.stringify({ rows: 1, cols: 1, cells: { 'A1': '1' } });
  const provider = { getPageBody: async () => '```ek-table\n' + payload + '\n```' };

  await renderPageView(container, { page, provider, tags: [] });

  assert.equal(container.querySelector('.ek-table-enhanced'), null);
  assert.equal(container.querySelector('.ek-advtable .ek-table-filter-toggle-btn'), null);

  teardownDom();
});

test('the standalone HTML export stays clean of the interactive table controls', async () => {
  setupDom();
  const originalCreateElement = document.createElement.bind(document);
  let exportedHtml = null;
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      el.click = () => {
        // The export creates a Blob URL; recover its text via the Blob given to createObjectURL.
      };
    }
    return el;
  };
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = (blob) => { exportedHtml = blob; return 'blob:mock'; };

  const container = document.createElement('div');
  const page = { id: '1', title: 'Data', slug: 'data', tagIds: [] };
  const provider = { getPageBody: async () => '| A | B |\n| --- | --- |\n| 1 | 2 |' };
  await renderPageView(container, { page, provider, tags: [] });

  container.querySelector('.ek-page-export-btn').click();
  const text = await exportedHtml.text();
  assert.ok(!text.includes('ek-table-filter-row'));
  assert.ok(!text.includes('ek-table-export-btn'));
  assert.ok(!text.includes('ek-table-enhanced'));
  assert.match(text, /<table>/);

  URL.createObjectURL = originalCreateObjectURL;
  teardownDom();
});

test('the print button calls window.print()', async () => {
  setupDom();
  let printCalled = false;
  window.print = () => { printCalled = true; };

  const container = document.createElement('div');
  const page = { id: '1', title: 'Getting Started', slug: 'getting-started', tagIds: [] };
  const provider = { getPageBody: async () => '# Hello' };
  await renderPageView(container, { page, provider, tags: [] });

  container.querySelector('.ek-page-print-btn').click();
  assert.equal(printCalled, true);

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
