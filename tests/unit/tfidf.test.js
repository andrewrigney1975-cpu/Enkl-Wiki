import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildIndex, search, cosineSimilarity, vectorizeQuery } from '../../src/search/tfidf.js';

test('tokenize lowercases and splits on non-alphanumeric characters', () => {
  assert.deepEqual(tokenize('Hello, World! 123'), ['hello', 'world', '123']);
  assert.deepEqual(tokenize(''), []);
});

test('search finds an exact strong match above the 15% threshold', () => {
  const index = buildIndex([
    { id: 'a', text: 'The quick brown fox jumps over the lazy dog' },
    { id: 'b', text: 'Completely unrelated content about databases and servers' }
  ]);
  const results = search(index, 'quick brown fox');
  assert.equal(results[0].id, 'a');
  assert.ok(results[0].score >= 0.15);
  assert.ok(!results.some((r) => r.id === 'b'));
});

test('search returns no results for a query with no vocabulary overlap', () => {
  const index = buildIndex([{ id: 'a', text: 'apples and oranges' }]);
  assert.deepEqual(search(index, 'zzz nonexistent term'), []);
});

test('search returns nothing for an empty or whitespace-only query', () => {
  const index = buildIndex([{ id: 'a', text: 'some content here' }]);
  assert.deepEqual(search(index, ''), []);
  assert.deepEqual(search(index, '   '), []);
});

test('results are sorted best match first', () => {
  const index = buildIndex([
    { id: 'weak', text: 'apple banana cherry date fig grape apple mention' },
    { id: 'strong', text: 'apple apple apple apple' }
  ]);
  const results = search(index, 'apple');
  assert.equal(results[0].id, 'strong');
});

test('term frequency is normalized by document length (a short focused doc beats a long diluted one)', () => {
  const longDoc = `widget ${'filler '.repeat(50)}`;
  const shortDoc = 'widget widget';
  const index = buildIndex([{ id: 'long', text: longDoc }, { id: 'short', text: shortDoc }]);
  const results = search(index, 'widget');
  assert.equal(results[0].id, 'short');
});

test('cosineSimilarity of a vector with itself is 1', () => {
  const index = buildIndex([{ id: 'a', text: 'alpha beta gamma' }]);
  const vec = vectorizeQuery('alpha beta gamma', index.idf);
  assert.ok(Math.abs(cosineSimilarity(vec, index.vectors.get('a')) - 1) < 1e-9);
});
