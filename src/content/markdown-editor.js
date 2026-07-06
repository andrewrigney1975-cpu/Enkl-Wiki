// Hand-rolled WYSIWYG Markdown editor. The WYSIWYG surface is a
// contenteditable div (using the browser's own execCommand primitives for
// bold/italic/list/etc. editing) that is round-tripped to/from Markdown via
// renderMarkdown() and htmlToMarkdown() below — there is no bundled rich-text
// library. A "Raw" toggle exposes the underlying Markdown directly in a
// textarea, per the spec's requirement to let editors see/edit the source.
import { renderMarkdown } from './markdown.js';
import { iconMarkup } from '../ui/icons.js';

export function htmlToMarkdown(root) {
  function walkChildren(node) {
    return [...node.childNodes].map(walk).join('');
  }

  function walk(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();
    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const level = Number(tag[1]);
        return `${'#'.repeat(level)} ${walkChildren(node).trim()}\n\n`;
      }
      case 'p': case 'div':
        return `${walkChildren(node).trim()}\n\n`;
      case 'strong': case 'b':
        return `**${walkChildren(node)}**`;
      case 'em': case 'i':
        return `*${walkChildren(node)}*`;
      case 'code':
        return node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre'
          ? walkChildren(node)
          : `\`${walkChildren(node)}\``;
      case 'pre': {
        const codeEl = node.querySelector('code');
        const langMatch = codeEl && codeEl.className.match(/language-(\S+)/);
        const lang = langMatch ? langMatch[1] : '';
        const text = (codeEl || node).textContent;
        return '```' + lang + '\n' + text + '\n```\n\n';
      }
      case 'a':
        return `[${walkChildren(node)}](${node.getAttribute('href') || ''})`;
      case 'img':
        return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
      case 'audio':
      case 'video':
        return `![${node.getAttribute('title') || ''}](${node.getAttribute('src') || ''})`;
      case 'ul':
        return [...node.children].map((li) => `- ${walk(li).trim()}`).join('\n') + '\n\n';
      case 'ol':
        return [...node.children].map((li, idx) => `${idx + 1}. ${walk(li).trim()}`).join('\n') + '\n\n';
      case 'li':
        return walkChildren(node);
      case 'blockquote':
        return walkChildren(node).trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
      case 'hr':
        return '---\n\n';
      case 'br':
        return '\n';
      case 'table': {
        const rows = [...node.querySelectorAll('tr')];
        if (!rows.length) return '';
        const cellText = (cell) => (walkChildren(cell).trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')) || ' ';
        const rowCells = (tr) => [...tr.children].map(cellText);
        const headerCells = rowCells(rows[0]);
        const bodyRows = rows.slice(1).map(rowCells);
        const lines = [
          `| ${headerCells.join(' | ')} |`,
          `| ${headerCells.map(() => '---').join(' | ')} |`,
          ...bodyRows.map((cells) => `| ${cells.join(' | ')} |`)
        ];
        // A width preference set via the table's floating toolbar (see
        // createMarkdownEditor below) round-trips as a marker comment so
        // renderMarkdown() can restore the ek-table-full class on reload.
        const marker = node.classList.contains('ek-table-full') ? '<!--full-width-->\n' : '';
        return marker + lines.join('\n') + '\n\n';
      }
      default:
        return walkChildren(node);
    }
  }

  const text = walk(root).replace(/\n{3,}/g, '\n\n').trim();
  return text ? text + '\n' : '';
}

const TOOLBAR_ACTIONS = [
  { icon: 'bold', title: 'Bold', command: 'bold' },
  { icon: 'italic', title: 'Italic', command: 'italic' },
  { icon: 'quote', title: 'Blockquote', command: 'formatBlock', value: 'blockquote' },
  { icon: 'listUl', title: 'Bulleted list', command: 'insertUnorderedList' },
  { icon: 'listOl', title: 'Numbered list', command: 'insertOrderedList' },
  { icon: 'code', title: 'Code block', command: 'formatBlock', value: 'pre' }
];

