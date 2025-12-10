/**
 * Utility per gestire la vibrazione del dispositivo mobile
 * Usa l'API Vibration del browser quando disponibile
 */

/**
 * Esegue una breve vibrazione (circa 50ms)
 * Utile per feedback tattile su azioni come il cambio di opinione
 */
export function vibrateShort(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(50);
    } catch (error) {
      // Ignora errori di vibrazione (dispositivo non supportato, permessi negati, ecc.)
      console.debug('Vibrazione non disponibile:', error);
    }
  }
}

/**
 * Esegue una vibrazione media (circa 100ms)
 * Utile per feedback su azioni più importanti
 */
export function vibrateMedium(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(100);
    } catch (error) {
      console.debug('Vibrazione non disponibile:', error);
    }
  }
}

/**
 * Esegue una vibrazione lunga (circa 200ms)
 * Utile per feedback su azioni molto importanti
 */
export function vibrateLong(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(200);
    } catch (error) {
      console.debug('Vibrazione non disponibile:', error);
    }
  }
}

/**
 * Esegue un pattern di vibrazione personalizzato
 * @param pattern Array di numeri che rappresenta durata vibrazione/pausa in millisecondi
 * Esempio: [100, 50, 100] = vibra 100ms, pausa 50ms, vibra 100ms
 */
export function vibratePattern(pattern: number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.debug('Vibrazione non disponibile:', error);
    }
  }
}

/**
 * Verifica se la vibrazione è supportata dal dispositivo
 */
export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

