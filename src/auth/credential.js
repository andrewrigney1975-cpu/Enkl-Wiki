// PBKDF2-SHA256 credential hashing via SubtleCrypto (available in secure
// contexts, which includes file:// origins in every major browser — so this
// still works when the app is opened straight off a thumb drive). The
// credential gates page/hierarchy/upload editing; it is not a high-value
// secret, so a plain string compare of the resulting hex digests is fine —
// no need for constant-time comparison here.
const SESSION_KEY = 'enklwiki_unlocked';
const TOKEN_KEY = 'enklwiki_auth_token';
const PBKDF2_ITERATIONS = 100000;
const DEFAULT_CREDENTIAL = 'foobar';

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function randomSaltHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function deriveHash(secret, saltHex) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(bits);
}

export async function hashCredential(secret) {
  const salt = randomSaltHex();
  const hash = await deriveHash(secret, salt);
  return { salt, hash };
}

export async function verifyCredential(secret, salt, hash) {
  if (!salt || !hash) return false;
  return (await deriveHash(secret, salt)) === hash;
}

// Populates settings.credentialSalt/credentialHash with the default
// credential on first run, if nothing has been set yet.
export async function ensureDefaultCredential(config) {
  if (!config.settings.credentialHash || !config.settings.credentialSalt) {
    const { salt, hash } = await hashCredential(DEFAULT_CREDENTIAL);
    config.settings.credentialSalt = salt;
    config.settings.credentialHash = hash;
  }
}

export function isUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setUnlocked(value) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

// In rdbms mode, "unlocked" also means holding a JWT from POST /api/auth/login
// — kept in sessionStorage so it shares the same "unlocked for this tab"
// lifetime as the client-only modes' unlock flag.
export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}
