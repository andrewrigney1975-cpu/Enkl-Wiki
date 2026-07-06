import {
  loadStoredConfig, saveStoredConfig, loadConnectionSettings, saveConnectionSettings, clearConnectionSettings
} from '../storage/local-storage.js';
import { createDefaultConfig, CONTENT_PROVIDER } from '../storage/site-config.js';
import { createContentProvider } from '../storage/storage-provider.js';
import { createPage as buildPage, deletePageWithChildren, moveSiblingPage as moveSiblingLocal, slugify } from '../content/page-model.js';
import { findOrCreateTag, unusedTags } from '../content/tag-model.js';
import { ensureDefaultCredential, getAuthToken } from '../auth/credential.js';
import { triggerDownload, saveBlob } from '../storage/file-io.js';
import { exportConfig } from '../storage/import-export.js';

let config = null;
let provider = null;
let apiBaseUrl = '';
const listeners = new Set();

function seedStarterContent(cfg) {
  const page = buildPage({ title: 'Welcome', existingSlugs: [] });
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

export function isRdbmsMode() {
  return Boolean(config && config.settings.contentBackingProvider === CONTENT_PROVIDER.RDBMS);
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

// Thin fetch wrapper for the rdbms mode's non-page-body endpoints (page
// bodies themselves go through the ContentProvider interface, same as the
// other two modes). Attaches the JWT obtained at login, if any.
async function apiFetch(path, { method = 'GET', body, isForm = false, skipAuth = false } = {}) {
  const headers = {};
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
  });

  if (!res.ok) {
    const err = new Error(`API request to ${path} failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// The API's UploadDto uses fileName/createdAt; the other two modes' uploads
// entries use filename/uploadedAt. Normalize to the latter so every call
// site (e.g. the page editor's upload picker) works unchanged across modes.
function normalizeUploads(apiUploads) {
  return apiUploads.map((u) => ({ filename: u.fileName, uploadedAt: u.createdAt }));
}

// Re-fetches the authoritative site state from the API after a mutation,
// rather than hand-merging each endpoint's response — simpler and always
// consistent with what the server actually persisted.
async function syncSiteFromApi() {
  const data = await apiFetch('/api/site');
  config.site.title = data.title;
  config.site.description = data.description;
  config.tags = data.tags;
  config.pages = data.pages;
  config.uploads = normalizeUploads(data.uploads);
}

export async function initState() {
  const connection = loadConnectionSettings();
  if (connection && connection.contentBackingProvider === CONTENT_PROVIDER.RDBMS) {
    apiBaseUrl = (connection.apiBaseUrl || '').replace(/\/+$/, '');
    const data = await apiFetch('/api/site');
    config = {
      site: { title: data.title, description: data.description },
      settings: { contentBackingProvider: CONTENT_PROVIDER.RDBMS, credentialSalt: null, credentialHash: null },
      tags: data.tags,
      pages: data.pages,
      uploads: normalizeUploads(data.uploads)
    };
    provider = createContentProvider(CONTENT_PROVIDER.RDBMS, { apiBaseUrl, getToken: getAuthToken });
    return config;
  }

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

// Called after settings.contentBackingProvider changes (embedded <-> filesystem
// only — switching to/from rdbms mode goes through connectToRdbms/
// disconnectFromRdbms below, which reload the page instead).
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

// Saves the connection pointer and reloads so the app re-boots straight into
// rdbms mode via initState()'s branch above — simplest way to guarantee every
// module (search index, tree view, editor) starts from a clean, consistent
// state rather than hot-swapping config/provider mid-session.
export function connectToRdbms(newApiBaseUrl) {
  saveConnectionSettings({ contentBackingProvider: CONTENT_PROVIDER.RDBMS, apiBaseUrl: newApiBaseUrl });
}

export function disconnectFromRdbms() {
  clearConnectionSettings();
}

// Reads every page's body through the *current* provider (whatever mode
// we're switching away from) and POSTs a full-fidelity payload to the new
// API's import endpoint — the on-ramp for moving an existing embedded/
// filesystem site into rdbms mode. Unlike the client's own exportConfig()
// (which can only serialize bodies already loaded in memory), this always
// fetches every page's real content first.
//
// POST /api/import is auth-gated on the server (it's a destructive
// replace-all), but the caller isn't logged into the *target* API yet at
// this point — that's a separate session from whatever unlocked the current
// mode. loginToApi() below gets a token for it first.
export async function migrateCurrentSiteTo(newApiBaseUrl, token) {
  const pages = [];
  for (const p of config.pages) {
    const body = await provider.getPageBody(p);
    pages.push({
      id: p.id, slug: p.slug, parentId: p.parentId, title: p.title,
      tagIds: p.tagIds || [], archived: Boolean(p.archived), body,
      createdAt: p.createdAt, updatedAt: p.updatedAt
    });
  }

  const payload = {
    site: { title: config.site.title, description: config.site.description },
    tags: config.tags,
    pages
  };

  const base = newApiBaseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Could not migrate site to ${base} (HTTP ${res.status}). Check the API Base URL and the credential entered for it.`);
  }
}

