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
 * Mappa un record da iniziative_popolari al formato atteso dal frontend
 * (compatibile con il formato legacy)
 */
function mapIniziativePopolariToLegacyFormat(row) {
  // Normalizza le date (gestisce sia camelCase che snake_case)
  const dataInizio = row.dataInizio || row.data_inizio;
  const dataFine = row.dataFine || row.data_fine;
  const sitoWeb = row.sitoWeb || row.sito_web;
  
  // Mappa status a stato
  const stato = mapStatusToStato(row.status);
  
  // Determina quorum_raggiunto basandosi su quorum
  // Se quorum è 'ok' o un numero > 0, consideralo raggiunto
  let quorum_raggiunto = false;
  if (row.quorum === 'ok' || row.quorum === 'OK') {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'number' && row.quorum > 0) {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'string' && /^\d+$/.test(row.quorum) && parseInt(row.quorum) > 0) {
    quorum_raggiunto = true;
  }
  
  // Mappa esito da status o quorum
  let esito = 'In Attesa';
  if (row.status) {
    esito = mapStatusToEsito(row.status);
  } else if (row.quorum === 'ok' || row.quorum === 'OK') {
    esito = 'Approvata';
  } else if (row.quorum === 'proposta') {
    esito = 'In Attesa';
  }
  
  return {
    id: row.id,
    nome: row.nome,
    descrizione: row.descrizione || '',
    data_inizio: dataInizio,
    data_fine: dataFine,
    dataInizio: dataInizio, // formato camelCase per frontend
    dataFine: dataFine, // formato camelCase per frontend
    sito_web: sitoWeb,
    sitoweb: sitoWeb, // alias per compatibilità
    sitoWeb: sitoWeb, // formato camelCase per frontend
    quorum: row.quorum || 0,
    esito: esito,
    firme: row.firme || 0,
    firme_raccolte: row.firme || 0, // alias per compatibilità
    votiices: 0, // campo legacy, può essere calcolato dai voti
    created_at: row.created_at || row.createdAt,
    data_creazione: row.created_at || row.createdAt || row.data_creazione, // alias per compatibilità
    // Campi aggiuntivi per compatibilità
    tipo: 'iniziativa',
    stato: stato,
    quorum_raggiunto: quorum_raggiunto,
    userId: row.userId || row.userid,
    status: row.status
  };
}

/**
 * Mappa status (da iniziative_popolari) a stato (formato iniziative_ministero)
 */
function mapStatusToStato(status) {
  if (!status) return 'in_corso';
  
  const statusLower = status.toLowerCase();
  
  const mapping = {
    'pending': 'in_corso',
    'in attesa': 'in_corso',
    'in_corso': 'in_corso',
    'conclusa': 'conclusa',
    'approvata': 'conclusa',
    'rifiutata': 'conclusa',
    'attiva': 'in_corso'
  };
  
  return mapping[statusLower] || 'in_corso';
}

/**
 * Mappa status (da iniziative_popolari) a esito (formato legacy)
 */
function mapStatusToEsito(status) {
  if (!status) return 'In Attesa';
  
  const statusLower = status.toLowerCase();
  
  const mapping = {
    'pending': 'In Attesa',
    'in attesa': 'In Attesa',
    'in_corso': 'In Attesa',
    'conclusa': 'Conclusa',
    'approvata': 'Approvata',
    'rifiutata': 'Rifiutata',
    'attiva': 'In Attesa'
  };
  
  return mapping[statusLower] || 'In Attesa';
}

/**
 * Mappa un record da referendum_abrogativi al formato atteso dal frontend
 * (compatibile con il formato legacy)
 */
