import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { isFileSystemAccessSupported, readTextFile, saveBlob } from '../../src/storage/file-io.js';

test('isFileSystemAccessSupported reflects window.showSaveFilePicker presence', () => {
  const originalWindow = global.window;
  global.window = {};
  assert.equal(isFileSystemAccessSupported(), false);
  global.window = { showSaveFilePicker: () => {} };
  assert.equal(isFileSystemAccessSupported(), true);
  global.window = originalWindow;
});

test('readTextFile rejects on a non-OK response', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => readTextFile('missing.md'));
  global.fetch = originalFetch;
});

test('saveBlob falls back to a download when the File System Access API is unavailable', async () => {
  setupDom();
  const originalCreateElement = document.createElement.bind(document);
  let clicked = false;
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { clicked = true; };
    return el;
  };

  const result = await saveBlob('note.md', new Blob(['hi']), { mimeType: 'text/markdown', description: 'Markdown' });
  assert.equal(result.method, 'download');
  assert.equal(result.filename, 'note.md');
  assert.equal(clicked, true);

  teardownDom();
});
