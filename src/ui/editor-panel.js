// The panel shown to the right of the page editor: a Markdown cheat sheet,
// or a quick reference list of existing pages/uploads (to copy link/image
// syntax from), toggled by the tabs at the top.
function escapeText(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

const CHEAT_SHEET_ROWS = [
  ['# Heading', 'Heading level 1-6 (#, ##, ###, ...)'],
  ['**bold**', 'Bold text'],
  ['*italic*', 'Italic text'],
  ['`code`', 'Inline code'],
  ['[text](url)', 'Link (use #!/slug for another page)'],
  ['![alt](uploads/file.png)', 'Image / audio / video, chosen by file extension'],
  ['- item', 'Bulleted list'],
  ['1. item', 'Numbered list'],
  ['&gt; quote', 'Blockquote'],
  ['```js ... ```', 'Fenced code block'],
  ['#tag', 'Tag this page (also used by search)']
];

function renderCheatSheet(content) {
  content.innerHTML = `<dl class="ek-cheatsheet">${CHEAT_SHEET_ROWS.map(([syntax, desc]) =>
    `<dt><code>${syntax}</code></dt><dd>${desc}</dd>`).join('')}</dl>`;
}

function renderPagesAndUploads(content, { pages, uploads }) {
  const pageItems = pages.length
    ? pages.map((p) => `<li><code>[${escapeText(p.title)}](#!/${escapeText(p.slug)})</code></li>`).join('')
    : '<li class="ek-editor-panel-empty">No pages yet.</li>';
  const uploadItems = uploads.length
    ? uploads.map((u) => `<li><code>![](uploads/${escapeText(u)})</code></li>`).join('')
    : '<li class="ek-editor-panel-empty">No uploads yet.</li>';
  content.innerHTML = `
    <div class="ek-editor-panel-group"><h4>Pages</h4><ul>${pageItems}</ul></div>
    <div class="ek-editor-panel-group"><h4>Uploads</h4><ul>${uploadItems}</ul></div>
  `;
}

export function createEditorPanel({ pages = [], uploads = [] } = {}) {
  const root = document.createElement('div');
  root.className = 'ek-editor-panel';

  const tabs = document.createElement('div');
  tabs.className = 'ek-editor-panel-tabs';

  const cheatTab = document.createElement('button');
  cheatTab.type = 'button';
  cheatTab.className = 'ek-editor-panel-tab active';
  cheatTab.textContent = 'Cheat Sheet';

  const listTab = document.createElement('button');
  listTab.type = 'button';
  listTab.className = 'ek-editor-panel-tab';
  listTab.textContent = 'Pages & Uploads';

  tabs.append(cheatTab, listTab);

  const content = document.createElement('div');
  content.className = 'ek-editor-panel-content';

  cheatTab.addEventListener('click', () => {
    cheatTab.classList.add('active');
    listTab.classList.remove('active');
    renderCheatSheet(content);
  });
  listTab.addEventListener('click', () => {
    listTab.classList.add('active');
    cheatTab.classList.remove('active');
    renderPagesAndUploads(content, { pages, uploads });
  });

  renderCheatSheet(content);
  root.append(tabs, content);
  return root;
}
