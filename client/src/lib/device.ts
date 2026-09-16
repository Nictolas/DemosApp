const DEVICE_ID_KEY = 'demos_device_id';

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `dev_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Identificatore pseudocasuale della singola installazione/browser.
 * Non identifica una persona e può essere perso cancellando i dati locali.
 * Serve solo come segnale antifrode aggiuntivo.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 20) return existing;
  } catch {
    // Se localStorage non è disponibile, proviamo comunque a generare un ID temporaneo.
  }

  const id = createDeviceId();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // In modalità privata/restrittiva l'ID resterà valido solo per questa sessione.
  }
  return id;
}
