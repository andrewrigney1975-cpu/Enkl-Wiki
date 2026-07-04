import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { buildStandaloneHtml, exportPageAsHtml } from '../../src/content/page-export.js';

test('buildStandaloneHtml wraps rendered body HTML in a self-contained document with escaped title', () => {
  const html = buildStandaloneHtml('My <Page>', '<p>Hello <strong>world</strong></p>');
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>My &lt;Page&gt;<\/title>/);
  assert.match(html, /<h1>My &lt;Page&gt;<\/h1>/);
  assert.match(html, /<p>Hello <strong>world<\/strong><\/p>/);
  assert.match(html, /<style>/);
});

test('exportPageAsHtml triggers a download named after the page slug', () => {
  setupDom();
  const originalCreateElement = document.createElement.bind(document);
  let downloadedName = null;
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  const filename = exportPageAsHtml({ title: 'Getting Started', slug: 'getting-started' }, '<p>Body</p>');

  assert.equal(filename, 'getting-started.html');
  assert.equal(downloadedName, 'getting-started.html');
  teardownDom();
});
