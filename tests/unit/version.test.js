import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatVersion } from '../../src/app/version.js';

test('formatVersion produces MAJOR.MINOR.YYYYMMDD.HHMM', () => {
  const date = new Date(2026, 6, 4, 9, 5); // 2026-07-04 09:05
  assert.equal(formatVersion(1, 3, date), '1.3.20260704.0905');
});
