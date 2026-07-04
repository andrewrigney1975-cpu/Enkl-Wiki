import { JSDOM } from 'jsdom';

// Minimal jsdom bootstrap shared by tests that touch document/localStorage.
// Node's own fetch/Blob/File/crypto/URL.createObjectURL are used natively —
// only DOM globals need jsdom.
export function setupDom(url = 'http://localhost/') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.sessionStorage = dom.window.sessionStorage;
  return dom;
}

export function teardownDom() {
  delete global.window;
  delete global.document;
  delete global.localStorage;
  delete global.sessionStorage;
}
