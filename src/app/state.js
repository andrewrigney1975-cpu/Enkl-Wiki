import { loadStoredConfig, saveStoredConfig } from '../storage/local-storage.js';
import { createDefaultConfig } from '../storage/site-config.js';
import { createContentProvider } from '../storage/storage-provider.js';
import { createPage } from '../content/page-model.js';
import { ensureDefaultCredential } from '../auth/credential.js';

let config = null;
let provider = null;
const listeners = new Set();

function seedStarterContent(cfg) {
  const page = createPage({ title: 'Welcome', existingSlugs: [] });
  page.body = [
    '# Welcome to Enkl-Wiki',
    '',
    'This is your first page. It lives entirely in your browser\'s local storage',
    'until you export it.',
    '',
    'Enkl-Wiki is a 100% client-side wiki: pages, uploads and the site\'s',
    'structure never leave this device unless you choose to publish them.'
  ].join('\n');
  cfg.pages.push(page);
}

export async function initState() {
  const stored = loadStoredConfig();
  const isNew = !stored;
  config = stored || createDefaultConfig();
  if (isNew) seedStarterContent(config);
  if (!Array.isArray(config.uploads)) config.uploads = []; // back-compat with pre-uploads exports

  const hadCredential = Boolean(config.settings.credentialHash && config.settings.credentialSalt);
  await ensureDefaultCredential(config);
  if (isNew || !hadCredential) saveStoredConfig(config);

  provider = createContentProvider(config.settings.contentBackingProvider);
  return config;
}

export function getConfig() {
  return config;
}

export function getProvider() {
  return provider;
}

// Called after settings.contentBackingProvider changes so subsequent reads/
// writes use the newly selected provider.
export function refreshProvider() {
  provider = createContentProvider(config.settings.contentBackingProvider);
  return provider;
}

export function persist() {
  saveStoredConfig(config);
}

// Wholesale replacement used by JSON import — swaps in an entirely new
// config (and a matching content provider) rather than mutating the current one.
export function replaceConfig(newConfig) {
  config = newConfig;
  if (!Array.isArray(config.uploads)) config.uploads = [];
  saveStoredConfig(config);
  provider = createContentProvider(config.settings.contentBackingProvider);
  return config;
}

export function getPages() {
  return config.pages;
}

export function getTags() {
  return config.tags;
}

export function getUploads() {
  return config.uploads;
}

export function findPageBySlug(slug) {
  return config.pages.find((p) => p.slug === slug) || null;
}

export function findPageById(id) {
  return config.pages.find((p) => p.id === id) || null;
}

export function firstVisiblePage() {
  const visible = config.pages.filter((p) => !p.archived);
  return visible.find((p) => !p.parentId) || visible[0] || null;
}

// Lets UI modules re-render when page/tag/settings data changes elsewhere.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyChanged() {
  for (const fn of listeners) fn();
}
