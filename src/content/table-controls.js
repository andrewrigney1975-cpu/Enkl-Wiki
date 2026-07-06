// Adds interactive sorting, filtering and CSV export to a rendered Markdown
// table (see markdown.js) when a page is viewed. Column data types are
// inferred once from the table's own values so the right control shows up
// per column: a min/max range for numbers and ISO dates, a dropdown for a
// text column with only a few distinct values, and a free-text search box
// for everything else.
import { triggerDownload } from '../storage/file-io.js';
import { iconMarkup } from '../ui/icons.js';

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
// Day-first slash dates (14/1/2012, 22/09/1975, 01/11/1975, ...) — the
// common non-US convention. 1- or 2-digit day/month, 4-digit year, tolerant
// of stray spaces around the slashes (e.g. "14 / 1 / 2012").
const SLASH_DATE_RE = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/;
const CATEGORICAL_MAX_DISTINCT = 6;

export function parseNumber(value) {
  const trimmed = String(value ?? '').trim();
  return NUMBER_RE.test(trimmed) ? Number(trimmed) : null;
}

export function parseDateValue(value) {
  const trimmed = String(value ?? '').trim();

  if (ISO_DATE_RE.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slashMatch = trimmed.match(SLASH_DATE_RE);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    // Date rolls invalid combos like day 31 of a 30-day month into the next
    // month instead of throwing — check it landed on the day we asked for.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  return null;
}

// 'number'/'date' only when *every* non-empty value in the column fits;
// a single stray non-numeric value (e.g. "N/A") falls the whole column
// back to 'text' rather than silently dropping that row from comparisons.
export function inferColumnType(values) {
  const nonEmpty = values.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (nonEmpty.length === 0) return 'text';
  if (nonEmpty.every((v) => NUMBER_RE.test(v))) return 'number';
  if (nonEmpty.every((v) => parseDateValue(v) !== null)) return 'date';
  return 'text';
}

export function distinctValues(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

// A text column is "categorical" when its values actually repeat (at least
// one duplicate) into a handful of distinct buckets — not merely when a
// small table happens to have few rows, which would make almost every
// column in a small table look "categorical" by distinct-count alone.
export function isCategorical(values) {
  const nonEmpty = values.map((v) => String(v ?? '').trim()).filter(Boolean);
  const distinct = distinctValues(values);
  return distinct.length > 1 && distinct.length <= CATEGORICAL_MAX_DISTINCT && distinct.length < nonEmpty.length;
}

// Only called once both values are known-parsable for number/date columns —
// unparsable values are placed last by sortRows itself, independent of
// direction (see below), rather than being folded into this comparison.
function compareByType(a, b, type) {
  if (type === 'number') return parseNumber(a) - parseNumber(b);
  if (type === 'date') return parseDateValue(a).getTime() - parseDateValue(b).getTime();
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

function isUnparsable(value, type) {
  if (type === 'number') return parseNumber(value) === null;
  if (type === 'date') return parseDateValue(value) === null;
  return false;
}

// Rows are `{ values: string[], ... }` — any extra properties (e.g. a DOM
// element reference) pass through untouched, which is what lets the same
// function serve both plain-data tests and the live DOM wiring below.
// direction 'none' returns the rows in their original (input) order, which
// is how "no sort" reverts to the table's original data order.
export function sortRows(rows, columnIndex, direction, types) {
  if (direction !== 'asc' && direction !== 'desc') return rows.slice();
  const type = types[columnIndex];
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const av = a.row.values[columnIndex];
      const bv = b.row.values[columnIndex];
      const aBad = isUnparsable(av, type);
      const bBad = isUnparsable(bv, type);
      // Unparsable values sort last no matter the direction — this check
      // must happen before the direction flip below, not inside it.
      if (aBad || bBad) return aBad && bBad ? a.i - b.i : aBad ? 1 : -1;
      const cmp = compareByType(av, bv, type);
      const signed = direction === 'desc' ? -cmp : cmp;
      return signed !== 0 ? signed : a.i - b.i; // stable tie-break
    })
    .map((entry) => entry.row);
}

// `filters` is a sparse array (one slot per column, or undefined) of either
// `{ contains }` (text search), `{ exact }` (categorical dropdown), or
// `{ min, max }` (number/date range — either bound may be omitted).
export function filterRows(rows, filters, types) {
  if (!filters || !filters.length) return rows.slice();
  return rows.filter((row) => row.values.every((value, colIndex) => {
    const filter = filters[colIndex];
    if (!filter) return true;
    const type = types[colIndex];

    if (type === 'number' || type === 'date') {
      const parse = type === 'number' ? parseNumber : parseDateValue;
      const parsed = parse(value);
      if (parsed === null) return false;
      if (filter.min !== undefined && filter.min !== '') {
        const min = parse(filter.min);
        if (min !== null && parsed < min) return false;
      }
      if (filter.max !== undefined && filter.max !== '') {
        const max = parse(filter.max);
        if (max !== null && parsed > max) return false;
      }
      return true;
    }

    if (filter.exact !== undefined) return filter.exact === '' || value === filter.exact;
    if (filter.contains !== undefined) return value.toLowerCase().includes(filter.contains.toLowerCase());
    return true;
  }));
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function rowsToCsv(headers, rows) {
  return [headers, ...rows].map((cells) => cells.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function exportTableAsCsv(headers, rows, filename = 'table.csv') {
  const csv = rowsToCsv(headers, rows);
  triggerDownload(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  return filename;
}

// Wires sorting, filtering and CSV export onto a single already-rendered
// <table> (from markdown.js's renderTable). Mutates the table in place and
// wraps it with a small toolbar; does nothing to malformed/empty tables.
export function enhanceTable(table, { filenameHint = 'table' } = {}) {
  const thead = table.querySelector('thead');
  const headerRow = thead && thead.querySelector('tr');
  const tbody = table.querySelector('tbody');
  if (!headerRow || !tbody || !tbody.children.length) return;

  const headerCells = [...headerRow.children];
  const headers = headerCells.map((th) => th.textContent.trim());
  const rowModels = [...tbody.children].map((el) => ({
    el,
    values: [...el.children].map((td) => td.textContent.trim())
  }));

  const columnCount = headers.length;
  const columnValues = Array.from({ length: columnCount }, (_, c) => rowModels.map((r) => r.values[c]));
  const types = columnValues.map(inferColumnType);
  const categorical = columnValues.map((vals, i) => types[i] === 'text' && isCategorical(vals));

  const state = { sortColumn: null, sortDirection: 'none', filters: new Array(columnCount) };
  let visibleValues = rowModels.map((r) => r.values);

  function cycleSort(colIndex) {
    if (state.sortColumn !== colIndex) {
      state.sortColumn = colIndex;
      state.sortDirection = 'asc';
    } else if (state.sortDirection === 'asc') {
      state.sortDirection = 'desc';
    } else {
      state.sortColumn = null;
      state.sortDirection = 'none';
    }
    update();
  }

  const sortIndicators = headerCells.map((th, colIndex) => {
    th.classList.add('ek-table-sortable');
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');
    const indicator = document.createElement('span');
    indicator.className = 'ek-table-sort-indicator';
    th.appendChild(indicator);
    th.addEventListener('click', () => cycleSort(colIndex));
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleSort(colIndex);
      }
    });
    return indicator;
  });

  function updateSortIndicators() {
    sortIndicators.forEach((indicator, colIndex) => {
      const active = state.sortColumn === colIndex && state.sortDirection !== 'none';
      indicator.innerHTML = active ? iconMarkup(state.sortDirection === 'asc' ? 'arrowUp' : 'arrowDown', 12) : '';
    });
  }

  const filterRow = document.createElement('tr');
  filterRow.className = 'ek-table-filter-row ek-hidden'; // collapsed until the filter toolbar button is clicked
  const filterResetters = [];
  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    const cell = document.createElement('th');
    const type = types[colIndex];

    if (type === 'number' || type === 'date') {
      const inputType = type === 'number' ? 'number' : 'date';
      const min = document.createElement('input');
      min.type = inputType;
      min.placeholder = 'Min';
      min.className = 'ek-table-filter-input';
      const max = document.createElement('input');
      max.type = inputType;
      max.placeholder = 'Max';
      max.className = 'ek-table-filter-input';
      const wrap = document.createElement('div');
      wrap.className = 'ek-table-filter-range';
      wrap.append(min, max);
      const onChange = () => {
        state.filters[colIndex] = (min.value || max.value) ? { min: min.value, max: max.value } : undefined;
        update();
      };
      min.addEventListener('input', onChange);
      max.addEventListener('input', onChange);
      cell.appendChild(wrap);
      filterResetters.push(() => { min.value = ''; max.value = ''; });
    } else if (categorical[colIndex]) {
      const select = document.createElement('select');
      select.className = 'ek-table-filter-input';
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All';
      select.appendChild(allOption);
      for (const value of distinctValues(columnValues[colIndex])) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        state.filters[colIndex] = select.value ? { exact: select.value } : undefined;
        update();
      });
      cell.appendChild(select);
      filterResetters.push(() => { select.value = ''; });
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Filter…';
      input.className = 'ek-table-filter-input';
      input.addEventListener('input', () => {
        state.filters[colIndex] = input.value ? { contains: input.value } : undefined;
        update();
      });
      cell.appendChild(input);
      filterResetters.push(() => { input.value = ''; });
    }
    filterRow.appendChild(cell);
  }
  thead.appendChild(filterRow);

  function hasActiveFilters() {
    return state.filters.some(Boolean);
  }

  function update() {
    const visible = sortRows(filterRows(rowModels, state.filters, types), state.sortColumn, state.sortDirection, types);
    const visibleSet = new Set(visible);
    for (const model of rowModels) model.el.style.display = visibleSet.has(model) ? '' : 'none';
    for (const model of visible) tbody.appendChild(model.el);
    visibleValues = visible.map((m) => m.values);
    updateSortIndicators();
    clearFiltersBtn.classList.toggle('ek-hidden', !hasActiveFilters());
    filterToggleBtn.classList.toggle('active', !filterRow.classList.contains('ek-hidden') || hasActiveFilters());
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'ek-table-enhanced';
  table.parentNode.insertBefore(wrapper, table);

  const toolbarRow = document.createElement('div');
  toolbarRow.className = 'ek-table-toolbar-row';

  const filterToggleBtn = document.createElement('button');
  filterToggleBtn.type = 'button';
  filterToggleBtn.className = 'ek-table-toolbar-btn ek-table-filter-toggle-btn';
  filterToggleBtn.title = 'Show/hide column filters';
  filterToggleBtn.innerHTML = iconMarkup('filter', 14);
  filterToggleBtn.addEventListener('click', () => {
    filterRow.classList.toggle('ek-hidden');
    filterToggleBtn.classList.toggle('active', !filterRow.classList.contains('ek-hidden') || hasActiveFilters());
  });

  const clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'ek-table-toolbar-btn ek-table-clear-filters-btn ek-hidden';
  clearFiltersBtn.title = 'Clear all column filters';
  clearFiltersBtn.innerHTML = iconMarkup('close', 14);
  clearFiltersBtn.addEventListener('click', () => {
    state.filters = new Array(columnCount);
    for (const reset of filterResetters) reset();
    update();
  });

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-secondary ek-table-export-btn';
  exportBtn.innerHTML = `${iconMarkup('download', 14)}Export CSV`;
  exportBtn.addEventListener('click', () => exportTableAsCsv(headers, visibleValues, `${filenameHint}.csv`));

  toolbarRow.append(filterToggleBtn, clearFiltersBtn, exportBtn);
  wrapper.append(toolbarRow, table);

  update();
}
