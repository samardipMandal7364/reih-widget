const STORAGE_PREFIX = 'reih_widget_';
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export function saveSession(sessionId, mediaId) {
  try {
    const data = { sessionId, mediaId, ts: Date.now() };
    localStorage.setItem(`${STORAGE_PREFIX}session`, JSON.stringify(data));
  } catch (_) {}
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}session`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > SESSION_TTL) {
      clearSession();
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}session`);
  } catch (_) {}
}

export function touchSession() {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}session`);
    if (!raw) return;
    const data = JSON.parse(raw);
    data.ts = Date.now();
    localStorage.setItem(`${STORAGE_PREFIX}session`, JSON.stringify(data));
  } catch (_) {}
}
