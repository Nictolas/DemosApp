/**
 * Questo file contiene le interfacce TypeScript condivise per l'intera applicazione.
 * Include sia i modelli di dati per il database (backend) che i modelli 
 * per la UI e la gestione dei dati nel frontend.
 */

// =========================================================
// MODELLI PRINCIPALI DEL DATABASE
// Descrivono la struttura dei dati come salvati su Firestore
// =========================================================

/**
 * Interfaccia base per tutti i documenti Firestore, con campi comuni.
 */
export interface DocumentoBase {
  id?: string; // ID del documento Firestore
  uid?: string; // UID dell'utente Firebase Auth, se applicabile
  createdAt?: string; // Timestamp ISO di creazione
  updatedAt?: string; // Timestamp ISO dell'ultimo aggiornamento
}

/**
 * Modello completo dell'utente. Sostituisce e unisce il vecchio 'UserInfo'.
 * Usare sempre questo tipo per rappresentare un utente.
 */
export interface Utente extends DocumentoBase {
  // Campi di sistema e autenticazione
  email: string;
  status?: 'pending' | 'active' | 'rejected';
  premium?: boolean;

  // Dati anagrafici e del profilo (OBBLIGATORI)
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;

  // Dati di residenza (OBBLIGATORI)
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;

  // Dati di elezione (dove l'utente vota)
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;

  // Dati di candidatura (se l'utente è un politico)
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;

  // Ruolo e grado nell'applicazione
  ruolo: 'Elettore' | 'Politico' | 'Candidato' | 'Candidato Politico' | 'Admin';
  grado_elezione?: string;
  grado_candidatura?: string;

  // Permette di aggiungere altri campi non definiti esplicitamente
  [key: string]: any;
}

/**
 * Modello per le opinioni espresse da un utente su vari temi.
 */
export interface UserOpinions {
  energia_nucleare?: 'favorevole' | 'contrario' | 'astenuto' | '';
  sperimentazione_animale?: 'favorevole' | 'contrario' | 'astenuto' | '';
  legalizzazione_canapa?: 'favorevole' | 'contrario' | 'astenuto' | '';
  caccia?: 'favorevole' | 'contrario' | 'astenuto' | '';
  unione_europea?: 'favorevole' | 'contrario' | 'astenuto' | '';
}

/**
 * Modello generico per un voto registrato nel database.
 */
export interface Voto extends DocumentoBase {
  userId: string;
  nome: string; // Nome dell'entità votata (es. candidato, legge)
  timestamp?: string;
}

/**
 * Modello per un singolo elemento in una classifica.
 */
export interface ClassificaItem {
  nome: string;
  voti: number;
}


// =========================================================
// MODELLI PER LA UI E DATI GEOGRAFICI
// Usati principalmente per popolare componenti nel frontend
// =========================================================

/**
 * Struttura dei dati per popolare i menu a tendina delle località.
 */
export interface LocationData {
  [country: string]: {
    regioni: Region[];
  };
}

/**
 * Rappresenta una singola regione con le sue province.
 */
export interface Region {
  nome: string;
  province: Province[];
}

/**
 * Rappresenta una singola provincia con i suoi comuni.
 */
export interface Province {
  nome: string;
  comuni: string[];
}