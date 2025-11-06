/**
 * Utility per mappare i dati da iniziative_ministero al formato atteso dal frontend
 * e viceversa, mantenendo la compatibilità con le tabelle vecchie
 */

/**
 * Mappa un record da iniziative_ministero al formato atteso dal frontend
 * (compatibile con iniziative_popolari e referendum_abrogativi)
 */
function mapToLegacyFormat(row, tipo) {
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
    quorum: row.quorum, // INTEGER nella nuova tabella, ma il frontend potrebbe aspettarsi VARCHAR
    esito: mapStatoToEsito(row.stato), // stato -> esito per compatibilità
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
    promotore: row.promotore,
    documento: row.documento,
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
 * Mappa un quorum VARCHAR (vecchia tabella) a INTEGER (nuova tabella)
 * Se è una stringa numerica, la converte. Se è 'proposta', restituisce 0.
 */
function mapQuorumToInteger(quorum) {
  if (quorum === null || quorum === undefined) return 0;
  if (quorum === 'proposta') return 0;
  if (typeof quorum === 'number') return quorum;
  if (typeof quorum === 'string') {
    const parsed = parseInt(quorum, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Mappa un quorum INTEGER (nuova tabella) a VARCHAR (vecchia tabella)
 * Per compatibilità con il frontend che potrebbe aspettarsi 'proposta' per le proposte utente
 */
function mapQuorumToString(quorum, isProposta = false) {
  if (isProposta) return 'proposta';
  if (quorum === null || quorum === undefined) return 'ok';
  if (typeof quorum === 'string') return quorum;
  return quorum.toString();
}

/**
 * Costruisce una query per iniziative_ministero con filtri compatibili
 */
function buildQueryForTipo(tipo, userRole, userId = null) {
  if (userRole === "AD") {
    // Admin vedono tutto
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE tipo = $1
        ORDER BY data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: [tipo]
    };
  } else {
    // Altri utenti vedono solo le iniziative/referendum ufficiali
    // (non proposte utente, quindi quorum > 0 o quorum_raggiunto = false)
    // e con stato 'in_corso' o equivalente a 'In Attesa'
    return {
      query: `
        SELECT *
        FROM iniziative_ministero
        WHERE tipo = $1
          AND (quorum > 0 OR quorum_raggiunto = false)
          AND (stato = 'in_corso' OR stato IS NULL OR stato = 'in attesa')
        ORDER BY data_inizio DESC NULLS LAST, created_at DESC
      `,
      params: [tipo]
    };
  }
}

module.exports = {
  mapToLegacyFormat,
  mapStatoToEsito,
  mapEsitoToStato,
  mapQuorumToInteger,
  mapQuorumToString,
  buildQueryForTipo
};

