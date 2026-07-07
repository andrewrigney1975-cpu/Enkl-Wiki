// The interactive advanced-table (spreadsheet) widget: hydrates a static
// `.ek-advtable` block (produced by markdown.js/advtable-render.js) into a
// live Excel-style grid — click a cell to edit its raw value/formula, a
// mini-toolbar for entering formulas, inserting SUM/COUNT/AVERAGE, adding
// rows/columns, filtering, and CSV export.
//
// The same widget is used both inside the WYSIWYG editor (where edits are
// serialized back into the page's Markdown on Save, via htmlToMarkdown()
// reading the live data-advtable attribute this module keeps in sync) and
// on the plain read-only page view (where anyone can play with values/
// formulas live in their own browser, but nothing here is ever persisted
// back to page storage — it's exactly as ephemeral as the existing table
// sort/filter controls in table-controls.js). Only an editor explicitly
// saving the page durably changes what's stored.
//
// Row sort is deliberately not offered here (unlike table-controls.js's
// plain tables): reordering rows would silently invalidate any formula that
// refers to an absolute row number, so the only view-only affordance this
// module offers is filtering (hides rows without moving anything) and CSV
// export, both non-destructive to the underlying grid.
import {
  colIndexToLabel, createModel, deserializeModel, serializeModel,
  getRawCell, setRawCell, addRow, addColumn
} from './advtable-model.js';
import { computeDisplayGrid } from './formula-engine.js';
import { renderStaticHtml } from './advtable-render.js';
import { inferColumnType, isCategorical, distinctValues, filterRows, exportTableAsCsv } from '../content/table-controls.js';
import { iconMarkup } from '../ui/icons.js';

export { renderStaticHtml, createModel };

const FUNCTIONS = ['SUM', 'COUNT', 'AVERAGE'];

