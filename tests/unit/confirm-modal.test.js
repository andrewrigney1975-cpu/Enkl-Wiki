import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { showConfirmModal } from '../../src/ui/confirm-modal.js';

test('resolves true when the confirm button is clicked', async () => {
  setupDom();
  const promise = showConfirmModal({ title: 'Delete?', message: 'Are you sure?', confirmLabel: 'Delete' });
  assert.equal(document.querySelector('.ek-modal-header h2').textContent, 'Delete?');
  assert.match(document.querySelector('.ek-modal-body').textContent, /Are you sure/);

  document.querySelector('.ek-btn-danger').click();
  assert.equal(await promise, true);
  assert.equal(document.querySelector('.ek-overlay'), null);

  teardownDom();
});

test('resolves false when cancelled', async () => {
  setupDom();
  const promise = showConfirmModal({ message: 'Sure?' });
  document.querySelector('.ek-btn-secondary').click();
  assert.equal(await promise, false);
  teardownDom();
});

test('resolves false when dismissed via Escape without clicking either button', async () => {
  setupDom();
  const promise = showConfirmModal({ message: 'Sure?' });
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(await promise, false);
  teardownDom();
});

test('uses the primary (non-danger) button style when danger is false', async () => {
  setupDom();
  const promise = showConfirmModal({ message: 'Continue?', danger: false, confirmLabel: 'Continue' });
  const confirmBtn = document.querySelector('.ek-btn-primary');
  assert.equal(confirmBtn.textContent, 'Continue');
  confirmBtn.click();
  assert.equal(await promise, true);
  teardownDom();
});
