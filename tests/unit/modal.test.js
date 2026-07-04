import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { openModal } from '../../src/ui/modal.js';

test('openModal renders title, body and footer, and appends to document.body', () => {
  setupDom();
  const body = document.createElement('p');
  body.textContent = 'Body content';
  const footer = document.createElement('button');
  footer.textContent = 'OK';

  const handle = openModal({ title: 'My Modal', bodyNode: body, footerNode: footer, size: 'sm' });

  assert.equal(document.querySelector('.ek-modal-header h2').textContent, 'My Modal');
  assert.ok(document.querySelector('.ek-modal-body').contains(body));
  assert.ok(document.querySelector('.ek-modal-footer').contains(footer));
  assert.ok(document.querySelector('.ek-modal').classList.contains('ek-modal-sm'));

  handle.close();
  teardownDom();
});

test('close() removes the overlay and calls onClose exactly once', () => {
  setupDom();
  let closeCount = 0;
  const handle = openModal({ title: 'T', onClose: () => { closeCount++; } });

  handle.close();
  assert.equal(document.querySelector('.ek-overlay'), null);
  assert.equal(closeCount, 1);

  handle.close(); // calling close() again should be a no-op
  assert.equal(closeCount, 1);

  teardownDom();
});

test('the built-in close button and clicking the backdrop both close the modal', () => {
  setupDom();
  openModal({ title: 'T' });
  document.querySelector('.ek-modal-header .ek-btn-ghost').click();
  assert.equal(document.querySelector('.ek-overlay'), null);

  openModal({ title: 'T2' });
  document.querySelector('.ek-overlay').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  assert.equal(document.querySelector('.ek-overlay'), null);

  teardownDom();
});

test('pressing Escape closes the modal', () => {
  setupDom();
  openModal({ title: 'T' });
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(document.querySelector('.ek-overlay'), null);
  teardownDom();
});
