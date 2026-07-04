import { buildIndex, search } from './tfidf.js';
import { stripMarkdownToPlainText } from '../content/markdown.js';
import { tagNamesForIds } from '../content/tag-model.js';

// Replaced by scripts/build.js with the bundled search-worker.js source.
// Left undefined in dev/tests, which is the signal to fall back to running
// the same tfidf.js logic inline on the main thread instead.
function getWorkerSource() {
  return typeof __SEARCH_WORKER_SOURCE__ !== 'undefined' ? __SEARCH_WORKER_SOURCE__ : '';
}

// Builds the {id, text} documents fed to the index: title and tags are
// repeated to weight them higher than body prose, per the spec's requirement
// that tags participate in search.
export async function buildSearchDocuments(pages, tags, provider) {
  const documents = [];
  for (const page of pages) {
    if (page.archived) continue;
    const body = await provider.getPageBody(page);
    const tagNames = tagNamesForIds(tags, page.tagIds || []);
    const text = [page.title, page.title, ...tagNames, ...tagNames, ...tagNames, stripMarkdownToPlainText(body)].join(' ');
    documents.push({ id: page.id, text });
  }
  return documents;
}

export function createSearchClient() {
  let worker = null;
  let requestId = 0;
  const pending = new Map();
  let inlineIndex = null;

  const source = getWorkerSource();
  if (source && typeof window !== 'undefined' && typeof window.Worker === 'function' && typeof Blob !== 'undefined') {
    try {
      const blobUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      worker = new window.Worker(blobUrl);
      worker.onmessage = (evt) => {
        const { id, result } = evt.data;
        const resolve = pending.get(id);
        if (resolve) {
          pending.delete(id);
          resolve(result);
        }
      };
    } catch {
      worker = null; // fall back to running inline below
    }
  }

  function callWorker(type, payload) {
    return new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      worker.postMessage({ id, type, payload });
    });
  }

  async function buildSearchIndex(documents) {
    if (worker) {
      await callWorker('build', { documents });
    } else {
      inlineIndex = buildIndex(documents);
    }
  }

  async function runSearch(query) {
    if (worker) return callWorker('search', { query });
    return inlineIndex ? search(inlineIndex, query) : [];
  }

  function destroy() {
    if (worker) worker.terminate();
  }

  return { buildSearchIndex, runSearch, destroy };
}