// Logs into an arbitrary API base URL (not necessarily the one currently
// connected, if any) — used both by the on-ramp above and by auth-modal.js
// once already in rdbms mode.
export async function loginToApi(newApiBaseUrl, credential) {
  const base = newApiBaseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  if (!res.ok) {
    const err = new Error(res.status === 401 ? 'That credential is not correct.' : `Could not reach the API (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.token;
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

function resolveTagNamesLocally(tagNames) {
  const tagIds = [];
  for (const raw of tagNames) {
    const tag = findOrCreateTag(config.tags, raw);
    if (tag && !tagIds.includes(tag.id)) tagIds.push(tag.id);
  }
  return tagIds;
}

// --- Semantic mutation functions -------------------------------------------
// Each of these does today's local-mutate-and-persist in embedded/filesystem
// mode, or awaits the matching API call (and re-syncs from the server) in
// rdbms mode. UI modules should call these instead of mutating getConfig()
// directly, so the same call sites work unchanged across all three modes.

export async function createPage({ title, parentId = null, tagNames = [] }) {
  if (isRdbmsMode()) {
    const created = await apiFetch('/api/pages', { method: 'POST', body: { title, parentId, tagNames } });
    await syncSiteFromApi();
    notifyChanged();
    return findPageById(created.id);
  }

  const page = buildPage({ title, parentId, existingSlugs: config.pages.map((p) => p.slug) });
  page.tagIds = resolveTagNamesLocally(tagNames);
  config.pages.push(page);
  persist();
  notifyChanged();
  return page;
}

export async function updatePageMetadata(page, { title, tagNames = [] }) {
  if (isRdbmsMode()) {
    await apiFetch(`/api/pages/${page.id}`, { method: 'PUT', body: { title, tagNames } });
    await syncSiteFromApi();
    notifyChanged();
    return findPageById(page.id);
  }

  page.title = title;
  page.tagIds = resolveTagNamesLocally(tagNames);
  page.updatedAt = new Date().toISOString();
  persist();
  notifyChanged();
  return page;
}

export async function reparentPage(page, newParentId) {
  if (isRdbmsMode()) {
    await apiFetch(`/api/pages/${page.id}/parent`, { method: 'PUT', body: { newParentId: newParentId || null } });
    await syncSiteFromApi();
  } else {
    page.parentId = newParentId || null;
    persist();
  }
  notifyChanged();
}

export async function movePageSibling(page, direction) {
  if (isRdbmsMode()) {
    await apiFetch(`/api/pages/${page.id}/move`, { method: 'PUT', body: { direction } });
    await syncSiteFromApi();
  } else {
    moveSiblingLocal(config.pages, page.id, direction);
    persist();
  }
  notifyChanged();
}

export async function setPageArchived(page, archived) {
  if (isRdbmsMode()) {
    await apiFetch(`/api/pages/${page.id}/archived`, { method: 'PUT', body: { archived } });
    await syncSiteFromApi();
  } else {
    page.archived = archived;
    persist();
  }
  notifyChanged();
}

export async function deletePage(page, resolution) {
  if (isRdbmsMode()) {
    await apiFetch(`/api/pages/${page.id}`, { method: 'DELETE', body: resolution });
    await syncSiteFromApi();
  } else {
    config.pages = deletePageWithChildren(config.pages, page.id, resolution);
    persist();
  }
  notifyChanged();
}

export async function saveSiteSettings({ title, description }) {
  if (isRdbmsMode()) {
    await apiFetch('/api/site', { method: 'PUT', body: { title, description } });
    await syncSiteFromApi();
  } else {
    config.site.title = title;
    config.site.description = description;
    persist();
  }
  notifyChanged();
}

export async function changeCredential(newCredential) {
  await apiFetch('/api/site/credential', { method: 'PUT', body: { newCredential } });
}

export async function removeUnusedTags() {
  if (isRdbmsMode()) {
    await apiFetch('/api/tags/unused', { method: 'DELETE' });
    await syncSiteFromApi();
  } else {
    const staleIds = new Set(unusedTags(config.tags, config.pages).map((t) => t.id));
    config.tags = config.tags.filter((t) => !staleIds.has(t.id));
    persist();
  }
  notifyChanged();
}

// Absolute URL in rdbms mode (the browser and API are usually different
// origins), relative path in the other two modes.
export function uploadUrlFor(filename) {
  return isRdbmsMode() ? `${apiBaseUrl}/api/uploads/${filename}` : `uploads/${filename}`;
}

export async function recordUpload(blob, filename) {
  if (isRdbmsMode()) {
    const form = new FormData();
    form.append('file', blob, filename);
    const uploaded = await apiFetch('/api/uploads', { method: 'POST', body: form, isForm: true });
    await syncSiteFromApi();
    notifyChanged();
    return { filename: uploaded.fileName, url: uploadUrlFor(uploaded.fileName) };
  }

  const result = await saveBlob(filename, blob, { mimeType: blob.type || 'application/octet-stream', description: 'Upload' });
  if (!config.uploads.some((u) => u.filename === result.filename)) {
    config.uploads.push({ filename: result.filename, uploadedAt: new Date().toISOString() });
  }
  persist();
  notifyChanged();
  return { filename: result.filename, url: uploadUrlFor(result.filename) };
}

export async function exportSiteData() {
  if (isRdbmsMode()) {
    const data = await apiFetch('/api/export', { skipAuth: true });
    const text = JSON.stringify(data, null, 2);
    const name = `${slugify(data?.site?.title) || 'enkl-wiki'}-export.json`;
    triggerDownload(name, new Blob([text], { type: 'application/json' }));
    return name;
  }
  return exportConfig(getConfig());
}
