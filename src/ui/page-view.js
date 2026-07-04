import { renderMarkdown } from '../content/markdown.js';
import { tagNamesForIds } from '../content/tag-model.js';
import { exportPageAsHtml } from '../content/page-export.js';
import { iconMarkup } from './icons.js';

// Guards against a slow provider.getPageBody() resolving after the user has
// already navigated elsewhere — only the most recently requested render wins.
let renderCounter = 0;

export async function renderPageView(container, { page, provider, tags = [] } = {}) {
  const token = ++renderCounter;

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

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-ghost ek-page-export-btn';
  exportBtn.title = 'Export this page as a standalone HTML file';
  exportBtn.innerHTML = iconMarkup('download', 16);

  titleRow.append(title, exportBtn);
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

  exportBtn.addEventListener('click', () => exportPageAsHtml(page, content.innerHTML));

  container.appendChild(article);
}
