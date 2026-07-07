import { openModal } from './modal.js';
import { isAllowedIframeUrl } from '../content/markdown.js';

// Prompts for a URL + width/height, then hands the caller a ```iframe
// Markdown fence to insert (see markdown.js's parseIframeData/renderIframeEmbed
// for how it's rendered back out) — mirrors showUploadModal/showDiagramModal's
// "collect input, then call back with something to insert" shape.
export function showIframeModal({ onInsert } = {}) {
  const body = document.createElement('div');

  const urlField = document.createElement('div');
  urlField.className = 'ek-field';
  urlField.innerHTML = '<label for="ekIframeUrlInput">URL</label>';
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.id = 'ekIframeUrlInput';
  urlInput.placeholder = 'https://example.com/embed';
  urlField.appendChild(urlInput);
  const urlHint = document.createElement('div');
  urlHint.className = 'ek-hint';
  urlHint.textContent = 'Must be an https:// URL, or a relative URL on this site.';
  urlField.appendChild(urlHint);

  const dimensionsRow = document.createElement('div');
  dimensionsRow.className = 'ek-iframe-dimensions-row';

  const widthField = document.createElement('div');
  widthField.className = 'ek-field';
  widthField.innerHTML = '<label for="ekIframeWidthInput">Width</label>';
  const widthInputWrap = document.createElement('div');
  widthInputWrap.className = 'ek-iframe-width-wrap';
  const widthInput = document.createElement('input');
  widthInput.type = 'number';
  widthInput.id = 'ekIframeWidthInput';
  widthInput.min = '1';
  widthInput.value = '100';
  const widthUnitSelect = document.createElement('select');
  for (const unit of ['%', 'px']) {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    widthUnitSelect.appendChild(option);
  }
  widthInputWrap.append(widthInput, widthUnitSelect);
  widthField.appendChild(widthInputWrap);

  const heightField = document.createElement('div');
  heightField.className = 'ek-field';
  heightField.innerHTML = '<label for="ekIframeHeightInput">Height (px)</label>';
  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.id = 'ekIframeHeightInput';
  heightInput.min = '1';
  heightInput.value = '400';
  heightField.appendChild(heightInput);

  dimensionsRow.append(widthField, heightField);

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';

  body.append(urlField, dimensionsRow, errorBox);

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('ek-hidden');
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const insertBtn = document.createElement('button');
  insertBtn.type = 'button';
  insertBtn.className = 'ek-btn ek-btn-primary';
  insertBtn.textContent = 'Insert';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, insertBtn);

  const handle = openModal({ title: 'Insert IFRAME', bodyNode: body, footerNode: footer, size: 'sm' });
  cancelBtn.addEventListener('click', handle.close);
  urlInput.focus();

  insertBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError('A URL is required.');
      return;
    }
    if (!isAllowedIframeUrl(url)) {
      showError('The URL must be either relative (e.g. /pages/embed.html) or start with https://.');
      return;
    }

    const width = Number(widthInput.value);
    if (!Number.isFinite(width) || width <= 0) {
      showError('Width must be a positive number.');
      return;
    }

    const height = Number(heightInput.value);
    if (!Number.isFinite(height) || height <= 0) {
      showError('Height must be a positive number.');
      return;
    }

    const data = { url, width, widthUnit: widthUnitSelect.value, height };
    handle.close();
    if (onInsert) onInsert('```iframe\n' + JSON.stringify(data) + '\n```');
  });

  return handle;
}
