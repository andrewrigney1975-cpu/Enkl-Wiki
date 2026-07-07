// Inline SVG icon registry. Each entry is the inner markup of a 24x24 viewBox icon.
const ICONS = {
  pencil: '<path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 8l2 2" stroke="currentColor" stroke-width="1.6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  search: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chevronRight: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronDown: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7.17-7.17a2 2 0 0 0 0-2.82l-9-9z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>',
  help: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.5 2.3c-.9.5-1 1-1 2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  externalLink: '<path d="M14 4h6v6M20 4L10 14M6 6H4v14h14v-2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 11V7a4 4 0 0 1 7.2-2.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h4.5l1.5 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  page: '<path d="M6 2h9l5 5v15H6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M15 2v5h5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 13h4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  bold: '<path d="M6 4h6.5a3.5 3.5 0 0 1 0 7H6zM6 11h7.5a3.5 3.5 0 0 1 0 7H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  italic: '<path d="M12 4h6M6 20h6M14 4L10 20" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  quote: '<path d="M7 7a4 4 0 0 0-4 4v2a3 3 0 0 0 3 3h1v-6H5a2 2 0 0 1 2-2zM17 7a4 4 0 0 0-4 4v2a3 3 0 0 0 3 3h1v-6h-2a2 2 0 0 1 2-2z" fill="currentColor"/>',
  listUl: '<circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  listOl: '<text x="2" y="8" font-size="6" fill="currentColor">1</text><text x="2" y="14" font-size="6" fill="currentColor">2</text><text x="2" y="20" font-size="6" fill="currentColor">3</text><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  code: '<path d="M8 6L2 12l6 6M16 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  settings: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/><path d="M21 16l-6-5-4 4-2-2-6 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  diagram: '<rect x="2" y="3" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="14" y="3" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="8" y="15" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M6 9v3a3 3 0 0 0 3 3h1M18 9v3a3 3 0 0 1-3 3h-1" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16" stroke="currentColor" stroke-width="1.6"/>',
  // The plain table icon, shrunk into the bottom-left to make room for a
  // small four-point sparkle badge in the top-right corner (the
  // "advanced"/spreadsheet table that inserts a live formula grid — see
  // advtable-widget.js).
  tableAdvanced: '<rect x="2" y="7" width="14" height="13" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M2 13.5h14M9 7v13" stroke="currentColor" stroke-width="1.6"/><path d="M19 1.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="currentColor"/>',
  print: '<path d="M6 9V3h12v6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><rect x="4" y="9" width="16" height="8" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M6 14h12v7H6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  // A frame nested inside a frame — the embedded page's own viewport sitting
  // inside the outer page (used for "Insert IFRAME").
  iframe: '<rect x="3" y="4" width="18" height="16" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="7" y="8" width="10" height="8" rx="0.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  // Two chevrons pointing toward each other ("><"), for "shrink to content".
  tableResponsive: '<path d="M9 7l4 5-4 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7l-4 5 4 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  // Two chevrons pointing away from each other ("<>"), for "stretch to fill".
  tableFull: '<path d="M10 7L6 12l4 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7l4 5-4 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>'
};

export function iconMarkup(name, size = 16) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

export function createIcon(name, { size = 16, className = '' } = {}) {
  const span = document.createElement('span');
  span.className = 'ek-icon' + (className ? ' ' + className : '');
  span.innerHTML = iconMarkup(name, size);
  return span;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}
