import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FilesystemProvider } from '../../src/storage/filesystem-provider.js';

test('FilesystemProvider.getPageBody fetches the contentRef', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (path) => {
    assert.equal(path, 'pages/example.md');
    return { ok: true, text: async () => '# Hello' };
  };
  const provider = new FilesystemProvider();
  const body = await provider.getPageBody({ contentRef: 'pages/example.md' });
  assert.equal(body, '# Hello');
  global.fetch = originalFetch;
});

test('FilesystemProvider.getPageBody returns empty string with no contentRef', async () => {
  const provider = new FilesystemProvider();
  assert.equal(await provider.getPageBody({}), '');
});

test('FilesystemProvider.savePageBody uses the File System Access API when available', async () => {
  const originalWindow = global.window;
  global.window = {
    showSaveFilePicker: async ({ suggestedName }) => ({
      name: suggestedName,
      createWritable: async () => ({
        write: async () => {},
        close: async () => {}
      })
    })
  };
  const provider = new FilesystemProvider();
  const page = { slug: 'example' };
  await provider.savePageBody(page, '# Updated');
  assert.equal(page.contentRef, 'pages/example.md');
  assert.equal(page.body, undefined);
  global.window = originalWindow;
});
