// Hashbang routing: #!/<slug>. Kept deliberately simple — one path segment,
// no query parsing — since the spec only calls for slug-addressable pages.
function parseHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#!\/(.*)$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function getCurrentSlug() {
  return parseHash();
}

export function navigateToSlug(slug) {
  window.location.hash = `#!/${encodeURIComponent(slug)}`;
}

export function initRouter(onChange) {
  window.addEventListener('hashchange', () => onChange(parseHash()));
  onChange(parseHash());
}
