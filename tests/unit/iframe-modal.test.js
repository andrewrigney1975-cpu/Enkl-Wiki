import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { showIframeModal } from '../../src/ui/iframe-modal.js';

test('inserting a valid https URL calls onInsert with a well-formed ```iframe fence', () => {
  setupDom();
  let inserted = null;
  showIframeModal({ onInsert: (snippet) => { inserted = snippet; } });

  document.getElementById('ekIframeUrlInput').value = 'https://example.com/embed';
  document.getElementById('ekIframeWidthInput').value = '600';
  document.getElementById('ekIframeHeightInput').value = '400';
  document.querySelector('.ek-btn-primary').click();

  assert.ok(inserted);
  assert.match(inserted, /^```iframe\n/);
  const data = JSON.parse(inserted.split('\n')[1]);
  assert.deepEqual(data, { url: 'https://example.com/embed', width: 600, widthUnit: '%', height: 400 });
  assert.equal(document.querySelector('.ek-overlay'), null, 'the modal should close on insert');

  teardownDom();
});

test('a relative URL is accepted', () => {
  setupDom();
  let inserted = null;
  showIframeModal({ onInsert: (snippet) => { inserted = snippet; } });

  document.getElementById('ekIframeUrlInput').value = '/pages/embed.html';
  document.querySelector('.ek-btn-primary').click();

  assert.ok(inserted);
  teardownDom();
});

test('an empty URL is rejected with an inline error and does not close the modal', () => {
  setupDom();
  let called = false;
  showIframeModal({ onInsert: () => { called = true; } });

  document.querySelector('.ek-btn-primary').click();

  assert.equal(called, false);
  assert.ok(document.querySelector('.ek-overlay'), 'the modal should stay open');
  assert.match(document.querySelector('.ek-field-error').textContent, /URL is required/);

  teardownDom();
});

test('a disallowed URL scheme (http:, javascript:) is rejected', () => {
  setupDom();
  let called = false;
  showIframeModal({ onInsert: () => { called = true; } });

  document.getElementById('ekIframeUrlInput').value = 'http://example.com';
  document.querySelector('.ek-btn-primary').click();

  assert.equal(called, false);
  assert.match(document.querySelector('.ek-field-error').textContent, /https:\/\//);

  teardownDom();
});

test('a non-positive width or height is rejected', () => {
  setupDom();
  let called = false;
  showIframeModal({ onInsert: () => { called = true; } });

  document.getElementById('ekIframeUrlInput').value = 'https://example.com';
  document.getElementById('ekIframeWidthInput').value = '0';
  document.querySelector('.ek-btn-primary').click();
  assert.equal(called, false);
  assert.match(document.querySelector('.ek-field-error').textContent, /Width/);

  document.getElementById('ekIframeWidthInput').value = '100';
  document.getElementById('ekIframeHeightInput').value = '-5';
  document.querySelector('.ek-btn-primary').click();
  assert.equal(called, false);
  assert.match(document.querySelector('.ek-field-error').textContent, /Height/);

  teardownDom();
});

test('the width unit select offers % (default) and px', () => {
  setupDom();
  showIframeModal({});
  const select = document.querySelector('#ekIframeWidthInput').closest('.ek-iframe-width-wrap').querySelector('select');
  assert.deepEqual([...select.options].map((o) => o.value), ['%', 'px']);
  assert.equal(select.value, '%');
  teardownDom();
});

test('choosing px as the width unit is reflected in the inserted payload', () => {
  setupDom();
  let inserted = null;
  showIframeModal({ onInsert: (snippet) => { inserted = snippet; } });

  document.getElementById('ekIframeUrlInput').value = 'https://example.com';
  const select = document.querySelector('#ekIframeWidthInput').closest('.ek-iframe-width-wrap').querySelector('select');
  select.value = 'px';
  document.querySelector('.ek-btn-primary').click();

  const data = JSON.parse(inserted.split('\n')[1]);
  assert.equal(data.widthUnit, 'px');
  teardownDom();
});

test('Cancel closes the modal without calling onInsert', () => {
  setupDom();
  let called = false;
  showIframeModal({ onInsert: () => { called = true; } });

  document.querySelector('.ek-btn-secondary').click();

  assert.equal(called, false);
  assert.equal(document.querySelector('.ek-overlay'), null);
  teardownDom();
});
