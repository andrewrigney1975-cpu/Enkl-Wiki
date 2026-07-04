import { generateId } from './page-model.js';

export function normalizeTagName(raw) {
  return String(raw || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

// Extracts every "#tag" token referenced in a block of Markdown, deduplicated.
export function parseTagTokens(text) {
  const matches = String(text || '').match(/#([a-z0-9][a-z0-9-]*)/gi) || [];
  return [...new Set(matches.map((m) => normalizeTagName(m)))];
}

export function findTagByName(tags, name) {
  const normalized = normalizeTagName(name);
  return tags.find((t) => t.name === normalized) || null;
}

// Mutates `tags` in place, adding a new entry only if one doesn't already exist.
export function findOrCreateTag(tags, name) {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;
  let tag = findTagByName(tags, normalized);
  if (!tag) {
    tag = { id: generateId(), name: normalized };
    tags.push(tag);
  }
  return tag;
}

export function tagNamesForIds(tags, tagIds) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  return tagIds.map((id) => byId.get(id)?.name).filter(Boolean);
}

// Tags no longer referenced by any page — safe to drop from the central registry.
export function unusedTags(tags, pages) {
  const used = new Set(pages.flatMap((p) => p.tagIds || []));
  return tags.filter((t) => !used.has(t.id));
}
