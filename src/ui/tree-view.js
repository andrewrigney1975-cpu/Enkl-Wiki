import { buildPageTree } from '../content/page-model.js';
import { navigateToSlug } from '../app/router.js';
import { iconMarkup } from './icons.js';

// Which non-leaf nodes are collapsed, by page id. Module-level so the state
// survives re-renders triggered by navigation.
const collapsed = new Set();

export function renderTree(container, { pages, activeId } = {}) {
  function rerender() {
    renderTree(container, { pages, activeId });
  }

  function renderNode(node) {
    const li = document.createElement('li');
    li.className = 'ek-tree-node';

    const row = document.createElement('div');
    row.className = 'ek-tree-row' + (node.id === activeId ? ' active' : '');

    const hasChildren = node.children.length > 0;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ek-tree-toggle';
    if (hasChildren) {
      toggle.innerHTML = iconMarkup(collapsed.has(node.id) ? 'chevronRight' : 'chevronDown', 14);
      toggle.setAttribute('aria-label', collapsed.has(node.id) ? 'Expand' : 'Collapse');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collapsed.has(node.id)) collapsed.delete(node.id);
        else collapsed.add(node.id);
        rerender();
      });
    } else {
      toggle.classList.add('ek-tree-toggle-spacer');
      toggle.disabled = true;
    }

    const label = document.createElement('span');
    label.className = 'ek-tree-label';
    label.textContent = node.title;

    row.append(toggle, label);
    row.addEventListener('click', () => navigateToSlug(node.slug));
    li.appendChild(row);

    if (hasChildren && !collapsed.has(node.id)) {
      const ul = document.createElement('ul');
      ul.className = 'ek-tree-children';
      for (const child of node.children) ul.appendChild(renderNode(child));
      li.appendChild(ul);
    }

    return li;
  }

  container.innerHTML = '';
  const visible = (pages || []).filter((p) => !p.archived);
  const tree = buildPageTree(visible);

  if (!tree.length) {
    container.innerHTML = '<div class="ek-tree-empty">No pages yet.</div>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'ek-tree-root';
  for (const node of tree) ul.appendChild(renderNode(node));
  container.appendChild(ul);
}
