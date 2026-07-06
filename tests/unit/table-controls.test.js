import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferColumnType, distinctValues, isCategorical, sortRows, filterRows, rowsToCsv, parseNumber, parseDateValue
} from '../../src/content/table-controls.js';

test('inferColumnType recognizes an all-numeric column, including negatives and decimals', () => {
  assert.equal(inferColumnType(['1', '-2.5', '3']), 'number');
});

test('inferColumnType recognizes an all-ISO-date column', () => {
  assert.equal(inferColumnType(['2024-01-01', '2024-12-31']), 'date');
});

test('inferColumnType recognizes ISO datetimes too', () => {
  assert.equal(inferColumnType(['2024-01-01T10:30', '2024-01-02T00:00:00']), 'date');
});

test('inferColumnType recognizes day-first slash dates (D/M/YYYY, 1- or 2-digit day/month)', () => {
  assert.equal(inferColumnType(['14/1/2012', '22/09/1975', '01/11/1975']), 'date');
});

test('inferColumnType falls back to text when even one value does not fit', () => {
  assert.equal(inferColumnType(['1', '2', 'N/A']), 'text');
  assert.equal(inferColumnType(['2024-01-01', 'ongoing']), 'text');
});

test('inferColumnType treats an all-empty column as text', () => {
  assert.equal(inferColumnType(['', '  ', '']), 'text');
});

test('distinctValues dedupes and ignores blanks', () => {
  assert.deepEqual(distinctValues(['a', 'b', 'a', '', 'b']), ['a', 'b']);
});

test('isCategorical is true for a small number of repeated distinct values, false otherwise', () => {
  assert.equal(isCategorical(['open', 'closed', 'open', 'open', 'closed']), true);
  assert.equal(isCategorical(['a', 'b', 'c', 'd', 'e', 'f', 'g']), false); // too many distinct
  assert.equal(isCategorical(['only-one', 'only-one']), false); // not worth a dropdown
});

test('isCategorical is false when a small table just happens to have few, all-distinct values', () => {
  // A small table's text column shouldn't be mistaken for categorical just
  // because it has few rows — every value here is unique, not repeated.
  assert.equal(isCategorical(['Apple', 'Banana', 'Grape']), false);
});

test('parseNumber and parseDateValue reject values that do not match', () => {
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseDateValue('not a date'), null);
  assert.ok(parseDateValue('2024-06-01') instanceof Date);
});

test('parseDateValue reads D/M/YYYY slash dates as day-first', () => {
  const d = parseDateValue('14/1/2012');
  assert.equal(d.getFullYear(), 2012);
  assert.equal(d.getMonth(), 0); // January
  assert.equal(d.getDate(), 14);

  const d2 = parseDateValue('22/09/1975');
  assert.equal(d2.getFullYear(), 1975);
  assert.equal(d2.getMonth(), 8); // September
  assert.equal(d2.getDate(), 22);
});

test('parseDateValue tolerates stray spaces around the slashes', () => {
  const d = parseDateValue('14 / 1 / 2012');
  assert.equal(d.getFullYear(), 2012);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 14);
});

test('parseDateValue rejects a slash date with an out-of-range day or month', () => {
  assert.equal(parseDateValue('32/1/2012'), null); // no day 32
  assert.equal(parseDateValue('1/13/2012'), null); // no month 13
  assert.equal(parseDateValue('31/4/2012'), null); // April has 30 days — would otherwise roll into May
});

test('sortRows sorts day-first slash dates chronologically, not as text', () => {
  const input = rows(['14/1/2012'], ['22/09/1975'], ['01/11/1975']);
  assert.deepEqual(
    sortRows(input, 0, 'asc', ['date']).map((r) => r.values[0]),
    ['22/09/1975', '01/11/1975', '14/1/2012']
  );
});

function rows(...valuesList) {
  return valuesList.map((values) => ({ values }));
}

test('sortRows "none" direction returns the original order unchanged (revert behavior)', () => {
  const input = rows(['3'], ['1'], ['2']);
  const result = sortRows(input, 0, 'none', ['number']);
  assert.deepEqual(result.map((r) => r.values[0]), ['3', '1', '2']);
});

