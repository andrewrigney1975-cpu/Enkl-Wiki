import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';

test('getCurrentSlug parses #!/slug from the URL hash', async () => {
  setupDom('http://localhost/#!/getting-started');
  const { getCurrentSlug } = await import('../../src/app/router.js');
  assert.equal(getCurrentSlug(), 'getting-started');
  teardownDom();
});

test('getCurrentSlug returns an empty string for a bare or missing hash', async () => {
  setupDom('http://localhost/');
  const { getCurrentSlug } = await import('../../src/app/router.js');
  assert.equal(getCurrentSlug(), '');
  teardownDom();
});

test('navigateToSlug sets a hashbang URL and initRouter reacts to the resulting hashchange', async () => {
  const dom = setupDom('http://localhost/');
  const { navigateToSlug, initRouter } = await import('../../src/app/router.js');

  const seen = [];
  initRouter((slug) => seen.push(slug));
  assert.deepEqual(seen, ['']); // initial synchronous call with the current (empty) slug

  navigateToSlug('about-us');
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(dom.window.location.hash, '#!/about-us');
  assert.deepEqual(seen, ['', 'about-us']);

  teardownDom();
});
