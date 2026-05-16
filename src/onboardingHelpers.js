// Helper sincrone per Onboarding. Tenute in un file separato dal componente
// per permettere il code-splitting di Onboarding.jsx (che è lazy in App.jsx).

const ONBOARDING_KEY_PREFIX = 'quercus_onboarded_v1_';

export function hasSeenOnboarding(userId) {
  try { return !!localStorage.getItem(ONBOARDING_KEY_PREFIX + userId); }
  catch { return false; }
}

export function markOnboardingSeen(userId) {
  try { localStorage.setItem(ONBOARDING_KEY_PREFIX + userId, '1'); } catch (_) {}
}
