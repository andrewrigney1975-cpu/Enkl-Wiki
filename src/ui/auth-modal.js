import { openModal } from './modal.js';
import { verifyCredential, setUnlocked } from '../auth/credential.js';

export function showAuthModal({ config, onUnlocked } = {}) {
  const body = document.createElement('div');
  body.innerHTML = `
    <p style="margin:0 0 14px;color:var(--ek-text);font-size:13px;line-height:1.6;">
      Enter the editor credential to unlock page and hierarchy editing.
    </p>
    <div class="ek-field">
      <label for="ekAuthInput">Credential</label>
      <input type="password" id="ekAuthInput" autocomplete="current-password">
    </div>
    <div class="ek-field-error ek-hidden" id="ekAuthError"></div>
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const unlockBtn = document.createElement('button');
  unlockBtn.type = 'button';
  unlockBtn.className = 'ek-btn ek-btn-primary';
  unlockBtn.textContent = 'Unlock';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, unlockBtn);

  const handle = openModal({ title: 'Unlock Editing', bodyNode: body, footerNode: footer, size: 'sm' });
  cancelBtn.addEventListener('click', handle.close);

  const input = body.querySelector('#ekAuthInput');
  const error = body.querySelector('#ekAuthError');
  input.focus();

  async function attempt() {
    const secret = input.value;
    const ok = await verifyCredential(secret, config.settings.credentialSalt, config.settings.credentialHash);
    if (ok) {
      setUnlocked(true);
      handle.close();
      if (onUnlocked) onUnlocked();
    } else {
      error.textContent = 'That credential is not correct.';
      error.classList.remove('ek-hidden');
      input.value = '';
      input.focus();
    }
  }

  unlockBtn.addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });

  return handle;
}
