import { openModal } from './modal.js';
import { iconMarkup } from './icons.js';
import { APP_VERSION } from '../app/version.js';

export function showAboutModal() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="ek-about-hero">
      <div class="ek-about-header-row">${iconMarkup('pencil', 36)}<div class="ek-about-name">Enkl-Wiki</div></div>
      <div class="ek-about-tagline">A self-contained, offline-first wiki</div>
      <div class="ek-about-version">Version ${APP_VERSION}</div>
    </div>
  `;
  return openModal({ title: 'About', bodyNode: body, size: 'sm' });
}
