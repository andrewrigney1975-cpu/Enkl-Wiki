import { openModal } from './modal.js';
import { showConfirmModal } from './confirm-modal.js';
import { iconMarkup } from './icons.js';
import {
  getConfig, persist, notifyChanged, refreshProvider, replaceConfig,
  isRdbmsMode, connectToRdbms, disconnectFromRdbms, migrateCurrentSiteTo, loginToApi,
  saveSiteSettings, changeCredential, removeUnusedTags
} from '../app/state.js';
import { hashCredential } from '../auth/credential.js';
import { CONTENT_PROVIDER } from '../storage/site-config.js';
import { loadConnectionSettings } from '../storage/local-storage.js';
import { unusedTags } from '../content/tag-model.js';
import { exportConfig, importConfigFromFile } from '../storage/import-export.js';

// POST /api/import is auth-gated on the server (it's a destructive
// replace-all), but the user isn't logged into the *target* API yet at this
// point in the on-ramp flow — that's a separate session from whatever
// unlocked the current mode. Resolves the entered credential, or null if
// cancelled.
function promptForTargetCredential(apiDescription) {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin:0 0 14px;color:var(--ek-text);font-size:13px;line-height:1.6;">
        Enter the editor credential for the database at ${apiDescription} (a fresh database's default is "foobar").
      </p>
      <div class="ek-field">
        <label for="ekMigrateCredInput">Credential</label>
        <input type="password" id="ekMigrateCredInput" autocomplete="current-password">
      </div>
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ek-btn ek-btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'ek-btn ek-btn-primary';
    continueBtn.textContent = 'Continue';

    const footer = document.createElement('div');
    footer.className = 'ek-modal-footer-buttons';
    footer.append(cancelBtn, continueBtn);

    let settled = false;
    const handle = openModal({
      title: 'Target Database Credential',
      bodyNode: body,
      footerNode: footer,
      size: 'sm',
      onClose: () => { if (!settled) { settled = true; resolve(null); } }
    });

    const input = body.querySelector('#ekMigrateCredInput');
    input.focus();

    function submit() {
      settled = true;
      resolve(input.value);
      handle.close();
    }
    cancelBtn.addEventListener('click', () => { settled = true; resolve(null); handle.close(); });
    continueBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });
}

