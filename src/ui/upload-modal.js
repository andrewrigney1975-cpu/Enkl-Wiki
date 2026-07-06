import { openModal } from './modal.js';
import { recordUpload } from '../app/state.js';

const ALLOWED_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'mp3', 'mp4', 'pdf'];

function extensionOf(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export function showUploadModal({ onUploaded } = {}) {
  const body = document.createElement('div');

  const hint = document.createElement('p');
  hint.className = 'ek-hint';
  hint.style.margin = '0 0 14px';
  hint.textContent = `Allowed types: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}.`;
  body.appendChild(hint);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');
  body.appendChild(fileInput);

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';
  body.appendChild(errorBox);

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('ek-hidden');
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'ek-btn ek-btn-primary';
  uploadBtn.textContent = 'Upload';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, uploadBtn);

  const handle = openModal({ title: 'Upload File', bodyNode: body, footerNode: footer, size: 'sm' });
  cancelBtn.addEventListener('click', handle.close);

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      showError('Choose a file first.');
      return;
    }
    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showError(`".${ext}" files aren't supported here. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`);
      return;
    }

    let upload;
    try {
      upload = await recordUpload(file, file.name);
    } catch (err) {
      showError(err.message || 'Could not upload that file.');
      return;
    }

    handle.close();
    if (onUploaded) onUploaded(upload);
  });

  return handle;
}
