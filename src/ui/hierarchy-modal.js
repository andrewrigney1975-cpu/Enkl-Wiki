import { openModal } from './modal.js';
import { showConfirmModal } from './confirm-modal.js';
import { showOrphanResolutionModal } from './orphan-resolution-modal.js';
import { showPageEditorModal } from './page-editor-modal.js';
import { iconMarkup } from './icons.js';
import { getChildren, getDescendantIds, buildPageTree } from '../content/page-model.js';
import { getPages, reparentPage, movePageSibling, setPageArchived, deletePage } from '../app/state.js';

export function showHierarchyModal() {
  const container = document.createElement('div');
  container.className = 'ek-hierarchy';

  const addRootBtn = document.createElement('button');
  addRootBtn.type = 'button';
  addRootBtn.className = 'ek-btn ek-btn-secondary';
  addRootBtn.innerHTML = `${iconMarkup('plus', 14)}New top-level page`;
  addRootBtn.addEventListener('click', () => {
    showPageEditorModal({ mode: 'create', parentId: null, onSaved: () => rerender() });
  });

  const listWrap = document.createElement('div');
  listWrap.className = 'ek-hierarchy-list';

  container.append(addRootBtn, listWrap);

  function candidateParentsFor(excludeId) {
    const excluded = new Set([excludeId, ...getDescendantIds(getPages(), excludeId)]);
    return getPages().filter((p) => !excluded.has(p.id));
  }

  async function handleDelete(page) {
    const children = getChildren(getPages(), page.id);
    if (children.length === 0) {
      const ok = await showConfirmModal({
        title: 'Delete page?',
        message: `Delete "${page.title}"? This cannot be undone.`,
        confirmLabel: 'Delete'
      });
      if (!ok) return;
      await deletePage(page, { type: 'cascade' });
      rerender();
      return;
    }

    showOrphanResolutionModal({
      page,
      candidateParents: candidateParentsFor(page.id),
      onResolve: async (resolution) => {
        await deletePage(page, resolution);
        rerender();
      }
    });
  }

  async function handleReparent(page, newParentId) {
    const forbidden = new Set([page.id, ...getDescendantIds(getPages(), page.id)]);
    if (forbidden.has(newParentId)) return;
    await reparentPage(page, newParentId || null);
    rerender();
  }

  async function handleMove(page, direction) {
    await movePageSibling(page, direction);
    rerender();
  }

  async function handleArchiveToggle(page) {
    await setPageArchived(page, !page.archived);
    rerender();
  }

  function iconButton(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ek-hierarchy-icon-btn';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = iconMarkup(icon, 15);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderRow(node, depth) {
    // buildPageTree() returns copies for display; every mutation below must
    // go through the real page object in config.pages, not this copy.
    const realPage = getPages().find((p) => p.id === node.id);

    const row = document.createElement('div');
    row.className = 'ek-hierarchy-row' + (node.archived ? ' ek-hierarchy-row-archived' : '');
    row.style.paddingLeft = `${depth * 20 + 10}px`;

    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'ek-hierarchy-title';
    title.textContent = node.title;
    title.addEventListener('click', () => showPageEditorModal({ mode: 'edit', page: realPage, onSaved: () => rerender() }));

    const parentSelect = document.createElement('select');
    parentSelect.className = 'ek-hierarchy-parent-select';
    const topOpt = document.createElement('option');
    topOpt.value = '';
    topOpt.textContent = 'Top level';
    if (!node.parentId) topOpt.selected = true;
    parentSelect.appendChild(topOpt);

    const forbidden = new Set([node.id, ...getDescendantIds(getPages(), node.id)]);
    for (const candidate of getPages()) {
      if (forbidden.has(candidate.id)) continue;
      const opt = document.createElement('option');
      opt.value = candidate.id;
      opt.textContent = candidate.title;
      if (candidate.id === node.parentId) opt.selected = true;
      parentSelect.appendChild(opt);
    }
    parentSelect.addEventListener('change', () => handleReparent(realPage, parentSelect.value));

    const upBtn = iconButton('arrowUp', 'Move up', () => handleMove(realPage, 'up'));
    const downBtn = iconButton('arrowDown', 'Move down', () => handleMove(realPage, 'down'));
    const archiveBtn = iconButton('archive', node.archived ? 'Unarchive' : 'Archive', () => handleArchiveToggle(realPage));
    archiveBtn.classList.toggle('active', node.archived);
    const deleteBtn = iconButton('trash', 'Delete', () => handleDelete(realPage));
    deleteBtn.classList.add('ek-hierarchy-danger-btn');

    row.append(title, parentSelect, upBtn, downBtn, archiveBtn, deleteBtn);
    return row;
  }

  function rerender() {
    listWrap.innerHTML = '';
    const tree = buildPageTree(getPages());

    function walk(nodes, depth) {
      for (const node of nodes) {
        listWrap.appendChild(renderRow(node, depth));
        if (node.children.length) walk(node.children, depth + 1);
      }
    }

    if (!tree.length) {
      listWrap.innerHTML = '<div class="ek-hierarchy-empty">No pages yet.</div>';
    } else {
      walk(tree, 0);
    }
  }

  rerender();

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'ek-btn ek-btn-secondary';
  doneBtn.textContent = 'Done';
  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.appendChild(doneBtn);

  const handle = openModal({ title: 'Edit Hierarchy', bodyNode: container, footerNode: footer, size: 'lg' });
  doneBtn.addEventListener('click', handle.close);
  return handle;
}
