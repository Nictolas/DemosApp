/**
 * Utility per mappare i dati da iniziative_ministero al formato atteso dal frontend
 * e viceversa, mantenendo la compatibilità con le tabelle vecchie
 */

/**
 * Mappa un record da iniziative_ministero al formato atteso dal frontend
 * (compatibile con iniziative_popolari e referendum_abrogativi)
 */
function mapToLegacyFormat(row, tipo) {
  // Usa esito se presente, altrimenti mappa da stato
  const esito = row.esito || mapStatoToEsito(row.stato);
  
  return {
    id: row.id,
    nome: row.titolo, // titolo -> nome per compatibilità
    descrizione: row.descrizione || '',
    data_inizio: row.data_inizio,
    data_fine: row.data_fine,
    dataInizio: row.data_inizio, // formato camelCase per frontend
    dataFine: row.data_fine, // formato camelCase per frontend
    sito_web: row.sito_web,
    sitoweb: row.sito_web, // alias per compatibilità
    sitoWeb: row.sito_web, // formato camelCase per frontend
    quorum: 0, // Campo legacy per compatibilità, sempre 0 (non più usato)
    esito: esito, // usa la colonna esito se presente, altrimenti mappa da stato
    firme: row.firme_raccolte || 0, // firme_raccolte -> firme
    votiices: 0, // campo legacy, può essere calcolato dai voti
    created_at: row.created_at,
    data_creazione: row.created_at, // alias per compatibilità
    // Campi aggiuntivi dalla nuova tabella
    tipo: row.tipo || tipo,
    stato: row.stato,
    firme_raccolte: row.firme_raccolte,
    quorum_raggiunto: row.quorum_raggiunto,
    id_ministero: row.id_ministero,
    dati_raw: row.dati_raw,
    data_ultimo_aggiornamento: row.data_ultimo_aggiornamento,
    updated_at: row.updated_at
  };
}

/**
 * Mappa lo stato della nuova tabella all'esito della vecchia tabella
 */
function mapStatoToEsito(stato) {
  if (!stato) return 'In Attesa';
  
  const statoLower = stato.toLowerCase();
  
  // Mapping degli stati comuni
  const mapping = {
    'in_corso': 'In Attesa',
    'conclusa': 'Conclusa',
    'approvata': 'Approvata',
    'rifiutata': 'Rifiutata',
    'in_attesa': 'In Attesa',
    'attiva': 'In Attesa'
  };
  
  return mapping[statoLower] || stato;
}

/**
 * Mappa l'esito della vecchia tabella allo stato della nuova tabella
 */
function mapEsitoToStato(esito) {
  if (!esito) return 'in_corso';
  
  const esitoLower = esito.toLowerCase();
  
  const mapping = {
    'in attesa': 'in_corso',
    'conclusa': 'conclusa',
    'approvata': 'conclusa',
    'rifiutata': 'conclusa',
    'proposta': 'in_corso' // per le proposte degli utenti
  };
  
  return mapping[esitoLower] || 'in_corso';
}


/**
 * Costruisce una query per iniziative_ministero con filtri compatibili
 * 
 * @param {string} tipoFilter - Il tipo da filtrare: 'iniziativa' per iniziative popolari, 'referendum' per referendum abrogativi
 * @param {string} userRole - Ruolo utente
 * @param {string} userId - ID utente (opzionale)
 * @param {boolean} votaOnly - Se true, mostra solo quelle con quorum_raggiunto = TRUE (per pagine di voto)
 * @param {boolean} soloInCorso - Se true, mostra solo quelle con stato = 'in_corso' e ordina per firme_raccolte DESC
 */
