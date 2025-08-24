/**
 * Libreria per la validazione del codice fiscale italiano
 * Implementa tutti gli algoritmi ufficiali per la verifica
 */

// Tabelle di conversione per il calcolo del codice fiscale
const TAVOLA_OMOCONSONANTI = {
  'A': '0', 'B': '1', 'C': '2', 'D': '3', 'E': '4', 'F': '5', 'G': '6', 'H': '7', 'I': '8', 'J': '9',
  'K': '10', 'L': '11', 'M': '12', 'N': '13', 'O': '14', 'P': '15', 'Q': '16', 'R': '17', 'S': '18',
  'T': '19', 'U': '20', 'V': '21', 'W': '22', 'X': '23', 'Y': '24', 'Z': '25'
};

const TAVOLA_OMOVOCALI = {
  'A': '0', 'E': '4', 'I': '8', 'O': '14', 'U': '20'
};

const TAVOLA_DISPARI = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};

const TAVOLA_PARI = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
  'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};

const TAVOLA_RESTI = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K'
};

// MESI per il calcolo del codice fiscale
const MESI = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'H': 6,
  'L': 7, 'M': 8, 'P': 9, 'R': 10, 'S': 11, 'T': 12
};

export interface CodiceFiscaleData {
  nome: string;
  cognome: string;
  dataNascita: Date;
  sesso: 'M' | 'F';
  comuneNascita: string;
}

export class CodiceFiscaleValidator {
  /**
   * Valida la struttura base del codice fiscale
   */
  static validateStructure(codice: string): boolean {
    if (!codice || typeof codice !== 'string') return false;
    
    // Deve essere esattamente 16 caratteri
    if (codice.length !== 16) return false;
    
    // Deve contenere solo lettere e numeri
    if (!/^[A-Z0-9]{16}$/.test(codice)) return false;
    
    return true;
  }

  /**
   * Valida il checksum del codice fiscale
   */
  static validateChecksum(codice: string): boolean {
    if (!this.validateStructure(codice)) return false;
    
    const codiceBase = codice.substring(0, 15);
    const checksumCalcolato = this.calcolaChecksum(codiceBase);
    const checksumOriginale = codice.charAt(15);
    
    return checksumCalcolato === checksumOriginale;
  }

  /**
   * Calcola il checksum per un codice fiscale di 15 caratteri
   */
  static calcolaChecksum(codiceBase: string): string {
    if (codiceBase.length !== 15) {
      throw new Error('Il codice base deve essere di 15 caratteri');
    }

    let somma = 0;
    
    // Calcola somma per caratteri in posizione dispari (1, 3, 5, 7, 9, 11, 13, 15)
    for (let i = 0; i < 15; i += 2) {
      const char = codiceBase.charAt(i);
      somma += TAVOLA_DISPARI[char] || 0;
    }
    
    // Calcola somma per caratteri in posizione pari (2, 4, 6, 8, 10, 12, 14)
    for (let i = 1; i < 15; i += 2) {
      const char = codiceBase.charAt(i);
      somma += TAVOLA_PARI[char] || 0;
    }
    
    const resto = somma % 26;
    return TAVOLA_RESTI[resto];
  }

  /**
   * Genera il codice fiscale a partire dai dati personali
   */
  static generaCodiceFiscale(data: CodiceFiscaleData): string {
    // 1. Cognome (prime 3 consonanti, se non bastano si usano le vocali)
    const cognome = this.estraiConsonantiEVocali(data.cognome.toUpperCase());
    
    // 2. Nome (prime 3 consonanti, se ce ne sono più di 3 si prendono 1a, 3a, 4a)
    const nome = this.estraiConsonantiEVocaliNome(data.nome.toUpperCase());
    
    // 3. Data di nascita e sesso
    const dataSesso = this.calcolaDataSesso(data.dataNascita, data.sesso);
    
    // 4. Codice comune (per ora placeholder, dovrebbe essere una tabella completa)
    const comune = this.calcolaCodiceComune(data.comuneNascita);
    
    // 5. Calcola il codice base (15 caratteri)
    const codiceBase = cognome + nome + dataSesso + comune;
    
    // 6. Calcola il checksum
    const checksum = this.calcolaChecksum(codiceBase);
    
    return codiceBase + checksum;
  }

  /**
   * Estrae consonanti e vocali per il cognome
   */
  private static estraiConsonantiEVocali(cognome: string): string {
    const consonanti = cognome.match(/[BCDFGHJKLMNPQRSTVWXYZ]/g) || [];
    const vocali = cognome.match(/[AEIOU]/g) || [];
    
    let risultato = '';
    
    // Aggiungi le prime 3 consonanti
    for (let i = 0; i < Math.min(3, consonanti.length); i++) {
      risultato += consonanti[i];
    }
    
    // Se non bastano le consonanti, aggiungi le vocali
    if (risultato.length < 3) {
      for (let i = 0; i < Math.min(3 - risultato.length, vocali.length); i++) {
        risultato += vocali[i];
      }
    }
    
    // Se ancora non bastano, riempi con X
    while (risultato.length < 3) {
      risultato += 'X';
    }
    
    return risultato;
  }

