// Pure string-based static render of an advanced table model into an
// Excel-style grid (blank corner, column letters across the top, row
// numbers down the left) — mirrors markdown.js's other render* functions in
// returning a plain HTML string, not touching the DOM. Used for: (a) the
// initial render straight out of renderMarkdown(), and (b) the standalone
// HTML export fallback if a page is exported before the interactive widget
// has hydrated (see page-view.js's cleanBodyHtml capture).
import { colIndexToLabel, serializeModel } from './advtable-model.js';
import { computeDisplayGrid } from './formula-engine.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The data-advtable attribute is the single source of truth the interactive
// widget hydrates from and htmlToMarkdown() reads back out of — everything
// else here is just an inert preview of that data.
export function renderStaticHtml(model) {
  const grid = computeDisplayGrid(model);

  const headerCells = ['<th class="ek-advtable-corner"></th>']
    .concat(Array.from({ length: model.cols }, (_, c) => `<th>${colIndexToLabel(c)}</th>`))
    .join('');

  const bodyRows = grid.map((row, r) => {
    const dataCells = row.map((cell) => {
      const cls = cell.isError ? ' class="ek-advtable-error"' : cell.isNumeric ? ' class="ek-advtable-numeric"' : '';
      return `<td${cls}>${escapeHtml(cell.display)}</td>`;
    }).join('');
    return `<tr><th>${r + 1}</th>${dataCells}</tr>`;
  }).join('');

  const table = `<table class="ek-advtable-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  const dataAttr = escapeHtml(serializeModel(model));
  return `<div class="ek-advtable" data-advtable="${dataAttr}">${table}</div>`;
}