export function showSiteSettingsModal() {
  const config = getConfig();
  const body = document.createElement('div');

  const titleField = document.createElement('div');
  titleField.className = 'ek-field';
  titleField.innerHTML = '<label for="ekSiteTitleInput">Site title</label>';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'ekSiteTitleInput';
  titleInput.maxLength = 80;
  titleInput.value = config.site.title;
  titleField.appendChild(titleInput);

  const descField = document.createElement('div');
  descField.className = 'ek-field';
  descField.innerHTML = '<label for="ekSiteDescInput">Description <span class="ek-field-hint">(Markdown)</span></label>';
  const descInput = document.createElement('textarea');
  descInput.id = 'ekSiteDescInput';
  descInput.value = config.site.description || '';
  descField.appendChild(descInput);

  const providerField = document.createElement('div');
  providerField.className = 'ek-field';
  providerField.innerHTML = '<label for="ekProviderSelect">Page content storage</label>';
  const providerSelect = document.createElement('select');
  providerSelect.id = 'ekProviderSelect';
  providerSelect.innerHTML = `
    <option value="${CONTENT_PROVIDER.EMBEDDED}">Embedded in the site file (simplest, fully portable)</option>
    <option value="${CONTENT_PROVIDER.FILESYSTEM}">Separate files under /pages (better for publishing via FTP/git)</option>
    <option value="${CONTENT_PROVIDER.RDBMS}">Shared database (via API) — multiple people/devices, one live wiki</option>
  `;
  providerSelect.value = config.settings.contentBackingProvider;
  const providerHint = document.createElement('div');
  providerHint.className = 'ek-hint';
  providerHint.textContent = 'Switching this does not move existing page content automatically — see the migrate option below when connecting to a database.';
  providerField.append(providerSelect, providerHint);

  const apiUrlField = document.createElement('div');
  apiUrlField.className = 'ek-field';
  apiUrlField.innerHTML = '<label for="ekApiUrlInput">API Base URL</label>';
  const apiUrlInput = document.createElement('input');
  apiUrlInput.type = 'text';
  apiUrlInput.id = 'ekApiUrlInput';
  apiUrlInput.placeholder = 'https://wiki-api.example.com';
  apiUrlInput.value = isRdbmsMode() ? (loadConnectionSettings()?.apiBaseUrl || '') : '';
  apiUrlField.appendChild(apiUrlInput);
  const apiUrlHint = document.createElement('div');
  apiUrlHint.className = 'ek-hint';
  apiUrlHint.textContent = 'Where the Enkl-Wiki API is hosted. Leave blank if the API is reverse-proxied on this same origin (e.g. the Docker Compose setup).';
  apiUrlField.appendChild(apiUrlHint);

  function updateApiUrlVisibility() {
    apiUrlField.classList.toggle('ek-hidden', providerSelect.value !== CONTENT_PROVIDER.RDBMS);
  }
  updateApiUrlVisibility();
  providerSelect.addEventListener('change', updateApiUrlVisibility);

  const credField = document.createElement('div');
  credField.className = 'ek-field';
  credField.innerHTML = '<label for="ekNewCredInput">Change editor credential</label>';
  const newCredInput = document.createElement('input');
  newCredInput.type = 'password';
  newCredInput.id = 'ekNewCredInput';
  newCredInput.autocomplete = 'new-password';
  newCredInput.placeholder = 'Leave blank to keep the current credential';
  credField.appendChild(newCredInput);

  const tagsField = document.createElement('div');
  tagsField.className = 'ek-field';
  const stale = unusedTags(config.tags, config.pages);
  tagsField.innerHTML = `<label>Tags</label><div class="ek-hint">${config.tags.length} tag(s) total${stale.length ? `, ${stale.length} unused` : ''}.</div>`;
  if (stale.length) {
    const cleanupBtn = document.createElement('button');
    cleanupBtn.type = 'button';
    cleanupBtn.className = 'ek-btn ek-btn-secondary';
    cleanupBtn.style.marginTop = '8px';
    cleanupBtn.textContent = `Remove ${stale.length} unused tag${stale.length === 1 ? '' : 's'}`;
    cleanupBtn.addEventListener('click', async () => {
      await removeUnusedTags();
      handle.close();
    });
    tagsField.appendChild(cleanupBtn);
  }

  const dataField = document.createElement('div');
  dataField.className = 'ek-field';
  dataField.innerHTML = '<label>Site data</label>';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-secondary';
  exportBtn.innerHTML = `${iconMarkup('download', 14)}Export as JSON`;
  exportBtn.addEventListener('click', () => exportConfig(getConfig()));

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'ek-btn ek-btn-secondary';
  importBtn.innerHTML = `${iconMarkup('upload', 14)}Import from JSON`;

  const importFileInput = document.createElement('input');
  importFileInput.type = 'file';
  importFileInput.accept = 'application/json,.json';
  importFileInput.className = 'ek-hidden';
  importBtn.addEventListener('click', () => importFileInput.click());

  const importError = document.createElement('div');
  importError.className = 'ek-field-error ek-hidden';

  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files[0];
    importFileInput.value = '';
    if (!file) return;

    let imported;
    try {
      imported = await importConfigFromFile(file);
    } catch (err) {
      importError.textContent = err.message;
      importError.classList.remove('ek-hidden');
      return;
    }

    const ok = await showConfirmModal({
      title: 'Replace all site data?',
      message: 'Importing will replace the current pages, tags and settings. This cannot be undone.',
      confirmLabel: 'Import'
    });
    if (!ok) return;

    replaceConfig(imported);
    notifyChanged();
    handle.close();
  });

  const dataButtonRow = document.createElement('div');
  dataButtonRow.className = 'ek-button-row';
  if (isRdbmsMode()) {
    // Import/export while already connected go through the API's own
    // full-fidelity endpoints (wired up on the toolstrip's Export Data
    // button); replacing the live shared database from a local JSON file
    // here would be surprising for whoever else is looking at it right now.
    dataButtonRow.append(exportBtn);
    dataField.append(dataButtonRow);
  } else {
    dataButtonRow.append(exportBtn, importBtn, importFileInput);
    dataField.append(dataButtonRow, importError);
  }

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';

  body.append(titleField, descField, providerField, apiUrlField, credField, tagsField, dataField, errorBox);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'ek-btn ek-btn-primary';
  saveBtn.textContent = 'Save';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, saveBtn);

  const handle = openModal({ title: 'Site Settings', bodyNode: body, footerNode: footer, size: 'md' });
  cancelBtn.addEventListener('click', handle.close);

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('ek-hidden');
  }

  saveBtn.addEventListener('click', async () => {
    const newProviderKind = providerSelect.value;
    const currentProviderKind = config.settings.contentBackingProvider;
    const switchingIntoRdbms = newProviderKind === CONTENT_PROVIDER.RDBMS && currentProviderKind !== CONTENT_PROVIDER.RDBMS;
    const switchingOutOfRdbms = newProviderKind !== CONTENT_PROVIDER.RDBMS && currentProviderKind === CONTENT_PROVIDER.RDBMS;

    if (switchingIntoRdbms) {
      // Blank is valid and expected when the API is reverse-proxied on this
      // same origin (e.g. the Docker Compose setup) — apiFetch then just
      // makes relative requests.
      const apiBaseUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
      const apiDescription = apiBaseUrl || 'this same origin';

      const migrate = await showConfirmModal({
        title: 'Migrate current site into the database?',
        message: `Copy this site's current pages, tags and settings into the database at ${apiDescription}? Choose Cancel to connect without migrating (e.g. it already has content, or you want to start fresh).`,
        confirmLabel: 'Migrate',
        danger: false
      });

      let credential = null;
      if (migrate) {
        credential = await promptForTargetCredential(apiDescription);
        if (credential === null) return; // cancelled
      }

      saveBtn.disabled = true;
      try {
        if (migrate) {
          const token = await loginToApi(apiBaseUrl, credential);
          await migrateCurrentSiteTo(apiBaseUrl, token);
        }
        connectToRdbms(apiBaseUrl);
      } catch (err) {
        saveBtn.disabled = false;
        showError(err.message || 'Could not connect to the API.');
        return;
      }

      window.location.reload();
      return;
    }

    if (switchingOutOfRdbms) {
      disconnectFromRdbms();
      window.location.reload();
      return;
    }

    if (currentProviderKind === CONTENT_PROVIDER.RDBMS) {
      // Still connected to the database — edit title/description/credential
      // in place, no reload needed.
      try {
        await saveSiteSettings({ title: titleInput.value.trim() || 'Enkl-Wiki', description: descInput.value });
        if (newCredInput.value.trim()) await changeCredential(newCredInput.value.trim());
      } catch (err) {
        showError(err.message || 'Could not save site settings.');
        return;
      }
      handle.close();
      return;
    }

    config.site.title = titleInput.value.trim() || 'Enkl-Wiki';
    config.site.description = descInput.value;
    config.settings.contentBackingProvider = newProviderKind;

    if (newCredInput.value.trim()) {
      const { salt, hash } = await hashCredential(newCredInput.value.trim());
      config.settings.credentialSalt = salt;
      config.settings.credentialHash = hash;
    }

    persist();
    refreshProvider();
    notifyChanged();
    handle.close();
  });

  return handle;
}