test('sortRows sorts numeric columns ascending and descending', () => {
  const input = rows(['30'], ['5'], ['100']);
  assert.deepEqual(sortRows(input, 0, 'asc', ['number']).map((r) => r.values[0]), ['5', '30', '100']);
  assert.deepEqual(sortRows(input, 0, 'desc', ['number']).map((r) => r.values[0]), ['100', '30', '5']);
});

test('sortRows sorts date columns chronologically', () => {
  const input = rows(['2024-03-01'], ['2023-01-01'], ['2024-01-15']);
  assert.deepEqual(
    sortRows(input, 0, 'asc', ['date']).map((r) => r.values[0]),
    ['2023-01-01', '2024-01-15', '2024-03-01']
  );
});

test('sortRows sorts text columns case-insensitively', () => {
  const input = rows(['banana'], ['Apple'], ['cherry']);
  assert.deepEqual(sortRows(input, 0, 'asc', ['text']).map((r) => r.values[0]), ['Apple', 'banana', 'cherry']);
});

test('sortRows is a stable sort (equal keys keep their relative order)', () => {
  const input = [{ values: ['1'], tag: 'a' }, { values: ['1'], tag: 'b' }, { values: ['1'], tag: 'c' }];
  const result = sortRows(input, 0, 'asc', ['number']);
  assert.deepEqual(result.map((r) => r.tag), ['a', 'b', 'c']);
});

test('sortRows places unparsable values last regardless of direction', () => {
  const input = rows(['5'], ['N/A'], ['1']);
  assert.deepEqual(sortRows(input, 0, 'asc', ['number']).map((r) => r.values[0]), ['1', '5', 'N/A']);
  assert.deepEqual(sortRows(input, 0, 'desc', ['number']).map((r) => r.values[0]), ['5', '1', 'N/A']);
});

test('filterRows with no active filters returns all rows', () => {
  const input = rows(['a'], ['b']);
  assert.equal(filterRows(input, [], ['text']).length, 2);
  assert.equal(filterRows(input, undefined, ['text']).length, 2);
});

test('filterRows applies a text "contains" filter case-insensitively', () => {
  const input = rows(['Apple'], ['Banana'], ['Grape']);
  const result = filterRows(input, [{ contains: 'AP' }], ['text']);
  assert.deepEqual(result.map((r) => r.values[0]), ['Apple', 'Grape']);
});

test('filterRows applies a categorical "exact" filter', () => {
  const input = rows(['open'], ['closed'], ['open']);
  const result = filterRows(input, [{ exact: 'open' }], ['text']);
  assert.deepEqual(result.map((r) => r.values[0]), ['open', 'open']);
});

test('filterRows applies a numeric min/max range, excluding unparsable values', () => {
  const input = rows(['5'], ['15'], ['25'], ['N/A']);
  const result = filterRows(input, [{ min: '10', max: '20' }], ['number']);
  assert.deepEqual(result.map((r) => r.values[0]), ['15']);
});

test('filterRows applies a date range with only a min or only a max bound', () => {
  const input = rows(['2024-01-01'], ['2024-06-01'], ['2024-12-01']);
  assert.deepEqual(
    filterRows(input, [{ min: '2024-05-01' }], ['date']).map((r) => r.values[0]),
    ['2024-06-01', '2024-12-01']
  );
  assert.deepEqual(
    filterRows(input, [{ max: '2024-06-01' }], ['date']).map((r) => r.values[0]),
    ['2024-01-01', '2024-06-01']
  );
});

test('filterRows combines independently across columns', () => {
  const input = [
    { values: ['Alice', '30'] },
    { values: ['Bob', '40'] },
    { values: ['Alicia', '50'] }
  ];
  const result = filterRows(input, [{ contains: 'ali' }, { min: '40' }], ['text', 'number']);
  assert.deepEqual(result.map((r) => r.values[0]), ['Alicia']);
});

test('rowsToCsv quotes fields containing commas, quotes or newlines and doubles internal quotes', () => {
  const csv = rowsToCsv(['Name', 'Note'], [['Alice', 'says "hi", bye'], ['Bob', 'line1\nline2']]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Name,Note');
  assert.equal(lines[1], 'Alice,"says ""hi"", bye"');
  assert.equal(lines[2], 'Bob,"line1\nline2"');
});

test('rowsToCsv leaves plain fields unquoted', () => {
  const csv = rowsToCsv(['A', 'B'], [['1', '2']]);
  assert.equal(csv, 'A,B\r\n1,2\r\n');
});
