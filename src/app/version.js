// Replaced with the real MAJOR.MINOR.YYYYMMDD.HHMM string by scripts/build.js.
// Left as a literal token in unbundled/dev/test contexts.
export const APP_VERSION = '__APP_VERSION__';

export function formatVersion(major, minor, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const H = pad(date.getHours());
  const M = pad(date.getMinutes());
  return `${major}.${minor}.${y}${m}${d}.${H}${M}`;
}