function mapReferendumAbrogativiToLegacyFormat(row) {
  // Normalizza le date (gestisce sia camelCase che snake_case)
  const dataInizio = row.dataInizio || row.data_inizio;
  const dataFine = row.dataFine || row.data_fine;
  const sitoWeb = row.sitoWeb || row.sito_web || row.sitoweb;
  
  // Mappa status a stato
  // La tabella referendum_abrogativi usa 'A'/'a' per approvato, 'P'/'p' per pending
  const stato = mapReferendumStatusToStato(row.status);
  
  // Determina quorum_raggiunto
  // PRIMA controlla se esiste già la colonna quorum_raggiunto nel database (priorità massima)
  // POI fallback su status e quorum per compatibilità
  let quorum_raggiunto = false;
  if (row.quorum_raggiunto !== undefined && row.quorum_raggiunto !== null) {
    // Usa direttamente il valore dal database se esiste
    quorum_raggiunto = Boolean(row.quorum_raggiunto);
  } else if (row.status === 'A' || row.status === 'a') {
    // Fallback: se status è 'A' o 'a' (approvato), consideralo raggiunto
    quorum_raggiunto = true;
  } else if (row.quorum === 'ok' || row.quorum === 'OK') {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'number' && row.quorum > 0) {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'string' && /^\d+$/.test(row.quorum) && parseInt(row.quorum) > 0) {
    quorum_raggiunto = true;
  }
  
  // Mappa esito da status
  let esito = 'In Attesa';
  if (row.status === 'A' || row.status === 'a') {
    esito = 'Approvata';
  } else if (row.status === 'P' || row.status === 'p') {
    esito = 'In Attesa';
  } else if (row.quorum === 'ok' || row.quorum === 'OK') {
    esito = 'Approvata';
  } else if (row.quorum === 'proposta') {
    esito = 'In Attesa';
  }
  
  return {
    id: row.id,
    nome: row.nome,
    descrizione: row.descrizione || '',
    data_inizio: dataInizio,
    data_fine: dataFine,
    dataInizio: dataInizio, // formato camelCase per frontend
    dataFine: dataFine, // formato camelCase per frontend
    sito_web: sitoWeb,
    sitoweb: sitoWeb, // alias per compatibilità
    sitoWeb: sitoWeb, // formato camelCase per frontend
    quorum: row.quorum || 0,
    esito: esito,
    firme: row.firme || 0,
    firme_raccolte: row.firme || 0, // alias per compatibilità
    votiices: 0, // campo legacy, può essere calcolato dai voti
    created_at: row.created_at || row.createdAt || row.data_creazione || new Date().toISOString(),
    data_creazione: row.created_at || row.createdAt || row.data_creazione || new Date().toISOString(), // alias per compatibilità
    // Campi aggiuntivi per compatibilità
    tipo: 'referendum',
    stato: stato,
    quorum_raggiunto: quorum_raggiunto,
    userId: row.userId || row.userid,
    status: row.status,
    firestore_id_backup: row.firestore_id_backup // per compatibilità con voti
  };
}

/**
 * Mappa status (da referendum_abrogativi) a stato (formato iniziative_ministero)
 * Status può essere 'A'/'a' (approvato) o 'P'/'p' (pending)
 */
