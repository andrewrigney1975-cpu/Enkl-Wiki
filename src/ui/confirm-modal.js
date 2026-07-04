import { openModal } from './modal.js';

// Resolves true if the user confirms, false on cancel or dismissal.
export function showConfirmModal({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = true } = {}) {
  return new Promise((resolve) => {
    const body = document.createElement('p');
    body.style.margin = '0';
    body.textContent = message;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ek-btn ek-btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'ek-btn ek-btn-danger' : 'ek-btn ek-btn-primary';
    confirmBtn.textContent = confirmLabel;

    const footer = document.createElement('div');
    footer.className = 'ek-modal-footer-buttons';
    footer.append(cancelBtn, confirmBtn);

    let settled = false;
    const handle = openModal({
      title,
      bodyNode: body,
      footerNode: footer,
      size: 'sm',
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }
    });

    cancelBtn.addEventListener('click', () => {
      settled = true;
      resolve(false);
      handle.close();
    });
    confirmBtn.addEventListener('click', () => {
      settled = true;
      resolve(true);
      handle.close();
    });
  });
}
