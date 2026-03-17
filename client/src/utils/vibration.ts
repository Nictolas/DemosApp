/**
 * Utility per gestire la vibrazione del dispositivo mobile
 * Supporta:
 * - API Vibration del browser (Android Chrome/Edge)
 * - Capacitor Haptics API (app native Android/iOS)
 * 
 * Nota: Su iPhone/Safari web la vibrazione non funziona per limitazioni del browser.
 * Funzionerà nell'app nativa se si usa Capacitor.
 */

/**
 * Esegue una vibrazione brevissima (circa 10ms)
 * Utile per feedback tattile discreto su azioni come il cambio di opinione
 */
export function vibrateShort(): void {
  // Prova prima con Capacitor (app native)
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    try {
      const { Haptics } = (window as any).Capacitor.Plugins;
      if (Haptics) {
        // Usa 'light' per la vibrazione più breve possibile
        Haptics.impact({ style: 'light' });
        return;
      }
    } catch (error) {
      // Fallback all'API browser
    }
  }
  
  // Fallback all'API Vibration del browser (funziona su Android Chrome/Edge)
  // 10ms è la durata minima per una vibrazione percepibile ma molto discreta
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
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
  // Prova prima con Capacitor (app native)
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    try {
      const { Haptics } = (window as any).Capacitor.Plugins;
      if (Haptics) {
        Haptics.impact({ style: 'medium' });
        return;
      }
    } catch (error) {
      // Fallback all'API browser
    }
  }
  
  // Fallback all'API Vibration del browser
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
  // Prova prima con Capacitor (app native)
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    try {
      const { Haptics } = (window as any).Capacitor.Plugins;
      if (Haptics) {
        Haptics.impact({ style: 'heavy' });
        return;
      }
    } catch (error) {
      // Fallback all'API browser
    }
  }
  
  // Fallback all'API Vibration del browser
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
  // Controlla Capacitor
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    try {
      const { Haptics } = (window as any).Capacitor.Plugins;
      if (Haptics) {
        return true;
      }
    } catch (error) {
      // Continua con il controllo browser
    }
  }
  
  // Controlla API browser
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