function mapReferendumStatusToStato(status) {
  if (!status) return 'in_corso';
  
  const statusUpper = status.toUpperCase();
  
  // 'A' o 'a' = approvato = conclusa (perché può essere votato)
  // 'P' o 'p' = pending = in_corso
  if (statusUpper === 'A') {
    return 'conclusa'; // Approvato significa che può essere votato (quorum raggiunto)
  } else if (statusUpper === 'P') {
    return 'in_corso'; // Pending significa ancora in raccolta firme
  }
  
  return 'in_corso';
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
    // NOTA: Potrebbe avere spazi multipli come i referendum, usiamo pattern flessibile
    tipoValue = "Legge%di%iniziativa%popolare"; // Il % gestisce spazi multipli
  } else if (tipoFilter === 'referendum') {
    // Per referendum, cerca sia "Referendum abrogativo" che "Referendum costituzionale"
    // NOTA: Nel database può essere "Referendum abrogativo" (1 spazio) o "Referendum  abrogativo" (2 spazi)
    // Usiamo un pattern che gestisce uno o più spazi tra "Referendum" e "abrogativo"/"costituzionale"
    // Il pattern '%Referendum%abrogativo%' matcha qualsiasi numero di caratteri (inclusi spazi) tra le due parole
    // Per includere entrambi i tipi, useremo una condizione OR nella query
    tipoValue = null; // Segnale speciale per indicare che dobbiamo usare OR per entrambi i tipi
  } else {
    // Se viene passato direttamente un valore, usalo
    tipoValue = tipoFilter;
  }
  
  if (userRole === "AD") {
    // Admin vedono tutto (con LIKE per gestire varianti del nome)
    // Ma se votaOnly è true, anche gli admin devono vedere solo quelle con quorum_raggiunto = TRUE, stato = 'conclusa' e firme_raccolte >= 500000 (per referendum)
    // Per iniziative: firme_raccolte >= 50000, per referendum: firme_raccolte >= 500000
    if (votaOnly) {
      const firmeMinime = tipoFilter === 'referendum' ? 500000 : 50000;
      // Se tipoValue è null, significa che dobbiamo includere sia abrogativi che costituzionali
      const tipoCondition = tipoValue === null 
        ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
        : `tipo LIKE $1`;
      const params = tipoValue === null ? [] : [`%${tipoValue}%`];
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE ${tipoCondition}
            AND id_ministero IS NOT NULL
            AND quorum_raggiunto = true
            AND stato = 'conclusa'
            AND firme_raccolte >= ${firmeMinime}
          ORDER BY data_inizio DESC NULLS LAST, created_at DESC
        `,
        params: params
      };
    }
    // Se soloInCorso è true, anche gli admin vedono solo quelle con stato = 'in_corso'
    if (soloInCorso) {
      const tipoCondition = tipoValue === null 
        ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
        : `tipo LIKE $1`;
      const params = tipoValue === null ? [] : [`%${tipoValue}%`];
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE ${tipoCondition}
            AND stato = 'in_corso'
            AND (data_fine IS NULL OR data_fine >= CURRENT_DATE)
          ORDER BY firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC
        `,
        params: params
      };
    }
    // Admin vedono TUTTI i referendum (in corso e conclusi), anche senza id_ministero
    const tipoCondition = tipoValue === null 
      ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
      : `tipo LIKE $1`;
    const params = tipoValue === null ? [] : [`%${tipoValue}%`];
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE ${tipoCondition}
        ORDER BY CASE WHEN stato = 'in_corso' THEN 0 ELSE 1 END, firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: params
    };
  } else {
    // Altri utenti vedono solo le iniziative/referendum ufficiali che:
    // Se votaOnly = true (pagine di voto): 
    // - quorum_raggiunto = TRUE
    // - stato = 'conclusa' (per votare la priorità delle iniziative già concluse)
    // - firme_raccolte >= 50000 (iniziative) o >= 500000 (referendum)
    // Altrimenti:
    //   1. Hanno quorum_raggiunto = FALSE E stato = 'in_corso' (raccolta firme in corso)
    //   2. Hanno quorum_raggiunto = TRUE (indipendentemente dallo stato, hanno raggiunto il quorum)
    // ESCLUSE: quelle con quorum_raggiunto = FALSE E stato = 'conclusa'
    if (votaOnly) {
      const firmeMinime = tipoFilter === 'referendum' ? 500000 : 50000;
      const tipoCondition = tipoValue === null 
        ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
        : `tipo LIKE $1`;
      const params = tipoValue === null ? [] : [`%${tipoValue}%`];
      return {
        query: `
          SELECT *
          FROM iniziative_ministero
          WHERE ${tipoCondition}
            AND id_ministero IS NOT NULL
            AND quorum_raggiunto = true
            AND stato = 'conclusa'
            AND firme_raccolte >= ${firmeMinime}
          ORDER BY data_inizio DESC NULLS LAST, created_at DESC
        `,
        params: params
      };
      } else {
        // Se soloInCorso è true, mostra solo quelle con stato = 'in_corso'
        // Altrimenti mostra TUTTE (in corso, concluse, con o senza quorum) - solo quelle ufficiali (con id_ministero)
        let whereClause;
        let orderClause;
        
        const tipoCondition = tipoValue === null 
          ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
          : `tipo LIKE $1`;
        const params = tipoValue === null ? [] : [`%${tipoValue}%`];
        
        if (soloInCorso) {
          // Per la pagina listing, mostra solo quelli in corso e non scaduti (data_fine >= oggi)
          // Filtriamo per id_ministero IS NOT NULL per mostrare solo quelli ufficiali
          whereClause = `${tipoCondition}
            AND id_ministero IS NOT NULL
            AND stato = 'in_corso'
            AND (data_fine IS NULL OR data_fine >= CURRENT_DATE)`;
          // Ordina per firme_raccolte in ordine decrescente (più firme in alto)
          orderClause = `firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC`;
        } else {
          // Mostra TUTTI i referendum ufficiali (con id_ministero), indipendentemente dallo stato
          // Questo include: in corso, concluse, con o senza quorum
          // NOTA: Per la pagina listing (soloInCorso = true), questo blocco non viene eseguito
          // Questo blocco viene eseguito solo quando soloInCorso = false (per esempio per admin o altre viste)
          whereClause = `${tipoCondition}
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
        params: params
      };
    }
  }
}

module.exports = {
  mapToLegacyFormat,
  mapStatoToEsito,
  mapEsitoToStato,
  buildQueryForTipo,
  mapIniziativePopolariToLegacyFormat,
  mapStatusToStato,
  mapStatusToEsito,
  mapReferendumAbrogativiToLegacyFormat,
  mapReferendumStatusToStato
};

