import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

test('uploading a file via the upload modal saves it (download fallback) and records it in config.uploads', async () => {
  setupDom();
  const { initState, getConfig } = await import('../../src/app/state.js');
  const { showUploadModal } = await import('../../src/ui/upload-modal.js');
  await initState();

  // No File System Access API in this jsdom window, so saveBlob() falls back
  // to triggering a download; avoid a real navigation attempt on the anchor.
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => {};
    return el;
  };

  let uploadedFilename = null;
  showUploadModal({ onUploaded: (filename) => { uploadedFilename = filename; } });

  const fileInput = document.querySelector('input[type="file"]');
  const file = new File(['fake image bytes'], 'photo.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });

  document.querySelector('.ek-btn-primary').click();
  await tick();

  assert.equal(uploadedFilename, 'photo.png');
  assert.deepEqual(getConfig().uploads.map((u) => u.filename), ['photo.png']);

  teardownDom();
});

test('the upload modal rejects a disallowed file extension', async () => {
  setupDom();
  const { initState } = await import('../../src/app/state.js');
  const { showUploadModal } = await import('../../src/ui/upload-modal.js');
  await initState();

  showUploadModal({});
  const fileInput = document.querySelector('input[type="file"]');
  const file = new File(['x'], 'script.exe', { type: 'application/octet-stream' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });

  document.querySelector('.ek-btn-primary').click();
  await tick();

  assert.ok(document.querySelector('.ek-overlay'), 'modal should stay open');
  assert.ok(!document.querySelector('.ek-field-error').classList.contains('ek-hidden'));

  teardownDom();
});

test('exporting a diagram saves it to uploads and reports the filename via onExported', async () => {
  setupDom();
  const { initState, getConfig } = await import('../../src/app/state.js');
  const { showDiagramModal } = await import('../../src/ui/diagram-modal.js');
  await initState();

  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => {};
    return el;
  };

  let exportedFilename = null;
  showDiagramModal({ onExported: (filename) => { exportedFilename = filename; } });

  const addProcessBtn = [...document.querySelectorAll('.ek-diagram-shape-btn')].find((b) => b.textContent === 'Process');
  addProcessBtn.click();
  document.querySelector('.ek-diagram-canvas').dispatchEvent(new window.MouseEvent('click', { clientX: 100, clientY: 100 }));

  document.querySelector('.ek-btn-primary').click();
  await tick();

  assert.match(exportedFilename, /^diagram-\d+\.svg$/);
  assert.equal(getConfig().uploads.length, 1);
  assert.equal(getConfig().uploads[0].filename, exportedFilename);

  teardownDom();
});
