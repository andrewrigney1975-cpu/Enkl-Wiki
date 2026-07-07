import { renderMarkdown } from '../content/markdown.js';
import { tagNamesForIds } from '../content/tag-model.js';
import { exportPageAsHtml } from '../content/page-export.js';
import { slugify } from '../content/page-model.js';
import { enhanceTable } from '../content/table-controls.js';
import { hydrateAdvancedTables } from '../advtable/advtable-widget.js';
import { iconMarkup } from './icons.js';

// Guards against a slow provider.getPageBody() resolving after the user has
// already navigated elsewhere — only the most recently requested render wins.
let renderCounter = 0;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Renders in the viewer's own local time zone (plain Date getters, not the
// UTC variants) using a fixed 24-hour HH:MM plus a full month name — no
// locale-dependent formatting, so "03/04/2026" ambiguity (is that March 4th
// or April 3rd?) can't happen.
function formatLastUpdated(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `Last Updated : ${hh}:${mm} ${dd}, ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

// Cleans up the previous page's scroll listener before a new one is
// attached — renderPageView reuses the same container element across
// navigations (only its innerHTML is replaced), so listeners added directly
// to it would otherwise stack up indefinitely.
let cleanupTocScrollListener = null;

// Assigns a stable, unique id to each h2/h3 in the rendered body and returns
// the outline used to build the "on this page" panel — mirroring the table
// of contents a documentation site generates from its own headings.
function buildTocOutline(contentEl) {
  const headings = [...contentEl.querySelectorAll('h2, h3')];
  const seen = new Set();
  return headings.map((el) => {
    const base = slugify(el.textContent) || 'section';
    let id = base;
    let i = 2;
    while (seen.has(id)) id = `${base}-${i++}`;
    seen.add(id);
    el.id = id;
    return { el, text: el.textContent, level: el.tagName === 'H3' ? 3 : 2 };
  });
}

function renderTocPane(outline, scrollContainer) {
  const aside = document.createElement('aside');
  aside.className = 'ek-toc-pane';

  const title = document.createElement('div');
  title.className = 'ek-toc-title';
  title.textContent = 'On this page';

  const nav = document.createElement('nav');
  nav.className = 'ek-toc-list';

  const links = outline.map((item) => {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'ek-toc-link' + (item.level === 3 ? ' ek-toc-link-sub' : '');
    link.textContent = item.text;
    // A real `href="#id"` would collide with the app's own #!/slug hashbang
    // router, so navigation is done imperatively instead.
    link.addEventListener('click', () => {
      item.el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    return { link, item };
  });

  nav.append(...links.map((l) => l.link));
  aside.append(title, nav);

  // Highlights whichever heading is currently nearest the top of the
  // scrolling viewport — a lightweight scrollspy that doesn't depend on
  // IntersectionObserver (not implemented in the jsdom test environment).
  function updateActiveLink() {
    const containerTop = scrollContainer.getBoundingClientRect().top;
    let current = null;
    for (const { item } of links) {
      if (item.el.getBoundingClientRect().top - containerTop <= 80) current = item;
    }
    for (const { link, item } of links) {
      link.classList.toggle('active', item === current);
    }
  }

  scrollContainer.addEventListener('scroll', updateActiveLink);
  cleanupTocScrollListener = () => scrollContainer.removeEventListener('scroll', updateActiveLink);
  updateActiveLink();

  return aside;
}

export async function renderPageView(container, { page, provider, tags = [] } = {}) {
  const token = ++renderCounter;

  cleanupTocScrollListener?.();
  cleanupTocScrollListener = null;

  if (!page) {
    container.innerHTML = '<div class="ek-placeholder">No page selected yet.</div>';
    return;
  }

  container.innerHTML = '<div class="ek-placeholder">Loading&hellip;</div>';
  const body = await provider.getPageBody(page);
  if (token !== renderCounter) return; // superseded by a newer navigation

  const tagNames = tagNamesForIds(tags, page.tagIds || []);

  container.innerHTML = '';
  container.dataset.pageId = page.id;

  const article = document.createElement('article');
  article.className = 'ek-page';

  if (page.archived) {
    const banner = document.createElement('div');
    banner.className = 'ek-archived-banner';
    banner.textContent = 'This page is archived — it is hidden from the page tree.';
    article.appendChild(banner);
  }

  const titleRow = document.createElement('div');
  titleRow.className = 'ek-page-title-row';

  const title = document.createElement('h1');
  title.className = 'ek-page-title';
  title.textContent = page.title;

  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'ek-btn ek-btn-ghost ek-page-print-btn';
  printBtn.title = 'Print this page or save it as a PDF';
  printBtn.innerHTML = iconMarkup('print', 16);
  printBtn.addEventListener('click', () => window.print());

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-ghost ek-page-export-btn';
  exportBtn.title = 'Export this page as a standalone HTML file';
  exportBtn.innerHTML = iconMarkup('download', 16);

  const titleActions = document.createElement('div');
  titleActions.className = 'ek-page-title-actions';

  const lastUpdatedText = page.updatedAt ? formatLastUpdated(page.updatedAt) : null;
  if (lastUpdatedText) {
    const lastUpdated = document.createElement('span');
    lastUpdated.className = 'ek-page-last-updated';
    lastUpdated.textContent = lastUpdatedText;
    titleActions.appendChild(lastUpdated);
  }

  titleActions.append(printBtn, exportBtn);

  titleRow.append(title, titleActions);
  article.appendChild(titleRow);

  if (tagNames.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'ek-page-tags';
    tagRow.innerHTML = tagNames.map((n) => `<span class="ek-tag-chip">#${n}</span>`).join('');
    article.appendChild(tagRow);
  }

  const content = document.createElement('div');
  content.className = 'ek-page-body';
  content.innerHTML = renderMarkdown(body);
  article.appendChild(content);

  // Captured before table enhancement below adds interactive sort/filter/
  // export controls to the live DOM — the standalone HTML export should stay
  // exactly what renderMarkdown() produced, since those controls are inert
  // without this module's JS wiring.
  const cleanBodyHtml = content.innerHTML;
  exportBtn.addEventListener('click', () => exportPageAsHtml(page, cleanBodyHtml));

  const tables = [...content.querySelectorAll('table:not(.ek-advtable-table)')];
  tables.forEach((table, i) => {
    const filenameHint = tables.length > 1 ? `${page.slug || 'table'}-table-${i + 1}` : `${page.slug || 'table'}`;
    enhanceTable(table, { filenameHint });
  });

  // Anyone reading the page can play with an advanced table's values/
  // formulas live in their own browser (add rows/columns, edit cells,
  // filter) — same as the plain-table sort/filter controls above, none of
  // this is ever written back to page storage; only an editor explicitly
  // saving the page durably changes what's stored.
  hydrateAdvancedTables(content, { filenameHint: page.slug || 'sheet' });

  const outline = buildTocOutline(content);
  if (outline.length) {
    const layout = document.createElement('div');
    layout.className = 'ek-page-view-layout';
    layout.appendChild(article);
    layout.appendChild(renderTocPane(outline, container));
    container.appendChild(layout);
  } else {
    container.appendChild(article);
  }
}
