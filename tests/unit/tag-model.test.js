import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTagName, parseTagTokens, findOrCreateTag, tagNamesForIds, unusedTags } from '../../src/content/tag-model.js';

test('normalizeTagName strips # and lowercases', () => {
  assert.equal(normalizeTagName('#DevOps'), 'devops');
  assert.equal(normalizeTagName('  Release Notes '), 'release-notes');
});

test('parseTagTokens extracts unique tags from markdown text', () => {
  const tags = parseTagTokens('This is #Important and also #important, plus #draft.');
  assert.deepEqual(tags.sort(), ['draft', 'important']);
});

test('findOrCreateTag reuses an existing tag by normalized name', () => {
  const tags = [{ id: 'a', name: 'infra' }];
  const tag = findOrCreateTag(tags, '#Infra');
  assert.equal(tag.id, 'a');
  assert.equal(tags.length, 1);
});

test('findOrCreateTag creates a new tag when none matches', () => {
  const tags = [];
  const tag = findOrCreateTag(tags, 'new-tag');
  assert.equal(tags.length, 1);
  assert.equal(tag.name, 'new-tag');
});

test('tagNamesForIds resolves ids to names', () => {
  const tags = [{ id: 'a', name: 'one' }, { id: 'b', name: 'two' }];
  assert.deepEqual(tagNamesForIds(tags, ['b', 'a']), ['two', 'one']);
});

test('unusedTags finds tags no page references', () => {
  const tags = [{ id: 'a', name: 'used' }, { id: 'b', name: 'unused' }];
  const pages = [{ tagIds: ['a'] }];
  assert.deepEqual(unusedTags(tags, pages).map((t) => t.id), ['b']);
});
