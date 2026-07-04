import { iconMarkup } from './icons.js';

// Reusable overlay/modal shell. Returns handles so callers can close it
// programmatically (e.g. after a save) or attach footer button behavior.
export function openModal({ title = '', bodyNode = null, footerNode = null, size = '', onClose = null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'ek-overlay';

  const modal = document.createElement('div');
  modal.className = 'ek-modal' + (size ? ' ek-modal-' + size : '');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'ek-modal-header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ek-btn ek-btn-ghost';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = iconMarkup('close', 18);
  header.append(h2, closeBtn);

  const body = document.createElement('div');
  body.className = 'ek-modal-body';
  if (bodyNode) body.appendChild(bodyNode);

  modal.append(header, body);

  if (footerNode) {
    const footer = document.createElement('div');
    footer.className = 'ek-modal-footer';
    footer.appendChild(footerNode);
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);

  function close() {
    if (!overlay.isConnected) return;
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    if (onClose) onClose();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKeydown);

  document.body.appendChild(overlay);
  return { close, overlay, modal, header, body };
}
