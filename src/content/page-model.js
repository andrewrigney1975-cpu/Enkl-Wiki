export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Appends "-2", "-3", ... until the slug doesn't collide with existingSlugs.
export function uniqueSlug(baseSlug, existingSlugs) {
  const base = baseSlug || 'page';
  if (!existingSlugs.includes(base)) return base;
  let i = 2;
  while (existingSlugs.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function createPage({ title, parentId = null, tagIds = [], existingSlugs = [] }) {
  if (!title || !title.trim()) throw new Error('Page title is required');
  const now = new Date().toISOString();
  return {
    id: generateId(),
    slug: uniqueSlug(slugify(title), existingSlugs),
    parentId: parentId || null,
    title: title.trim(),
    tagIds: [...tagIds],
    archived: false,
    body: '',
    createdAt: now,
    updatedAt: now
  };
}

export function validatePage(page) {
  if (!page || typeof page !== 'object') throw new Error('Page must be an object');
  if (typeof page.id !== 'string' || !page.id) throw new Error('Page id is required');
  if (typeof page.slug !== 'string' || !page.slug) throw new Error('Page slug is required');
  if (typeof page.title !== 'string' || !page.title.trim()) throw new Error('Page title is required');
  if (page.parentId !== null && typeof page.parentId !== 'string') throw new Error('Page parentId must be a string or null');
  if (!Array.isArray(page.tagIds)) throw new Error('Page tagIds must be an array');
  return true;
}

// Builds a nested { ...page, children: [] } tree from a flat page list.
export function buildPageTree(pages) {
  const byId = new Map(pages.map((p) => [p.id, { ...p, children: [] }]));
  const roots = [];
  for (const page of byId.values()) {
    if (page.parentId && byId.has(page.parentId)) {
      byId.get(page.parentId).children.push(page);
    } else {
      roots.push(page);
    }
  }
  return roots;
}

export function getChildren(pages, parentId) {
  return pages.filter((p) => p.parentId === parentId);
}

// All descendant ids (children, grandchildren, ...) of pageId, flattened.
export function getDescendantIds(pages, pageId) {
  const result = [];
  const stack = [pageId];
  while (stack.length) {
    const current = stack.pop();
    for (const p of pages) {
      if (p.parentId === current) {
        result.push(p.id);
        stack.push(p.id);
      }
    }
  }
  return result;
}

// Sibling order is just array order among pages sharing a parentId — swaps
// the page with its previous/next sibling in place. No-op at either end.
export function moveSiblingPage(pages, pageId, direction) {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return;
  const siblingIndices = [];
  pages.forEach((p, i) => {
    if (p.parentId === page.parentId) siblingIndices.push(i);
  });
  const ownIndex = pages.indexOf(page);
  const posInSiblings = siblingIndices.indexOf(ownIndex);
  const swapWith = direction === 'up' ? posInSiblings - 1 : posInSiblings + 1;
  if (swapWith < 0 || swapWith >= siblingIndices.length) return;
  const a = siblingIndices[posInSiblings];
  const b = siblingIndices[swapWith];
  [pages[a], pages[b]] = [pages[b], pages[a]];
}

// Deletes pageId. If it has children, `resolution` decides their fate:
//  - { type: 'cascade' }: the page and all of its descendants are removed.
//  - { type: 'repoint', newParentId }: the top-most child is re-parented to
//    newParentId; any other direct children are nested under that child.
//  - { type: 'promote' }: the top-most child becomes a top-level page;
//    any other direct children are nested under that child.
// Returns a new array; pages are mutated in place (consistent with the rest
// of the app's page objects being mutated directly and persisted).
export function deletePageWithChildren(pages, pageId, resolution) {
  const children = getChildren(pages, pageId);

  if (children.length === 0 || resolution.type === 'cascade') {
    const toRemove = new Set([pageId, ...getDescendantIds(pages, pageId)]);
    return pages.filter((p) => !toRemove.has(p.id));
  }

  const [topMost, ...rest] = children;
  topMost.parentId = resolution.type === 'repoint' ? resolution.newParentId : null;
  for (const child of rest) {
    child.parentId = topMost.id;
  }

  return pages.filter((p) => p.id !== pageId);
}