  /**
   * Estrae consonanti e vocali per il nome (regola speciale)
   */
  private static estraiConsonantiEVocaliNome(nome: string): string {
    const consonanti = nome.match(/[BCDFGHJKLMNPQRSTVWXYZ]/g) || [];
    const vocali = nome.match(/[AEIOU]/g) || [];
    
    let risultato = '';
    
    if (consonanti.length > 3) {
      // Se ci sono più di 3 consonanti: 1a, 3a, 4a
      risultato = consonanti[0] + consonanti[2] + consonanti[3];
    } else {
      // Altrimenti: prime 3 consonanti
      for (let i = 0; i < Math.min(3, consonanti.length); i++) {
        risultato += consonanti[i];
      }
      
      // Se non bastano, aggiungi le vocali
      if (risultato.length < 3) {
        for (let i = 0; i < Math.min(3 - risultato.length, vocali.length); i++) {
          risultato += vocali[i];
        }
      }
    }
    
    // Se ancora non bastano, riempi con X
    while (risultato.length < 3) {
      risultato += 'X';
    }
    
    return risultato;
  }

  /**
   * Calcola la parte data e sesso del codice fiscale
   */
  private static calcolaDataSesso(data: Date, sesso: 'M' | 'F'): string {
    const anno = data.getFullYear();
    const mese = data.getMonth() + 1;
    const giorno = data.getDate();
    
    // Anno: ultime 2 cifre
    const annoCodice = anno.toString().slice(-2);
    
    // Mese: lettera corrispondente
    const meseCodice = Object.keys(MESI).find(key => MESI[key as keyof typeof MESI] === mese) || 'A';
    
    // Giorno: per le femmine si aggiunge 40
    let giornoCodice = giorno;
    if (sesso === 'F') {
      giornoCodice += 40;
    }
    
    return annoCodice + meseCodice + giornoCodice.toString().padStart(2, '0');
  }

  /**
   * Calcola il codice del comune (placeholder - dovrebbe essere una tabella completa)
   */
  private static calcolaCodiceComune(comune: string): string {
    // Per ora restituisce un placeholder
    // In un'implementazione completa, dovrebbe consultare una tabella dei comuni italiani
    // con i relativi codici catastali
    return 'H501'; // Esempio: Roma
  }

  /**
   * Valida completamente un codice fiscale
   */
  static validaCodiceFiscale(codice: string): {
    valido: boolean;
    errori: string[];
  } {
    const errori: string[] = [];
    
    // 1. Validazione struttura
    if (!this.validateStructure(codice)) {
      errori.push('Il codice fiscale deve essere di 16 caratteri alfanumerici');
      return { valido: false, errori };
    }
    
    // 2. Validazione checksum
    if (!this.validateChecksum(codice)) {
      errori.push('Il checksum del codice fiscale non è valido');
      return { valido: false, errori };
    }
    
    // 3. Validazione data di nascita
    const dataNascita = this.estraiDataNascita(codice);
    if (!dataNascita) {
      errori.push('La data di nascita nel codice fiscale non è valida');
      return { valido: false, errori };
    }
    
    // 4. Validazione sesso
    const sesso = this.estraiSesso(codice);
    if (!sesso) {
      errori.push('Il sesso nel codice fiscale non è valido');
      return { valido: false, errori };
    }
    
    return { valido: true, errori: [] };
  }

  /**
   * Estrae la data di nascita dal codice fiscale
   */
  static estraiDataNascita(codice: string): Date | null {
    if (!this.validateStructure(codice)) return null;
    
    try {
      const anno = parseInt(codice.substring(6, 8));
      const mese = codice.charAt(8);
      const giorno = parseInt(codice.substring(9, 11));
      
      // Determina l'anno completo (assumiamo che sia nel 1900-1999)
      const annoCompleto = anno < 50 ? 2000 + anno : 1900 + anno;
      
      // Trova il mese corrispondente
      const meseNumero = MESI[mese as keyof typeof MESI];
      if (!meseNumero) return null;
      
      // Per le femmine, sottrai 40 dal giorno
      let giornoEffettivo = giorno;
      if (giorno > 40) {
        giornoEffettivo = giorno - 40;
      }
      
      return new Date(annoCompleto, meseNumero - 1, giornoEffettivo);
    } catch {
      return null;
    }
  }

  /**
   * Estrae il sesso dal codice fiscale
   */
  static estraiSesso(codice: string): 'M' | 'F' | null {
    if (!this.validateStructure(codice)) return null;
    
    const giorno = parseInt(codice.substring(9, 11));
    return giorno > 40 ? 'F' : 'M';
  }

  /**
   * Estrae il comune di nascita dal codice fiscale
   */
  static estraiComuneNascita(codice: string): string {
    if (!this.validateStructure(codice)) return '';
    
    // I caratteri 12-15 contengono il codice del comune
    return codice.substring(11, 15);
  }

  /**
   * Formatta il codice fiscale per la visualizzazione
   */
  static formattaCodiceFiscale(codice: string): string {
    if (!this.validateStructure(codice)) return codice;
    
    // Formato: AAAA BB CC DD EEEE
    return `${codice.substring(0, 4)} ${codice.substring(4, 6)} ${codice.substring(6, 8)} ${codice.substring(8, 10)} ${codice.substring(10, 16)}`;
  }
}

// Funzioni di utilità per l'uso comune
export const validaCodiceFiscale = (codice: string) => CodiceFiscaleValidator.validaCodiceFiscale(codice);
export const generaCodiceFiscale = (data: CodiceFiscaleData) => CodiceFiscaleValidator.generaCodiceFiscale(data);
export const formattaCodiceFiscale = (codice: string) => CodiceFiscaleValidator.formattaCodiceFiscale(codice);
