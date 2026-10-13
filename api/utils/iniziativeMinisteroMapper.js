/**
 * Utility per mappare i dati da iniziative_ministero al formato atteso dal frontend
 * e viceversa, mantenendo la compatibilità con le tabelle vecchie
 */

const { normalizeMinisteroDate } = require('./dateUtils');
const { describeSourceRecord, getLegacyQueryProfile } = require('../services/civicProcessRegistryService');

const MINISTERO_JURISDICTION_ID = 'it';
const MINISTERO_SOURCE_ID = 'it.justice.signature_portal';

const MINISTERO_DETTAGLIO_BASE =
  'https://firmereferendum.giustizia.it/referendum/open/dettaglio-open';

/**
 * URL ufficiale di firma/dettaglio sul portale Ministero.
 * @param {string|number|null|undefined} idMinistero
 * @returns {string|null}
 */
function buildMinisteroFirmaUrl(idMinistero) {
  if (idMinistero == null || idMinistero === '') return null;
  return `${MINISTERO_DETTAGLIO_BASE}/${idMinistero}`;
}

/**
 * Preferisce il sito del comitato; se assente, usa la pagina ufficiale Ministero.
 * @param {string|null|undefined} sitoWeb
 * @param {string|number|null|undefined} idMinistero
 * @returns {string|null}
 */
function resolveFirmaUrl(sitoWeb, idMinistero) {
  if (sitoWeb) return sitoWeb;
  return buildMinisteroFirmaUrl(idMinistero);
}

/**
 * Mappa un record da iniziative_ministero al formato atteso dal frontend
 * (compatibile con iniziative_popolari e referendum_abrogativi)
 */
function mapToLegacyFormat(row, tipo) {
  // Usa esito se presente, altrimenti mappa da stato
  const esito = row.esito || mapStatoToEsito(row.stato);
  const dataInizio = normalizeMinisteroDate(row.data_inizio);
  // data_fine arriva dal DB (dal sito oppure salvata come inizio+6 mesi in sync)
  const dataFine = normalizeMinisteroDate(row.data_fine);
  const sitoWeb = resolveFirmaUrl(row.sito_web, row.id_ministero);
  const civicMetadata = describeSourceRecord({
    jurisdictionId: MINISTERO_JURISDICTION_ID,
    sourceId: MINISTERO_SOURCE_ID,
    rawType: row.tipo || tipo,
    sourceState: row.stato
  });
  
  return {
    id: row.id,
    nome: row.titolo, // titolo -> nome per compatibilità
    descrizione: row.descrizione || '',
    data_inizio: dataInizio,
    data_fine: dataFine,
    dataInizio: dataInizio, // formato camelCase per frontend
    dataFine: dataFine, // formato camelCase per frontend
    sito_web: sitoWeb,
    sitoweb: sitoWeb, // alias per compatibilità
    sitoWeb: sitoWeb, // formato camelCase per frontend
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
    updated_at: row.updated_at,
    jurisdiction_id: civicMetadata.jurisdictionId,
    civic_process_type_id: civicMetadata.civicProcessTypeId,
    civic_process_stage: civicMetadata.stageId,
    civic_process_source_id: civicMetadata.sourceId,
    signature_threshold: civicMetadata.signatureThreshold,
    demos_actions: civicMetadata.demosActions
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
  const dataInizio = normalizeMinisteroDate(row.dataInizio || row.data_inizio);
  // data_fine arriva dal DB (dal form oppure salvata come inizio+6 mesi)
  const dataFine = normalizeMinisteroDate(row.dataFine || row.data_fine);
  const sitoWeb = row.sitoWeb || row.sito_web;
  
  // Mappa status/stato (tabella può avere "stato" dopo migrazione che rimuove "status")
  const stato = row.stato || mapStatusToStato(row.status);
  
  // Determina quorum_raggiunto basandosi su quorum o quorum_raggiunto
  let quorum_raggiunto = false;
  if (row.quorum_raggiunto === true) {
    quorum_raggiunto = true;
  } else if (row.quorum === 'ok' || row.quorum === 'OK') {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'number' && row.quorum > 0) {
    quorum_raggiunto = true;
  } else if (typeof row.quorum === 'string' && /^\d+$/.test(row.quorum) && parseInt(row.quorum) > 0) {
    quorum_raggiunto = true;
  }
  
  // Mappa esito da stato/status o quorum
  let esito = 'In Attesa';
  if (row.stato === 'conclusa') {
    esito = 'Conclusa';
  } else if (row.status) {
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
    status: row.status || row.stato
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
  const dataInizio = normalizeMinisteroDate(row.dataInizio || row.data_inizio);
  const dataFine = normalizeMinisteroDate(row.dataFine || row.data_fine);
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
  const profile = getLegacyQueryProfile(tipoFilter);
  const sqlLikePatterns = profile?.sqlLikePatterns?.length
    ? [...profile.sqlLikePatterns]
    : [`%${String(tipoFilter || '').trim()}%`];
  const typeParams = [...sqlLikePatterns];
  const tipoCondition = sqlLikePatterns.length === 1
    ? 'tipo LIKE $1'
    : `(${sqlLikePatterns.map((_, index) => `tipo LIKE $${index + 1}`).join(' OR ')})`;

  const buildThresholdClause = () => {
    const threshold = profile?.signatureThreshold;
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return { clause: 'AND FALSE', params: typeParams };
    }
    const thresholdParam = `$${typeParams.length + 1}`;
    return {
      clause: `AND quorum_raggiunto = true\n            AND firme_raccolte >= ${thresholdParam}`,
      params: [...typeParams, threshold]
    };
  };

  if (votaOnly) {
    const threshold = buildThresholdClause();
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE ${tipoCondition}
          AND id_ministero IS NOT NULL
          ${threshold.clause}
        ORDER BY data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: threshold.params
    };
  }

  if (soloInCorso) {
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE ${tipoCondition}
          AND id_ministero IS NOT NULL
          AND stato = 'in_corso'
          AND (data_fine IS NULL OR data_fine >= CURRENT_DATE)
        ORDER BY firme_raccolte DESC NULLS LAST, data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: typeParams
    };
  }

  // Vista ampia compatibile con gli strumenti amministrativi/legacy.
  // Per gli utenti ordinari resta comunque limitata alle fonti ufficiali con id_ministero.
  const officialOnly = userRole === 'AD' ? '' : 'AND id_ministero IS NOT NULL';
  return {
    query: `
      SELECT *
      FROM iniziative_ministero
      WHERE ${tipoCondition}
        ${officialOnly}
      ORDER BY CASE WHEN stato = 'in_corso' THEN 0 ELSE 1 END,
               firme_raccolte DESC NULLS LAST,
               data_inizio DESC NULLS LAST,
               created_at DESC
    `,
    params: typeParams
  };
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
  mapReferendumStatusToStato,
  buildMinisteroFirmaUrl,
  resolveFirmaUrl
};