function buildQueryForTipo(tipoFilter, userRole, userId = null, votaOnly = false, soloInCorso = false) {
  // Mappa i tipi generici ai valori effettivi nella colonna tipo
  let tipoValue;
  if (tipoFilter === 'iniziativa') {
    // Per iniziative popolari, cerca "Legge di iniziativa popolare" o varianti
    tipoValue = "Legge di iniziativa popolare";
  } else if (tipoFilter === 'referendum') {
    // Per referendum, cerca "Referendum abrogativo" o varianti
    // NOTA: Nel database può essere "Referendum abrogativo" (1 spazio) o "Referendum  abrogativo" (2 spazi)
    // Usiamo un pattern che gestisce uno o più spazi tra "Referendum" e "abrogativo"
    // Il pattern '%Referendum%abrogativo%' matcha qualsiasi numero di caratteri (inclusi spazi) tra le due parole
    tipoValue = "Referendum%abrogativo"; // Il % gestisce 0, 1 o più caratteri (spazi inclusi)
  } else {
    // Se viene passato direttamente un valore, usalo
    tipoValue = tipoFilter;
  }
  
  if (userRole === "AD") {
    // Admin vedono tutto (con LIKE per gestire varianti del nome)
    // Ma se soloInCorso è true, anche gli admin vedono solo quelle con stato = 'in_corso'
    if (soloInCorso) {
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE tipo LIKE $1
            AND stato = 'in_corso'
          ORDER BY firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC
        `,
        params: [`%${tipoValue}%`]
      };
    }
    // Admin vedono TUTTI i referendum (in corso e conclusi), anche senza id_ministero
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE tipo LIKE $1
        ORDER BY CASE WHEN stato = 'in_corso' THEN 0 ELSE 1 END, firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: [`%${tipoValue}%`]
    };
  } else {
    // Altri utenti vedono solo le iniziative/referendum ufficiali che:
    // Se votaOnly = true (pagine di voto): 
    // - quorum_raggiunto = TRUE
    // - ESCLUDE TUTTE quelle con stato = 'in_corso' (INDIPENDENTEMENTE dal quorum)
    // Altrimenti:
    //   1. Hanno quorum_raggiunto = FALSE E stato = 'in_corso' (raccolta firme in corso)
    //   2. Hanno quorum_raggiunto = TRUE (indipendentemente dallo stato, hanno raggiunto il quorum)
    // ESCLUSE: quelle con quorum_raggiunto = FALSE E stato = 'conclusa'
    if (votaOnly) {
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE tipo LIKE $1
            AND id_ministero IS NOT NULL
            AND quorum_raggiunto = true
            AND stato != 'in_corso'
          ORDER BY data_inizio DESC NULLS LAST, created_at DESC
        `,
        params: [`%${tipoValue}%`]
      };
      } else {
        // Se soloInCorso è true, mostra solo quelle con stato = 'in_corso'
        // Altrimenti mostra TUTTE (in corso, concluse, con o senza quorum) - solo quelle ufficiali (con id_ministero)
        let whereClause;
        let orderClause;
        
        if (soloInCorso) {
          // Per la pagina listing, mostra solo quelli in corso
          // Filtriamo per id_ministero IS NOT NULL per mostrare solo quelli ufficiali
          whereClause = `tipo LIKE $1
            AND id_ministero IS NOT NULL
            AND stato = 'in_corso'`;
          // Ordina per firme_raccolte in ordine decrescente (più firme in alto)
          orderClause = `firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC`;
        } else {
          // Mostra TUTTI i referendum ufficiali (con id_ministero), indipendentemente dallo stato
          // Questo include: in corso, concluse, con o senza quorum
          // NOTA: Per la pagina listing (soloInCorso = true), questo blocco non viene eseguito
          // Questo blocco viene eseguito solo quando soloInCorso = false (per esempio per admin o altre viste)
          whereClause = `tipo LIKE $1
            AND id_ministero IS NOT NULL`;
          // Ordina: prima quelli in corso (per stato), poi per data_inizio decrescente
          orderClause = `CASE WHEN stato = 'in_corso' THEN 0 ELSE 1 END, firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC`;
        }
      
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE ${whereClause}
          ORDER BY ${orderClause}
        `,
        params: [`%${tipoValue}%`]
      };
    }
  }
}

module.exports = {
  mapToLegacyFormat,
  mapStatoToEsito,
  mapEsitoToStato,
  buildQueryForTipo
};

