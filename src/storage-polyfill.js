// Polyfill di window.storage (API Claude Artifacts) usando localStorage del browser.
// Stessa firma async — l'App.jsx funziona senza modifiche.
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? null : { key, value, shared: false };
      } catch (_) {
        return null;
      }
    },
    async set(key, value, shared = false) {
      try {
        localStorage.setItem(key, value);
        return { key, value, shared };
      } catch (e) {
        console.error('localStorage.set failed:', e);
        return null;
      }
    },
    async delete(key, shared = false) {
      try {
        localStorage.removeItem(key);
        return { key, deleted: true, shared };
      } catch (_) {
        return null;
      }
    },
    async list(prefix, shared = false) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!prefix || (k && k.startsWith(prefix))) keys.push(k);
        }
        return { keys, prefix, shared };
      } catch (_) {
        return { keys: [], prefix, shared };
      }
    },
  };
}
