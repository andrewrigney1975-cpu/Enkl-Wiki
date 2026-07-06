const STORAGE_KEY = 'enklwiki_site';

export function loadStoredConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// A separate, tiny key that must be readable *before* the rest of the config
// can even be fetched — it tells the app whether to boot from localStorage
// (embedded/filesystem) or from a remote API (rdbms). The main `enklwiki_site`
// key above is untouched by rdbms mode and keeps whatever it held before the
// switch, so switching back to a local mode later picks up where it left off.
const CONNECTION_KEY = 'enklwiki_connection';

export function loadConnectionSettings() {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveConnectionSettings(settings) {
  try {
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearConnectionSettings() {
  try {
    localStorage.removeItem(CONNECTION_KEY);
  } catch {
    /* ignore */
  }
}
