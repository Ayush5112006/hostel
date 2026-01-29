// Utility to validate and cleanup stored session info
export function validateStoredSession(): boolean {
  try {
    const raw = localStorage.getItem('sb-auth-token');
    if (!raw) return false;
    const info = JSON.parse(raw);
    if (!info || typeof info !== 'object') {
      localStorage.removeItem('sb-auth-token');
      return false;
    }
    const expiresAt = Number(info.expiresAt || 0);
    if (!expiresAt || Date.now() > expiresAt) {
      // expired
      localStorage.removeItem('sb-auth-token');
      return false;
    }
    return true;
  } catch (e) {
    try { localStorage.removeItem('sb-auth-token'); } catch (_) {}
    return false;
  }
}

export function clearStoredSession() {
  try { localStorage.removeItem('sb-auth-token'); } catch (_) {}
}
