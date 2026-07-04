import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { exportConfig, importConfigFromFile } from '../../src/storage/import-export.js';
import { createDefaultConfig } from '../../src/storage/site-config.js';

test('exportConfig triggers a download named after the site title', () => {
  setupDom();
  const originalCreateElement = document.createElement.bind(document);
  let downloadedName = null;
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { downloadedName = el.download; };
    return el;
  };

  const config = createDefaultConfig();
  config.site.title = 'My Wiki';
  const name = exportConfig(config);

  assert.equal(name, 'my-wiki-export.json');
  assert.equal(downloadedName, 'my-wiki-export.json');
  teardownDom();
});

test('importConfigFromFile parses and validates a config file', async () => {
  const config = createDefaultConfig();
  const file = new File([JSON.stringify(config)], 'export.json', { type: 'application/json' });
  const imported = await importConfigFromFile(file);
  assert.deepEqual(imported, config);
});

test('importConfigFromFile rejects invalid JSON', async () => {
  const file = new File(['not json'], 'export.json', { type: 'application/json' });
  await assert.rejects(() => importConfigFromFile(file), /not valid JSON/);
});

test('importConfigFromFile rejects a JSON file that is not a config export', async () => {
  const file = new File([JSON.stringify({ foo: 'bar' })], 'export.json', { type: 'application/json' });
  await assert.rejects(() => importConfigFromFile(file), /does not look like/);
});
