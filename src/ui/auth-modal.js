import { openModal } from './modal.js';
import { verifyCredentialTier, setUnlocked, setAdmin, setAuthToken } from '../auth/credential.js';
import { isRdbmsMode, getApiBaseUrl, loginToApi } from '../app/state.js';

export function showAuthModal({ config, onUnlocked } = {}) {
  const body = document.createElement('div');
  body.innerHTML = `
    <p style="margin:0 0 14px;color:var(--ek-text);font-size:13px;line-height:1.6;">
      Enter a credential to unlock page and hierarchy editing. The admin credential also unlocks Site Settings.
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

  function showInvalid(message) {
    error.textContent = message;
    error.classList.remove('ek-hidden');
    input.value = '';
    input.focus();
  }

  function unlockAs(tier) {
    setUnlocked(true);
    setAdmin(tier === 'admin');
    handle.close();
    if (onUnlocked) onUnlocked();
  }

  async function attempt() {
    const secret = input.value;

    if (isRdbmsMode()) {
      try {
        const { token, role } = await loginToApi(getApiBaseUrl(), secret);
        setAuthToken(token);
        unlockAs(role);
      } catch (err) {
        showInvalid(err.status === 401 ? 'That credential is not correct.' : (err.message || 'Could not reach the API.'));
      }
      return;
    }

    const tier = await verifyCredentialTier(secret, config);
    if (tier) {
      unlockAs(tier);
    } else {
      showInvalid('That credential is not correct.');
    }
  }

  unlockBtn.addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });

  return handle;
}
