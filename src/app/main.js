import { initTheme, toggleTheme, currentTheme } from '../ui/theme.js';
import { iconMarkup } from '../ui/icons.js';
import { showAboutModal } from '../ui/about-modal.js';
import { showAuthModal } from '../ui/auth-modal.js';
import { showPageEditorModal } from '../ui/page-editor-modal.js';
import { showHierarchyModal } from '../ui/hierarchy-modal.js';
import { showSiteSettingsModal } from '../ui/site-settings-modal.js';
import { isUnlocked, setUnlocked, setAuthToken } from '../auth/credential.js';
import {
  initState, getConfig, getProvider, getPages, getTags, findPageBySlug, firstVisiblePage, subscribe, exportSiteData
} from './state.js';
import { initRouter, navigateToSlug, getCurrentSlug } from './router.js';
import { renderTree } from '../ui/tree-view.js';
import { renderPageView } from '../ui/page-view.js';
import { createSearchBox } from '../ui/search-box.js';

function renderHeader({ onToggleLock, onOpenSettings, onToggleMenu, searchBoxRoot }) {
  const header = document.createElement('header');
  header.className = 'ek-header';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'ek-header-btn ek-mobile-menu-btn';
  menuBtn.setAttribute('aria-label', 'Open pages menu');
  menuBtn.innerHTML = iconMarkup('menu', 18);
  menuBtn.addEventListener('click', onToggleMenu);

  const logo = document.createElement('div');
  logo.className = 'ek-logo';
  logo.innerHTML = `${iconMarkup('pencil', 20)}<span>Enkl-Wiki</span>`;

  const spacer = document.createElement('div');
  spacer.className = 'ek-header-spacer';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'ek-header-btn ek-hidden';
  settingsBtn.setAttribute('aria-label', 'Site settings');
  settingsBtn.title = 'Site settings';
  settingsBtn.innerHTML = iconMarkup('settings', 16);
  settingsBtn.addEventListener('click', onOpenSettings);

  const lockBtn = document.createElement('button');
  lockBtn.type = 'button';
  lockBtn.className = 'ek-header-btn';
  lockBtn.addEventListener('click', onToggleLock);

  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'ek-header-btn ek-theme-toggle';
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.innerHTML = iconMarkup(currentTheme() === 'dark' ? 'sun' : 'moon', 16);
  themeBtn.addEventListener('click', () => {
    const next = toggleTheme();
    themeBtn.innerHTML = iconMarkup(next === 'dark' ? 'sun' : 'moon', 16);
  });

  const aboutBtn = document.createElement('button');
  aboutBtn.type = 'button';
  aboutBtn.className = 'ek-header-btn';
  aboutBtn.setAttribute('aria-label', 'About');
  aboutBtn.innerHTML = iconMarkup('help', 16);
  aboutBtn.addEventListener('click', showAboutModal);

  header.append(menuBtn, logo, searchBoxRoot, spacer, settingsBtn, lockBtn, themeBtn, aboutBtn);
  return { header, lockBtn, settingsBtn };
}