// Builds the interactive UI inside an existing `.ek-advtable` wrapper
// element (already in the document, already carrying a valid data-advtable
// attribute) — reused as-is rather than replaced, so this element's
// identity/position in the DOM (and in htmlToMarkdown()'s node walk) never
// changes across a hydrate/edit/rebuild cycle.
function hydrateOne(wrapper, { filenameHint = 'sheet' } = {}) {
  let model = deserializeModel(wrapper.getAttribute('data-advtable') || '');

  const toolbar = document.createElement('div');
  toolbar.className = 'ek-advtable-toolbar';

  const fnButtons = FUNCTIONS.map((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ek-advtable-btn';
    btn.textContent = name;
    btn.title = `Insert ${name}(...)`;
    return btn;
  });

  const formulaInput = document.createElement('input');
  formulaInput.type = 'text';
  formulaInput.className = 'ek-advtable-formula-input';
  formulaInput.placeholder = 'Select a cell, or type a formula like =SUM(A1:A5)';

  const addRowBtn = document.createElement('button');
  addRowBtn.type = 'button';
  addRowBtn.className = 'ek-advtable-btn';
  addRowBtn.title = 'Add a row';
  addRowBtn.innerHTML = `${iconMarkup('plus', 13)}Row`;

  const addColBtn = document.createElement('button');
  addColBtn.type = 'button';
  addColBtn.className = 'ek-advtable-btn';
  addColBtn.title = 'Add a column';
  addColBtn.innerHTML = `${iconMarkup('plus', 13)}Col`;

  const filterToggleBtn = document.createElement('button');
  filterToggleBtn.type = 'button';
  filterToggleBtn.className = 'ek-advtable-btn ek-advtable-filter-toggle-btn';
  filterToggleBtn.title = 'Show/hide column filters';
  filterToggleBtn.innerHTML = iconMarkup('filter', 13);

  const clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'ek-advtable-btn ek-advtable-clear-filters-btn ek-hidden';
  clearFiltersBtn.title = 'Clear all column filters';
  clearFiltersBtn.innerHTML = iconMarkup('close', 13);

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-secondary ek-advtable-export-btn';
  exportBtn.innerHTML = `${iconMarkup('download', 13)}Export CSV`;

  toolbar.append(...fnButtons, formulaInput, addRowBtn, addColBtn, filterToggleBtn, clearFiltersBtn, exportBtn);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'ek-advtable-table-wrap';

  wrapper.innerHTML = '';
  wrapper.append(toolbar, tableWrap);

  // Persists across rebuilds (unlike the grid DOM itself, which is fully
  // rebuilt on every commit/add-row/add-column) — otherwise editing a cell
  // would silently reset any filters the reader/editor had already set.
  const filterState = { filters: [], visible: false };
  // Set by a mousedown-delegated listener on `wrapper` (fires before the
  // blur that commits the previously focused cell), so a click that moves
  // focus from one cell to another survives the full-grid rebuild the
  // commit triggers — without this, the freshly rebuilt DOM node for the
  // just-clicked cell would never actually receive focus.
  let pendingFocusRef = null;
  let activeRef = null;
  let cellInputs = [];

  function syncAttribute() {
    wrapper.setAttribute('data-advtable', serializeModel(model));
  }

  function getLiveInput(row, col) {
    return cellInputs[row] && cellInputs[row][col];
  }

  function commit(row, col, value, focusNext) {
    setRawCell(model, row, col, value);
    syncAttribute();
    render();
    const target = focusNext !== undefined ? focusNext : pendingFocusRef;
    pendingFocusRef = null;
    if (target) {
      const input = getLiveInput(target.row, target.col);
      if (input) {
        input.focus();
        input.select?.();
      }
    } else {
      activeRef = null;
      formulaInput.value = '';
    }
  }

  // Set just before programmatically refocusing a cell whose input value was
  // already deliberately set (e.g. by an Insert SUM/COUNT/AVERAGE click) —
  // without this, the focus handler's normal raw-source swap would stomp
  // that value with the (still uncommitted) old value from the model.
  let suppressFocusSwap = false;

  function handleCellFocus(row, col, input) {
    activeRef = { row, col };
    if (suppressFocusSwap) {
      suppressFocusSwap = false;
      formulaInput.value = input.value;
      return;
    }
    const raw = getRawCell(model, row, col);
    input.value = raw;
    formulaInput.value = raw;
  }

  function handleCellKeydown(e, row, col) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = e.shiftKey
        ? { row: Math.max(0, row - 1), col }
        : { row: Math.min(model.rows - 1, row + 1), col };
      commit(row, col, e.target.value, next);
    } else if (e.key === 'Escape') {
      e.target.value = getRawCell(model, row, col);
      e.target.blur();
    }
  }

  wrapper.addEventListener('mousedown', (e) => {
    const cell = e.target.closest && e.target.closest('.ek-advtable-cell-input');
    if (cell) {
      pendingFocusRef = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    } else if (!toolbar.contains(e.target)) {
      pendingFocusRef = null;
    }
  });

  formulaInput.addEventListener('input', () => {
    if (!activeRef) return;
    const live = getLiveInput(activeRef.row, activeRef.col);
    if (live && document.activeElement !== live) live.value = formulaInput.value;
  });
  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formulaInput.blur();
    }
  });
  formulaInput.addEventListener('blur', () => {
    if (!activeRef) return;
    // No explicit focusNext here (unlike Enter-in-a-cell's move-down) — a
    // plain blur just commits and deselects, falling back to whatever a
    // mousedown on another cell already queued in pendingFocusRef.
    commit(activeRef.row, activeRef.col, formulaInput.value);
  });

  fnButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (!activeRef) return;
      const name = FUNCTIONS[i];
      const live = getLiveInput(activeRef.row, activeRef.col);
      const current = live ? live.value : '';
      const insertion = `${name}()`;
      const next = current.startsWith('=') ? current + insertion : `=${insertion}`;
      if (live) live.value = next;
      formulaInput.value = next;
      if (live) {
        suppressFocusSwap = true;
        live.focus();
      } else {
        formulaInput.focus();
      }
    });
  });

  addRowBtn.addEventListener('click', () => {
    addRow(model);
    syncAttribute();
    render();
  });

  addColBtn.addEventListener('click', () => {
    addColumn(model);
    syncAttribute();
    render();
  });

  filterToggleBtn.addEventListener('click', () => {
    filterState.visible = !filterState.visible;
    render();
  });

  clearFiltersBtn.addEventListener('click', () => {
    filterState.filters = [];
    render();
  });

  function hasActiveFilters() {
    return filterState.filters.some(Boolean);
  }

  function render() {
    const grid = computeDisplayGrid(model);
    cellInputs = Array.from({ length: model.rows }, () => new Array(model.cols));

    const columnValues = Array.from({ length: model.cols }, (_, c) => grid.map((row) => row[c].display));
    const types = columnValues.map(inferColumnType);
    const categorical = columnValues.map((vals, i) => types[i] === 'text' && isCategorical(vals));

    const table = document.createElement('table');
    table.className = 'ek-advtable-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th')).className = 'ek-advtable-corner';
    for (let c = 0; c < model.cols; c++) {
      const th = document.createElement('th');
      th.textContent = colIndexToLabel(c);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

    const filterRow = document.createElement('tr');
    filterRow.className = 'ek-advtable-filter-row' + (filterState.visible ? '' : ' ek-hidden');
    filterRow.appendChild(document.createElement('th'));
    for (let c = 0; c < model.cols; c++) {
      const cell = document.createElement('th');
      const type = types[c];
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
        const existing = filterState.filters[c];
        if (existing) { min.value = existing.min || ''; max.value = existing.max || ''; }
        const onChange = () => {
          filterState.filters[c] = (min.value || max.value) ? { min: min.value, max: max.value } : undefined;
          render();
        };
        min.addEventListener('input', onChange);
        max.addEventListener('input', onChange);
        const wrap = document.createElement('div');
        wrap.className = 'ek-table-filter-range';
        wrap.append(min, max);
        cell.appendChild(wrap);
      } else if (categorical[c]) {
        const select = document.createElement('select');
        select.className = 'ek-table-filter-input';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All';
        select.appendChild(allOption);
        for (const value of distinctValues(columnValues[c])) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        }
        const existing = filterState.filters[c];
        if (existing && existing.exact !== undefined) select.value = existing.exact;
        select.addEventListener('change', () => {
          filterState.filters[c] = select.value ? { exact: select.value } : undefined;
          render();
        });
        cell.appendChild(select);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Filter…';
        input.className = 'ek-table-filter-input';
        const existing = filterState.filters[c];
        if (existing && existing.contains !== undefined) input.value = existing.contains;
        input.addEventListener('input', () => {
          filterState.filters[c] = input.value ? { contains: input.value } : undefined;
          render();
        });
        cell.appendChild(input);
      }
      filterRow.appendChild(cell);
    }
    thead.appendChild(filterRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const rowModels = grid.map((row, r) => ({ r, values: row.map((cell) => cell.display) }));
    const visibleRowSet = new Set(filterRows(rowModels, filterState.filters, types).map((m) => m.r));

    grid.forEach((row, r) => {
      const tr = document.createElement('tr');
      if (!visibleRowSet.has(r)) tr.style.display = 'none';
      const gutter = document.createElement('th');
      gutter.textContent = String(r + 1);
      tr.appendChild(gutter);

      row.forEach((cell, c) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ek-advtable-cell-input'
          + (cell.isError ? ' ek-advtable-error' : cell.isNumeric ? ' ek-advtable-numeric' : '');
        input.value = cell.display;
        input.dataset.row = String(r);
        input.dataset.col = String(c);
        input.addEventListener('focus', () => handleCellFocus(r, c, input));
        input.addEventListener('keydown', (e) => handleCellKeydown(e, r, c));
        input.addEventListener('blur', (e) => {
          // A mousedown-tracked move to another cell is handled by commit()
          // itself; a plain blur (e.g. clicking a toolbar button) has
          // already cleared pendingFocusRef by the time this runs.
          commit(r, c, e.target.value);
        });
        td.appendChild(input);
        cellInputs[r][c] = input;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);

    clearFiltersBtn.classList.toggle('ek-hidden', !hasActiveFilters());
    filterToggleBtn.classList.toggle('active', filterState.visible || hasActiveFilters());

    exportBtn.onclick = () => {
      const headers = Array.from({ length: model.cols }, (_, c) => colIndexToLabel(c));
      const visibleValues = grid
        .filter((_, r) => visibleRowSet.has(r))
        .map((row) => row.map((cell) => cell.display));
      exportTableAsCsv(headers, visibleValues, `${filenameHint}.csv`);
    };
  }

  render();

  return {
    getModel: () => model,
    setModel: (next) => { model = next; syncAttribute(); render(); }
  };
}

// Finds every `.ek-advtable` block inside `container` and hydrates it into
// the interactive widget, skipping any that are already hydrated (detected
// by the presence of the toolbar this function itself adds) — safe to call
// repeatedly, e.g. after every WYSIWYG re-render.
export function hydrateAdvancedTables(container, { filenameHint = 'sheet' } = {}) {
  const blocks = [...container.querySelectorAll('.ek-advtable')]
    .filter((el) => !el.querySelector('.ek-advtable-toolbar'));
  blocks.forEach((el, i) => {
    const hint = blocks.length > 1 ? `${filenameHint}-${i + 1}` : filenameHint;
    hydrateOne(el, { filenameHint: hint });
  });
}
