import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { showAboutModal } from '../../src/ui/about-modal.js';
import { APP_VERSION } from '../../src/app/version.js';

test('showAboutModal displays the app name and version', () => {
  setupDom();
  showAboutModal();
  assert.match(document.querySelector('.ek-modal-header h2').textContent, /About/);
  assert.match(document.querySelector('.ek-about-name').textContent, /Enkl-Wiki/);
  assert.match(document.querySelector('.ek-about-version').textContent, new RegExp(APP_VERSION.replace(/[.]/g, '\\.')));
  teardownDom();
});