export async function renderApp(root) {
  initTheme();
  await initState();
  root.innerHTML = '';

  let currentPage = null;

  function refreshLockBtn() {
    const unlocked = isUnlocked();
    lockBtn.innerHTML = iconMarkup(unlocked ? 'unlock' : 'lock', 16);
    lockBtn.title = unlocked ? 'Editing unlocked (click to lock)' : 'Unlock editing';
    lockBtn.setAttribute('aria-label', lockBtn.title);
    settingsBtn.classList.toggle('ek-hidden', !unlocked);
  }

  function handleToggleLock() {
    if (isUnlocked()) {
      setUnlocked(false);
      setAuthToken(null);
      refreshLockBtn();
      renderCurrentRoute();
    } else {
      showAuthModal({ config: getConfig(), onUnlocked: () => { refreshLockBtn(); renderCurrentRoute(); } });
    }
  }

  const searchBox = createSearchBox({ getPages, getTags, getProvider });

  function closeMobileMenu() {
    treePane.classList.remove('open');
    backdrop.classList.remove('open');
  }

  const { header, lockBtn, settingsBtn } = renderHeader({
    onToggleLock: handleToggleLock,
    onOpenSettings: () => showSiteSettingsModal(),
    onToggleMenu: () => {
      treePane.classList.toggle('open');
      backdrop.classList.toggle('open');
    },
    searchBoxRoot: searchBox.root
  });
  root.appendChild(header);

  const backdrop = document.createElement('div');
  backdrop.className = 'ek-drawer-backdrop';
  backdrop.addEventListener('click', closeMobileMenu);
  root.appendChild(backdrop);

  const body = document.createElement('div');
  body.className = 'ek-app-body';

  const toolStrip = document.createElement('nav');
  toolStrip.className = 'ek-toolstrip';
  toolStrip.setAttribute('aria-label', 'Editor tools');

  const newPageBtn = document.createElement('button');
  newPageBtn.type = 'button';
  newPageBtn.className = 'ek-toolstrip-btn';
  newPageBtn.title = 'New page';
  newPageBtn.innerHTML = iconMarkup('plus', 18);
  newPageBtn.addEventListener('click', () => {
    showPageEditorModal({
      mode: 'create',
      parentId: currentPage ? currentPage.id : null,
      onSaved: (page) => navigateToSlug(page.slug)
    });
  });

  const editPageBtn = document.createElement('button');
  editPageBtn.type = 'button';
  editPageBtn.className = 'ek-toolstrip-btn';
  editPageBtn.title = 'Edit page';
  editPageBtn.innerHTML = iconMarkup('edit', 18);
  editPageBtn.addEventListener('click', () => {
    if (!currentPage) return;
    showPageEditorModal({ mode: 'edit', page: currentPage, onSaved: () => renderCurrentRoute() });
  });

  const hierarchyBtn = document.createElement('button');
  hierarchyBtn.type = 'button';
  hierarchyBtn.className = 'ek-toolstrip-btn';
  hierarchyBtn.title = 'Edit hierarchy';
  hierarchyBtn.innerHTML = iconMarkup('folder', 18);
  hierarchyBtn.addEventListener('click', () => showHierarchyModal());

  const exportDataBtn = document.createElement('button');
  exportDataBtn.type = 'button';
  exportDataBtn.className = 'ek-toolstrip-btn';
  exportDataBtn.title = 'Export Data';
  exportDataBtn.innerHTML = iconMarkup('download', 18);
  exportDataBtn.addEventListener('click', () => exportSiteData());

  toolStrip.append(newPageBtn, editPageBtn, hierarchyBtn, exportDataBtn);

  const treePane = document.createElement('nav');
  treePane.className = 'ek-tree-pane';
  treePane.setAttribute('aria-label', 'Pages');

  const mainContent = document.createElement('main');
  mainContent.className = 'ek-main-content';
  mainContent.id = 'ekMainContent';

  body.append(toolStrip, treePane, mainContent);
  root.appendChild(body);

  function renderCurrentRoute() {
    const slug = getCurrentSlug();
    let page = slug ? findPageBySlug(slug) : null;
    if (!page && !slug) {
      const fallback = firstVisiblePage();
      if (fallback) {
        // Sync the URL to the page actually shown; the resulting hashchange
        // re-enters this function with the slug now set.
        navigateToSlug(fallback.slug);
        return;
      }
    }
    currentPage = page;
    toolStrip.classList.toggle('ek-hidden', !isUnlocked());
    editPageBtn.disabled = !page;
    renderTree(treePane, { pages: getPages(), activeId: page?.id });
    renderPageView(mainContent, { page, provider: getProvider(), tags: getTags() });
    closeMobileMenu();
  }

  refreshLockBtn();
  subscribe(renderCurrentRoute);
  subscribe(() => searchBox.refreshIndex());
  initRouter(renderCurrentRoute);
  searchBox.refreshIndex();

  return root;
}

async function boot() {
  const root = document.getElementById('app');
  if (root) await renderApp(root);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