const HEADING_OPTIONS = [
  { value: '', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' }
];

const TABLE_PICKER_ROWS = 8;
const TABLE_PICKER_COLS = 8;

// rows/cols are 1-based and include the header row (row 1).
export function buildTableHtml(rows, cols) {
  const headerCells = Array.from({ length: cols }, (_, i) => `<th>Header ${i + 1}</th>`).join('');
  const bodyRows = Array.from({ length: Math.max(rows - 1, 0) }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('')}</tr>`
  ).join('');
  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
}

export function createMarkdownEditor({ initialValue = '' } = {}) {
  const root = document.createElement('div');
  root.className = 'ek-md-editor';

  const toolbar = document.createElement('div');
  toolbar.className = 'ek-md-toolbar';

  const wysiwyg = document.createElement('div');
  wysiwyg.className = 'ek-md-wysiwyg';
  wysiwyg.contentEditable = 'true';
  wysiwyg.innerHTML = renderMarkdown(initialValue);

  const raw = document.createElement('textarea');
  raw.className = 'ek-md-raw ek-hidden';
  raw.value = initialValue;

  let mode = 'wysiwyg';

  function runCommand(command, value) {
    wysiwyg.focus();
    if (typeof document.execCommand === 'function') {
      try {
        document.execCommand(command, false, value);
      } catch {
        /* execCommand unsupported in this environment */
      }
    }
  }

  const headingSelect = document.createElement('select');
  headingSelect.className = 'ek-md-heading-select';
  headingSelect.title = 'Heading level';
  for (const opt of HEADING_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    headingSelect.appendChild(option);
  }
  headingSelect.addEventListener('change', () => {
    runCommand('formatBlock', headingSelect.value || 'p');
    headingSelect.value = ''; // this toolbar doesn't track live cursor position/current block
  });
  toolbar.appendChild(headingSelect);

  for (const action of TOOLBAR_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ek-md-toolbar-btn';
    btn.title = action.title;
    btn.innerHTML = iconMarkup(action.icon, 15);
    btn.addEventListener('click', () => runCommand(action.command, action.value));
    toolbar.appendChild(btn);
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'ek-md-table-picker-wrap';

  const tableBtn = document.createElement('button');
  tableBtn.type = 'button';
  tableBtn.className = 'ek-md-toolbar-btn';
  tableBtn.title = 'Insert table';
  tableBtn.innerHTML = iconMarkup('table', 15);

  const tablePopover = document.createElement('div');
  tablePopover.className = 'ek-md-table-picker ek-hidden';

  const tableGrid = document.createElement('div');
  tableGrid.className = 'ek-md-table-grid';

  const tablePickerLabel = document.createElement('div');
  tablePickerLabel.className = 'ek-md-table-picker-label';
  tablePickerLabel.textContent = 'Insert table';

  const gridCells = [];
  function highlightGrid(row, col) {
    for (const cell of gridCells) {
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      cell.classList.toggle('active', r <= row && c <= col);
    }
    tablePickerLabel.textContent = `${row + 1} x ${col + 1}`;
  }

  function closeTablePicker() {
    tablePopover.classList.add('ek-hidden');
    for (const cell of gridCells) cell.classList.remove('active');
    tablePickerLabel.textContent = 'Insert table';
  }

  for (let r = 0; r < TABLE_PICKER_ROWS; r++) {
    for (let c = 0; c < TABLE_PICKER_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'ek-md-table-grid-cell';
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.addEventListener('mouseenter', () => highlightGrid(r, c));
      cell.addEventListener('click', () => {
        runCommand('insertHTML', buildTableHtml(r + 1, c + 1));
        closeTablePicker();
      });
      tableGrid.appendChild(cell);
      gridCells.push(cell);
    }
  }

  tableBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tablePopover.classList.toggle('ek-hidden');
  });
  document.addEventListener('click', (e) => {
    if (!tableWrap.contains(e.target)) closeTablePicker();
  });

  tablePopover.append(tableGrid, tablePickerLabel);
  tableWrap.append(tableBtn, tablePopover);
  toolbar.appendChild(tableWrap);

  // Floating per-table toolbar: appears near the top-left of whichever
  // table the cursor is currently inside, letting the editor pick between
  // "responsive" (sizes to content, the default) and "full width". Kept as
  // a sibling of wysiwyg rather than a child of it, so it never has to be
  // specially excluded from htmlToMarkdown()'s serialization walk.
  const tableToolbar = document.createElement('div');
  tableToolbar.className = 'ek-table-toolbar ek-hidden';

  const responsiveBtn = document.createElement('button');
  responsiveBtn.type = 'button';
  responsiveBtn.className = 'ek-table-toolbar-btn';
  responsiveBtn.title = 'Responsive width (fits content)';
  responsiveBtn.innerHTML = iconMarkup('tableResponsive', 14);

  const fullWidthBtn = document.createElement('button');
  fullWidthBtn.type = 'button';
  fullWidthBtn.className = 'ek-table-toolbar-btn';
  fullWidthBtn.title = 'Full width';
  fullWidthBtn.innerHTML = iconMarkup('tableFull', 14);

  tableToolbar.append(responsiveBtn, fullWidthBtn);

  let focusedTable = null;

  function updateTableToolbarButtons() {
    const isFull = Boolean(focusedTable && focusedTable.classList.contains('ek-table-full'));
    responsiveBtn.classList.toggle('active', !isFull);
    fullWidthBtn.classList.toggle('active', isFull);
  }

  function positionTableToolbar() {
    if (!focusedTable) return;
    const rootRect = root.getBoundingClientRect();
    const tableRect = focusedTable.getBoundingClientRect();
    tableToolbar.style.top = `${tableRect.top - rootRect.top + 4}px`;
    tableToolbar.style.left = `${tableRect.left - rootRect.left + 4}px`;
  }

  function hideTableToolbar() {
    focusedTable = null;
    tableToolbar.classList.add('ek-hidden');
  }

  // Re-derives which table (if any) the cursor is in from the live
  // selection — there's no "current block" tracking elsewhere in this
  // editor, so this mirrors the heading dropdown's own approach of just
  // reacting to explicit events rather than continuously watching state.
  function refreshTableToolbar() {
    if (mode !== 'wysiwyg') return;
    const sel = document.getSelection();
    let node = sel && sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    const table = node && node.closest && wysiwyg.contains(node) ? node.closest('table') : null;
    if (!table) {
      hideTableToolbar();
      return;
    }
    focusedTable = table;
    tableToolbar.classList.remove('ek-hidden');
    updateTableToolbarButtons();
    positionTableToolbar();
  }

  responsiveBtn.addEventListener('click', () => {
    if (!focusedTable) return;
    focusedTable.classList.remove('ek-table-full');
    updateTableToolbarButtons();
  });

  fullWidthBtn.addEventListener('click', () => {
    if (!focusedTable) return;
    focusedTable.classList.add('ek-table-full');
    updateTableToolbarButtons();
  });

  wysiwyg.addEventListener('click', refreshTableToolbar);
  wysiwyg.addEventListener('keyup', refreshTableToolbar);
  wysiwyg.addEventListener('scroll', positionTableToolbar);
  document.addEventListener('selectionchange', () => {
    // jsdom (in tests) dispatches selectionchange asynchronously, so this
    // can still fire after a test has torn its jsdom globals back down —
    // `typeof` is the only reference to `document` that can't itself throw.
    if (typeof document === 'undefined') return;
    if (document.activeElement === wysiwyg) refreshTableToolbar();
  });
  // Matches the table-insert popover's own click-outside pattern above.
  document.addEventListener('click', (e) => {
    if (!wysiwyg.contains(e.target) && !tableToolbar.contains(e.target)) hideTableToolbar();
  });

  const modeToggle = document.createElement('button');
  modeToggle.type = 'button';
  modeToggle.className = 'ek-md-toolbar-btn ek-md-mode-toggle';
  modeToggle.textContent = 'View Markdown';
  modeToggle.addEventListener('click', () => {
    hideTableToolbar();
    if (mode === 'wysiwyg') {
      raw.value = htmlToMarkdown(wysiwyg);
      wysiwyg.classList.add('ek-hidden');
      raw.classList.remove('ek-hidden');
      mode = 'raw';
      modeToggle.textContent = 'View Rendered';
    } else {
      wysiwyg.innerHTML = renderMarkdown(raw.value);
      raw.classList.add('ek-hidden');
      wysiwyg.classList.remove('ek-hidden');
      mode = 'wysiwyg';
      modeToggle.textContent = 'View Markdown';
    }
  });
  toolbar.appendChild(modeToggle);

  root.append(toolbar, wysiwyg, raw, tableToolbar);

  function getValue() {
    return mode === 'raw' ? raw.value : htmlToMarkdown(wysiwyg);
  }

  function setValue(markdown) {
    hideTableToolbar();
    if (mode === 'raw') raw.value = markdown;
    else wysiwyg.innerHTML = renderMarkdown(markdown);
  }

  // Inserts a Markdown snippet (e.g. an uploaded image/diagram reference).
  // Cursor-position insertion is supported in raw mode; in WYSIWYG mode the
  // snippet is appended, since a toolbar click typically isn't preceded by
  // an in-editor text selection to insert at.
  function insertText(snippet) {
    if (mode === 'raw') {
      const start = raw.selectionStart ?? raw.value.length;
      const end = raw.selectionEnd ?? raw.value.length;
      raw.value = raw.value.slice(0, start) + snippet + raw.value.slice(end);
      raw.focus();
      raw.selectionStart = raw.selectionEnd = start + snippet.length;
    } else {
      hideTableToolbar();
      wysiwyg.innerHTML += renderMarkdown(snippet);
    }
  }

  return { root, getValue, setValue, insertText };
}
