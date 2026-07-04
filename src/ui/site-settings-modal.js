import { openModal } from './modal.js';
import { showConfirmModal } from './confirm-modal.js';
import { iconMarkup } from './icons.js';
import { getConfig, persist, notifyChanged, refreshProvider, replaceConfig } from '../app/state.js';
import { hashCredential } from '../auth/credential.js';
import { CONTENT_PROVIDER } from '../storage/site-config.js';
import { unusedTags } from '../content/tag-model.js';
import { exportConfig, importConfigFromFile } from '../storage/import-export.js';

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
  `;
  providerSelect.value = config.settings.contentBackingProvider;
  const providerHint = document.createElement('div');
  providerHint.className = 'ek-hint';
  providerHint.textContent = 'Switching this does not move existing page content — pages will need to be re-saved after switching.';
  providerField.append(providerSelect, providerHint);

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
    cleanupBtn.addEventListener('click', () => {
      const staleIds = new Set(stale.map((t) => t.id));
      config.tags = config.tags.filter((t) => !staleIds.has(t.id));
      persist();
      notifyChanged();
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
  dataButtonRow.append(exportBtn, importBtn, importFileInput);
  dataField.append(dataButtonRow, importError);

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';

  body.append(titleField, descField, providerField, credField, tagsField, dataField, errorBox);

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

  saveBtn.addEventListener('click', async () => {
    config.site.title = titleInput.value.trim() || 'Enkl-Wiki';
    config.site.description = descInput.value;

    const providerChanged = providerSelect.value !== config.settings.contentBackingProvider;
    config.settings.contentBackingProvider = providerSelect.value;

    if (newCredInput.value.trim()) {
      const { salt, hash } = await hashCredential(newCredInput.value.trim());
      config.settings.credentialSalt = salt;
      config.settings.credentialHash = hash;
    }

    persist();
    if (providerChanged) refreshProvider();
    notifyChanged();
    handle.close();
  });

  return handle;
}
