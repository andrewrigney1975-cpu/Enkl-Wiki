import { createSearchClient, buildSearchDocuments } from '../search/search-client.js';
import { stripMarkdownToPlainText } from '../content/markdown.js';
import { navigateToSlug } from '../app/router.js';
import { iconMarkup } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function createSearchBox({ getPages, getTags, getProvider }) {
  const client = createSearchClient();
  const snippetById = new Map();

  const root = document.createElement('div');
  root.className = 'ek-search-box';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'ek-search-input-wrap';
  inputWrap.innerHTML = iconMarkup('search', 14);
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search pages…';
  input.setAttribute('aria-label', 'Search pages');
  inputWrap.appendChild(input);

  const resultsPanel = document.createElement('div');
  resultsPanel.className = 'ek-search-results ek-hidden';

  root.append(inputWrap, resultsPanel);

  async function refreshIndex() {
    const pages = getPages();
    const tags = getTags();
    const provider = getProvider();
    const documents = await buildSearchDocuments(pages, tags, provider);
    await client.buildSearchIndex(documents);

    snippetById.clear();
    for (const page of pages) {
      if (page.archived) continue;
      const body = await provider.getPageBody(page);
      snippetById.set(page.id, stripMarkdownToPlainText(body).slice(0, 160));
    }
  }

  function closeResults() {
    resultsPanel.classList.add('ek-hidden');
    resultsPanel.innerHTML = '';
  }

  async function runQuery(query) {
    if (!query.trim()) {
      closeResults();
      return;
    }
    const results = await client.runSearch(query);
    const pages = getPages();
    resultsPanel.innerHTML = '';

    if (!results.length) {
      resultsPanel.innerHTML = '<div class="ek-search-empty">No matches.</div>';
    } else {
      for (const { id } of results) {
        const page = pages.find((p) => p.id === id);
        if (!page) continue;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'ek-search-result-row';
        row.innerHTML = `<div class="ek-search-result-title">${escapeHtml(page.title)}</div>`
          + `<div class="ek-search-result-snippet">${escapeHtml(snippetById.get(id) || '')}</div>`;
        row.addEventListener('click', () => {
          navigateToSlug(page.slug);
          closeResults();
          input.value = '';
        });
        resultsPanel.appendChild(row);
      }
    }
    resultsPanel.classList.remove('ek-hidden');
  }

  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runQuery(input.value), 150);
  });

  document.addEventListener('click', (evt) => {
    if (!root.contains(evt.target)) closeResults();
  });

  return { root, refreshIndex };
}
