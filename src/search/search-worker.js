// Runs off the main thread as a Web Worker. This file is bundled by
// scripts/build.js as its own esbuild entry point, and the resulting text is
// embedded into the main bundle as __SEARCH_WORKER_SOURCE__ (see
// search-client.js) so the whole app still ships as one HTML file.
import { buildIndex, search } from './tfidf.js';

let index = null;

self.onmessage = (evt) => {
  const { id, type, payload } = evt.data;
  if (type === 'build') {
    index = buildIndex(payload.documents);
    self.postMessage({ id, result: true });
  } else if (type === 'search') {
    self.postMessage({ id, result: index ? search(index, payload.query) : [] });
  }
};
