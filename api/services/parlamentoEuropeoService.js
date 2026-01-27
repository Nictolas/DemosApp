const axios = require('axios');
const { getPool } = require('../config/database');
const { getVotiMEPItalianiDaParltrack, salvaVotiMEPItaliani } = require('./parltrackService');

const API_BASE = 'https://data.europarl.europa.eu/api/v2';

// Usa il pool centralizzato ottimizzato
const pool = getPool();

/**
 * Assicura che la tabella parlamento_europeo esista
 */
async function ensureTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parlamento_europeo (
        id SERIAL PRIMARY KEY,
        uri TEXT NOT NULL UNIQUE,
        votazione_id TEXT,
        titolo TEXT NOT NULL,
        descrizione TEXT,
        data_votazione DATE,
        esito VARCHAR(50),
        sessione_id TEXT,
        sessione_data DATE,
        sessione_label TEXT,
        favorevoli INTEGER,
        contrari INTEGER,
        astenuti INTEGER,
        presenti INTEGER,
        votanti INTEGER,
        termine_parlamentare TEXT,
        metadati JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crea indici
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_uri ON parlamento_europeo(uri)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data_votazione ON parlamento_europeo(data_votazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_esito ON parlamento_europeo(esito)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_sessione_id ON parlamento_europeo(sessione_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data_sincronizzazione ON parlamento_europeo(data_sincronizzazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_metadati_gin ON parlamento_europeo USING GIN (metadati)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data ON parlamento_europeo(data_votazione DESC NULLS LAST)`);
    
    // Crea tabella voti nominali
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parlamento_europeo_voti_nominali (
        id SERIAL PRIMARY KEY,
        uri_votazione TEXT NOT NULL,
        mep_id TEXT NOT NULL,
        nome_mep TEXT NOT NULL,
        cognome_mep TEXT,
        nome_completo TEXT NOT NULL,
        paese VARCHAR(2) NOT NULL DEFAULT 'IT',
        gruppo_politico TEXT,
        voto VARCHAR(20) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto', 'Assente')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uri_votazione, mep_id)
      )
    `);
    
    // Crea indici per voti nominali
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_votazione ON parlamento_europeo_voti_nominali(uri_votazione)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_mep_id ON parlamento_europeo_voti_nominali(mep_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_paese ON parlamento_europeo_voti_nominali(paese)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_voto ON parlamento_europeo_voti_nominali(voto)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_voto ON parlamento_europeo_voti_nominali(uri_votazione, voto)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_paese_voto ON parlamento_europeo_voti_nominali(uri_votazione, paese, voto)`);
    
    console.log('✅ Tabella parlamento_europeo verificata/creata');
    console.log('✅ Tabella parlamento_europeo_voti_nominali verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabelle:', error);
    throw error;
  }
}

/**
 * Recupera le ultime sessioni plenarie dal PE
 * Ordina per data decrescente per ottenere le più recenti
 */
async function fetchUltimeSessioni(limit = 10) {
  try {
    console.log(`📡 Chiamata API PE: ${API_BASE}/meetings con limit=${limit}`);
    
    // Prova prima con un limit più alto per poi ordinare e prendere le più recenti
    // L'API potrebbe non restituire le sessioni ordinate, quindi recuperiamo più dati
    const limitApi = Math.max(limit * 3, 50); // Recupera almeno 50 sessioni per avere abbastanza dati recenti
    
    const response = await axios.get(`${API_BASE}/meetings`, {
      params: {
        limit: limitApi,
        offset: 0
      },
      headers: {
        'Accept': 'application/ld+json',
        'User-Agent': 'DemosApp-1.0.0'
      }
    });
    
    console.log(`✅ Risposta API ricevuta, status: ${response.status}`);
    console.log(`📦 Tipo dati: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);
    
    // L'API restituisce un array o un oggetto con 'data'
    let sessioni = [];
    if (Array.isArray(response.data)) {
      sessioni = response.data;
    } else if (response.data && Array.isArray(response.data)) {
      sessioni = response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      sessioni = response.data.data;
    } else if (response.data && typeof response.data === 'object') {
      // Prova a estrarre da altre strutture possibili
      console.log('⚠️ Formato risposta non riconosciuto, chiavi disponibili:', Object.keys(response.data));
      // Se è un oggetto JSON-LD, potrebbe essere un singolo elemento o un array in una proprietà
      if (response.data['@graph'] && Array.isArray(response.data['@graph'])) {
        sessioni = response.data['@graph'];
      }
    }
    
    console.log(`📊 Sessioni estratte prima dell'ordinamento: ${sessioni.length}`);
    
    // ORDINA le sessioni per data decrescente (più recenti prima)
    sessioni.sort((a, b) => {
      // Estrai le date dalle sessioni
      const dataA = a['activity_date'] || a['activity_start_date'] || a['start_date'] || a['date'] || '';
      const dataB = b['activity_date'] || b['activity_start_date'] || b['start_date'] || b['date'] || '';
      
      // Se entrambe hanno date, ordina per data decrescente
      if (dataA && dataB) {
        const dateA = new Date(dataA);
        const dateB = new Date(dataB);
        // Ordina decrescente (più recenti prima)
        return dateB - dateA;
      }
      
      // Se solo una ha data, quella con data va prima
      if (dataA && !dataB) return -1;
      if (!dataA && dataB) return 1;
      
      // Se nessuna ha data, prova a estrarre dalla data nell'ID
      const idA = a['id'] || a['activity_id'] || '';
      const idB = b['id'] || b['activity_id'] || '';
      
      // Estrai anno-mese-giorno dall'ID (formato: MTG-PL-YYYY-MM-DD)
      const matchA = idA.match(/(\d{4})-(\d{2})-(\d{2})/);
      const matchB = idB.match(/(\d{4})-(\d{2})-(\d{2})/);
      
      if (matchA && matchB) {
        const dateA = new Date(matchA[1], matchA[2] - 1, matchA[3]);
        const dateB = new Date(matchB[1], matchB[2] - 1, matchB[3]);
        return dateB - dateA; // Decrescente
      }
      
      if (matchA) return -1;
      if (matchB) return 1;
      
      // Se non riesci a ordinare, mantieni l'ordine originale
      return 0;
    });
    
    // Prendi solo le prime 'limit' sessioni (le più recenti)
    const sessioniOrdinate = sessioni.slice(0, limit);
    
    // Log delle date delle sessioni recuperate per debug
    console.log(`📅 Prime ${sessioniOrdinate.length} sessioni ordinate per data:`);
    sessioniOrdinate.forEach((sessione, index) => {
      const data = sessione['activity_date'] || sessione['activity_start_date'] || sessione['start_date'] || sessione['date'] || 'N/A';
      const id = sessione['id'] || sessione['activity_id'] || 'N/A';
      console.log(`   ${index + 1}. ${id} - Data: ${data}`);
    });
    
    return sessioniOrdinate;
  } catch (error) {
    console.error('❌ Errore nel recupero sessioni:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Headers:', error.response.headers);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    throw error;
  }
}

/**
 * Estrae le votazioni (VOT) da una sessione
 */
function estraiVotazioniDaSessione(sessione) {
  if (!sessione || !sessione['consists_of']) {
    return [];
  }
  
  // Filtra solo le attività che sono votazioni (hanno "VOT" nell'ID)
  return sessione['consists_of'].filter(id => 
    typeof id === 'string' && id.includes('-VOT-')
  );
}

/**
 * Recupera i risultati dei voti per una sessione
 */
async function fetchVoteResults(sessioneId) {
  try {
    const response = await axios.get(`${API_BASE}/meetings/${encodeURIComponent(sessioneId)}/vote-results`, {
      headers: {
        'Accept': 'application/ld+json',
        'User-Agent': 'DemosApp-1.0.0'
      }
    });
    
    // L'API restituisce un array o un oggetto con 'data'
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    // Se l'endpoint non esiste o restituisce 404, restituisci array vuoto
    if (error.response && error.response.status === 404) {
      console.log(`⚠️ Nessun risultato di votazione per sessione ${sessioneId}`);
      return [];
    }
    console.error(`❌ Errore nel recupero risultati voti per ${sessioneId}:`, error.message);
    return [];
  }
}

/**
 * Recupera i dettagli di una votazione direttamente dall'API
 */
async function fetchDettagliVotazioneDiretta(votazioneId) {
  try {
    // Costruisci l'URL per ottenere i dettagli della votazione
    // L'API del PE usa il formato: /api/v2/activities/{activityId}
    const activityId = votazioneId.split('/').pop();
    const url = `${API_BASE}/activities/${encodeURIComponent(activityId)}`;
    
    console.log(`📡 Fetch diretto votazione: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/ld+json',
        'User-Agent': 'DemosApp-1.0.0'
      },
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`   ⚠️ Votazione non trovata direttamente: ${votazioneId}`);
    } else {
      console.error(`⚠️ Errore nel fetch diretto votazione:`, error.message);
    }
    return null;
  }
}

/**
 * Estrae il titolo da un oggetto votazione cercando in tutti i campi possibili
 */
function estraiTitoloVotazione(votazioneData) {
  if (!votazioneData) return null;
  
  // Cerca in vari campi possibili, in ordine di priorità
  const campiPossibili = [
    'activity_label',
    'rdfs:label',
    'label',
    'title',
    'dcterms:title',
    'eli-dl:title',
    'name',
    'description',
    'dcterms:description'
  ];
  
  for (const campo of campiPossibili) {
    const valore = votazioneData[campo];
    if (valore) {
      // Se è una stringa, usala direttamente
      if (typeof valore === 'string' && valore.trim().length > 0) {
        return valore.trim();
      }
      // Se è un oggetto multilingue, preferisci italiano, poi inglese
      if (typeof valore === 'object' && valore !== null) {
        if (valore.it && valore.it.trim().length > 0) {
          return valore.it.trim();
        }
        if (valore.en && valore.en.trim().length > 0) {
          return valore.en.trim();
        }
        if (valore.fr && valore.fr.trim().length > 0) {
          return valore.fr.trim();
        }
        // Se è un array, prendi il primo elemento
        if (Array.isArray(valore) && valore.length > 0) {
          const primo = valore[0];
          if (typeof primo === 'string') {
            return primo.trim();
          } else if (primo && primo.it) {
            return primo.it.trim();
          } else if (primo && primo.en) {
            return primo.en.trim();
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Recupera i dettagli di una votazione
 * Prova a recuperare i risultati dei voti dall'endpoint vote-results
 * @param {string} votazioneId - URI o ID della votazione
 * @param {object} sessioneOrVoteResult - Sessione o voteResult dall'API
 */
async function estraiDettagliVotazione(votazioneId, sessioneOrVoteResult = {}) {
  // Estrai l'ID della votazione (ultima parte dopo l'ultimo slash)
  const parts = votazioneId.split('/');
  const votazioneIdShort = parts[parts.length - 1];
  
  // Determina se è una sessione o un voteResult
  const isVoteResult = sessioneOrVoteResult.date || sessioneOrVoteResult['@id'] || sessioneOrVoteResult.id?.includes('VOT');
  
  // Estrai informazioni dalla sessione o voteResult
  let dataSessione, sessioneLabel, termineParlamentare, sessioneId;
  
  if (isVoteResult) {
    // È un voteResult da /vote-results
    dataSessione = sessioneOrVoteResult.date || sessioneOrVoteResult['date'] || sessioneOrVoteResult.activity_date || sessioneOrVoteResult['activity_date'];
    sessioneLabel = sessioneOrVoteResult.label?.it || sessioneOrVoteResult.label?.en || 
                   sessioneOrVoteResult['rdfs:label']?.it || sessioneOrVoteResult['rdfs:label']?.en ||
                   sessioneOrVoteResult.title?.it || sessioneOrVoteResult.title?.en || '';
    termineParlamentare = sessioneOrVoteResult.parliamentary_term || sessioneOrVoteResult['parliamentary_term'] || null;
    sessioneId = sessioneOrVoteResult.activity_id || sessioneOrVoteResult['activity_id'] || 
                 sessioneOrVoteResult.id || sessioneOrVoteResult['@id'] || null;
    
    // Se non abbiamo la data, prova a estrarla dall'ID
    if (!dataSessione && sessioneId) {
      const match = sessioneId.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        dataSessione = `${year}-${month}-${day}`;
      }
    }
  } else {
    // È una sessione da /meetings
    dataSessione = sessioneOrVoteResult['activity_date'] || sessioneOrVoteResult['activity_start_date'];
    sessioneLabel = sessioneOrVoteResult['activity_label']?.['it'] || sessioneOrVoteResult['activity_label']?.['en'] || '';
    termineParlamentare = sessioneOrVoteResult['parliamentary_term'] || null;
    sessioneId = sessioneOrVoteResult['id'] || sessioneOrVoteResult['activity_id'];
  }
  
  // Prova a recuperare i risultati dei voti
  let favorevoli = null;
  let contrari = null;
  let astenuti = null;
  let presenti = null;
  let votanti = null;
  let esito = null;
  let titolo = `Votazione ${votazioneIdShort}`;
  let descrizione = null;
  let documentoVoti = null; // Link al documento con voti individuali
  
  // PRIMA: Prova a recuperare i dettagli direttamente dalla votazione
  try {
    const votazioneDiretta = await fetchDettagliVotazioneDiretta(votazioneId);
    if (votazioneDiretta) {
      const titoloEstratto = estraiTitoloVotazione(votazioneDiretta);
      if (titoloEstratto && titoloEstratto !== titolo) {
        titolo = titoloEstratto;
        console.log(`✅ Titolo estratto dalla votazione diretta: ${titolo}`);
      }
      
      // Estrai anche la descrizione se disponibile
      const descrizioneEstratta = estraiTitoloVotazione({ 
        description: votazioneDiretta.description || votazioneDiretta['dcterms:description'],
        'dcterms:description': votazioneDiretta['dcterms:description']
      });
      if (descrizioneEstratta) {
        descrizione = descrizioneEstratta;
      }
    }
  } catch (error) {
    console.log(`⚠️ Errore nel fetch diretto votazione:`, error.message);
  }
  
  // SECONDA: Se abbiamo già un voteResult, usalo direttamente
  let votazioneResult = null;
  if (isVoteResult) {
    votazioneResult = sessioneOrVoteResult;
  } else if (sessioneId) {
    // Altrimenti prova a recuperare i risultati dei voti dall'endpoint vote-results
    try {
      const voteResults = await fetchVoteResults(sessioneId);
      
      // Cerca la votazione specifica nei risultati
      votazioneResult = voteResults.find(vr => {
        const vrId = vr.id || vr.activity_id || vr['@id'] || '';
        return vrId === votazioneId || 
               vrId.includes(votazioneIdShort) ||
               vrId.includes(votazioneId);
      });
    } catch (error) {
      // L'endpoint vote-results potrebbe non essere disponibile per tutte le sessioni
      if (error.response && error.response.status !== 404) {
        console.error(`⚠️ Errore nel recupero dettagli votazione ${votazioneId}:`, error.message);
      }
    }
  }
  
  // Estrai informazioni dal voteResult se disponibile
  if (votazioneResult) {
    // Estrai link al documento con voti individuali
    if (votazioneResult['recorded_in_a_realization_of'] && Array.isArray(votazioneResult['recorded_in_a_realization_of'])) {
      const docRef = votazioneResult['recorded_in_a_realization_of'][0];
      if (typeof docRef === 'string') {
        documentoVoti = docRef;
      } else if (docRef && docRef.id) {
        documentoVoti = docRef.id;
      } else if (docRef && typeof docRef === 'object' && docRef['@id']) {
        documentoVoti = docRef['@id'];
      }
    }
    
    // Estrai statistiche aggregate se disponibili
    // Nota: questi sono solo totali, non voti individuali
    if (votazioneResult['eli-dl:vote_result_for'] || votazioneResult['vote_result_for']) {
      const voteData = votazioneResult['eli-dl:vote_result_for'] || votazioneResult['vote_result_for'];
      favorevoli = voteData['eli-dl:vote_result_in_favour'] || voteData['vote_result_in_favour'] || null;
      contrari = voteData['eli-dl:vote_result_against'] || voteData['vote_result_against'] || null;
      astenuti = voteData['eli-dl:vote_result_abstention'] || voteData['vote_result_abstention'] || null;
    }
    
    // Estrai conteggi dai campi votedFor/votedAgainst/votedAbstained se disponibili
    if (votazioneResult.votedFor && Array.isArray(votazioneResult.votedFor)) {
      favorevoli = votazioneResult.votedFor.length;
    }
    if (votazioneResult.votedAgainst && Array.isArray(votazioneResult.votedAgainst)) {
      contrari = votazioneResult.votedAgainst.length;
    }
    if (votazioneResult.votedAbstained && Array.isArray(votazioneResult.votedAbstained)) {
      astenuti = votazioneResult.votedAbstained.length;
    }
    
    // Estrai titolo se disponibile (sovrascrive solo se migliore)
    const titoloDaResult = estraiTitoloVotazione(votazioneResult);
    if (titoloDaResult && titoloDaResult.length > titolo.length && !titolo.startsWith('Votazione ')) {
      titolo = titoloDaResult;
      console.log(`✅ Titolo estratto da vote-results: ${titolo}`);
    }
    
    // Aggiorna data se disponibile nel voteResult
    if (votazioneResult.date && !dataSessione) {
      dataSessione = votazioneResult.date;
    }
  }
  
  // Se il titolo è ancora il default, prova a migliorarlo almeno rendendo l'ID più leggibile
  if (titolo.startsWith('Votazione ')) {
    // Prova a rendere l'ID più leggibile
    // Es: "MTG-PL-2014-01-16-VOT-ITM-345348-13" -> "Votazione del 16 gennaio 2014"
    const dateMatch = votazioneIdShort.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
      const meseNome = mesi[parseInt(month) - 1] || month;
      titolo = `Votazione del ${parseInt(day)} ${meseNome} ${year}`;
    }
  }
  
  return {
    uri: votazioneId,
    votazione_id: votazioneIdShort,
    titolo: titolo,
    descrizione: descrizione,
    data_votazione: dataSessione ? new Date(dataSessione).toISOString().split('T')[0] : null,
    esito: esito,
    sessione_id: sessione['activity_id'] || null,
    sessione_data: dataSessione ? new Date(dataSessione).toISOString().split('T')[0] : null,
    sessione_label: sessioneLabel,
    favorevoli: favorevoli,
    contrari: contrari,
    astenuti: astenuti,
    presenti: presenti,
    votanti: votanti,
    termine_parlamentare: termineParlamentare,
    metadati: {
      sessione_completa: sessione,
      documento_voti: documentoVoti // Link al documento con voti individuali
    }
  };
}

/**
 * Recupera e salva le ultime votazioni del PE
 * Usa direttamente /vote-results per ottenere le votazioni più recenti
 */
async function sincronizzaVotazioniPE(limitSessioni = 5) {
  try {
    await ensureTableExists();
    
    console.log(`🔄 Sincronizzazione votazioni Parlamento Europeo (ultime ${limitSessioni * 10} votazioni recenti)...`);
    
    // METODO PRINCIPALE: Usa /vote-results con filtri temporali espliciti per ottenere solo votazioni recenti
    const oggi = new Date();
    const dataMinima = new Date('2025-01-01'); // Forza solo votazioni dal 2025 in poi
    const dataMinimaStr = '2025-01-01';
    
    try {
      console.log(`📡 Tentativo sincronizzazione da /vote-results (metodo principale)...`);
      const limitVotazioni = limitSessioni * 10; // Recupera più votazioni per filtrare
      
      // Costruisci URL con filtri temporali espliciti
      const url = `${API_BASE}/vote-results`;
      const params = {
        'voted-date-min': dataMinimaStr, // Filtro temporale esplicito
        'sort': '-votedDate', // Prova prima con votedDate
        'limit': limitVotazioni * 2
      };
      
      // Log dell'URL completo per debugging
      const urlCompleto = `${url}?${new URLSearchParams(params).toString()}`;
      console.log(`🔗 URL completo chiamata API: ${urlCompleto}`);
      
      let response;
      try {
        response = await axios.get(url, {
          params: params,
          headers: {
            'Accept': 'application/ld+json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 30000
        });
      } catch (sortError) {
        // Se sort=-votedDate non funziona, prova con sort=-date
        console.log(`⚠️ Sort=-votedDate non accettato, provo con sort=-date`);
        params['sort'] = '-date';
        const urlCompleto2 = `${url}?${new URLSearchParams(params).toString()}`;
        console.log(`🔗 URL completo chiamata API (retry): ${urlCompleto2}`);
        response = await axios.get(url, {
          params: params,
          headers: {
            'Accept': 'application/ld+json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 30000
        });
      }
      
      // Estrai i dati dalla risposta JSON-LD
      let voteResults = [];
      if (Array.isArray(response.data)) {
        voteResults = response.data;
      } else if (response.data && response.data['@graph'] && Array.isArray(response.data['@graph'])) {
        voteResults = response.data['@graph'];
      } else if (response.data && response.data['hydra:member'] && Array.isArray(response.data['hydra:member'])) {
        voteResults = response.data['hydra:member'];
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        voteResults = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        console.log('⚠️ Formato risposta non riconosciuto, chiavi disponibili:', Object.keys(response.data));
        // Prova a cercare in altre strutture possibili
        const keys = Object.keys(response.data);
        for (const key of keys) {
          if (Array.isArray(response.data[key])) {
            voteResults = response.data[key];
            console.log(`✅ Dati trovati nella chiave: ${key}`);
            break;
          }
        }
      }
      
      console.log(`📊 Votazioni recuperate da /vote-results: ${voteResults.length}`);
      
      // Log delle prime 2 votazioni per debugging
      if (voteResults.length > 0) {
        console.log(`🔍 DEBUG - Prime 2 votazioni ricevute dall'API:`);
        for (let i = 0; i < Math.min(2, voteResults.length); i++) {
          const vote = voteResults[i];
          const voteDate = vote.date || vote['date'] || vote.votedDate || vote['votedDate'] || vote.activity_date || vote['activity_date'];
          const voteTitle = vote.label?.it || vote.label?.en || vote['rdfs:label']?.it || vote['rdfs:label']?.en || vote.title?.it || vote.title?.en || vote.id || vote['@id'] || 'N/A';
          console.log(`   ${i + 1}. Data: ${voteDate}, Titolo: ${typeof voteTitle === 'string' ? voteTitle.substring(0, 80) : JSON.stringify(voteTitle).substring(0, 80)}`);
        }
      }
      
      // Filtra per "Voto finale" e solo votazioni dal 2025 in poi
      const votazioniRecenti = voteResults.filter(vote => {
        // Estrai la data della votazione
        const voteDate = vote.date || vote['date'] || vote.votedDate || vote['votedDate'] || vote.activity_date || vote['activity_date'];
        let dataVotazione = null;
        
        if (voteDate) {
          dataVotazione = new Date(voteDate);
        } else {
          // Prova a estrarre dall'ID
          const voteId = vote.id || vote['@id'] || vote.activity_id || '';
          const match = voteId.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const [, year, month, day] = match;
            dataVotazione = new Date(year, month - 1, day);
          }
        }
        
        // Filtra solo votazioni dal 2025 in poi
        if (!dataVotazione || dataVotazione < dataMinima) {
          return false;
        }
        
        // Filtra per "Voto finale" o votazioni legislative
        const selectionMode = vote.selectionMode || vote['selectionMode'] || '';
        const activityType = vote.activity_type || vote['activity_type'] || vote.type || '';
        const label = vote.label?.it || vote.label?.en || vote['rdfs:label']?.it || vote['rdfs:label']?.en || vote.title?.it || vote.title?.en || '';
        const labelStr = typeof label === 'string' ? label.toLowerCase() : '';
        
        // Cerca indicatori di voto finale/legislativo
        const isFinalVote = 
          labelStr.includes('voto finale') ||
          labelStr.includes('final vote') ||
          labelStr.includes('text adopted') ||
          labelStr.includes('testo adottato') ||
          activityType.includes('LEGISLATIVE') ||
          activityType.includes('RESOLUTION') ||
          selectionMode === 'FINAL' ||
          selectionMode === 'FINAL_VOTE';
        
        // Se non è chiaramente un voto finale, includilo comunque se è recente (potrebbe essere comunque importante)
        // Ma priorità ai voti finali
        return isFinalVote || (!labelStr.includes('emendamento') && !labelStr.includes('amendment'));
      }).slice(0, limitVotazioni);
      
      console.log(`📊 Votazioni recenti (dal 2025, filtrate per voto finale): ${votazioniRecenti.length}`);
      
      if (votazioniRecenti.length === 0) {
        console.log(`⚠️ Nessuna votazione recente trovata da /vote-results. La sincronizzazione non ha recuperato dati validi.`);
        // NON fare fallback su dati vecchi - restituisci errore invece
        return { 
          salvate: 0, 
          errori: 0, 
          messaggio: 'Nessuna votazione recente trovata. Verificare i parametri API o la disponibilità dei dati.',
          metodo: 'vote-results',
          errore: 'Nessun dato recente disponibile'
        };
      }
      
      if (votazioniRecenti.length > 0) {
        let salvate = 0;
        let errori = 0;
        
        for (const voteResult of votazioniRecenti) {
          try {
            const voteId = voteResult.id || voteResult['@id'] || voteResult.activity_id;
            if (!voteId) {
              console.log(`⚠️ Votazione senza ID, salto`);
              continue;
            }
            
            // Estrai l'URI della votazione
            const uri = voteId.startsWith('http') ? voteId : `eli/dl/event/${voteId}`;
            
            // Recupera i dettagli completi della votazione
            const dettagli = await estraiDettagliVotazione(uri, voteResult);
            
            if (!dettagli || !dettagli.votazione_id) {
              console.log(`⚠️ Dettagli non disponibili per ${uri}, salto`);
              continue;
            }
            
            // Log della data estratta per debug (obbligatorio per verificare che siano del 2025)
            const dataVotazioneLog = dettagli.data_votazione || 'N/A';
            const titoloLog = dettagli.titolo?.substring(0, 80) || dettagli.votazione_id;
            console.log(`   📅 Votazione ${dettagli.votazione_id}: data_votazione=${dataVotazioneLog}, titolo="${titoloLog}"`);
            
            // Verifica che la data sia effettivamente dal 2025 in poi
            if (dettagli.data_votazione) {
              const dataVotazione = new Date(dettagli.data_votazione);
              if (dataVotazione < dataMinima) {
                console.log(`   ⚠️ ATTENZIONE: Votazione con data ${dataVotazioneLog} è precedente al 2025, salto`);
                continue;
              }
            }
            
            // Estrai i conteggi dei voti se disponibili
            const favorevoli = voteResult.votedFor?.length || voteResult['votedFor']?.length || null;
            const contrari = voteResult.votedAgainst?.length || voteResult['votedAgainst']?.length || null;
            const astenuti = voteResult.votedAbstained?.length || voteResult['votedAbstained']?.length || null;
            const votanti = (favorevoli || 0) + (contrari || 0) + (astenuti || 0);
            
            // Salva nel database (upsert)
            await pool.query(`
              INSERT INTO parlamento_europeo (
                uri, votazione_id, titolo, descrizione, data_votazione, esito,
                sessione_id, sessione_data, sessione_label, termine_parlamentare,
                favorevoli, contrari, astenuti, presenti, votanti, metadati,
                data_sincronizzazione
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
              ON CONFLICT (uri) DO UPDATE SET
                titolo = EXCLUDED.titolo,
                descrizione = EXCLUDED.descrizione,
                data_votazione = EXCLUDED.data_votazione,
                esito = EXCLUDED.esito,
                sessione_id = EXCLUDED.sessione_id,
                sessione_data = EXCLUDED.sessione_data,
                sessione_label = EXCLUDED.sessione_label,
                termine_parlamentare = EXCLUDED.termine_parlamentare,
                favorevoli = COALESCE(EXCLUDED.favorevoli, parlamento_europeo.favorevoli),
                contrari = COALESCE(EXCLUDED.contrari, parlamento_europeo.contrari),
                astenuti = COALESCE(EXCLUDED.astenuti, parlamento_europeo.astenuti),
                presenti = COALESCE(EXCLUDED.presenti, parlamento_europeo.presenti),
                votanti = COALESCE(EXCLUDED.votanti, parlamento_europeo.votanti),
                metadati = EXCLUDED.metadati,
                updated_at = CURRENT_TIMESTAMP,
                data_sincronizzazione = CURRENT_TIMESTAMP
            `, [
              dettagli.uri,
              dettagli.votazione_id,
              dettagli.titolo,
              dettagli.descrizione,
              dettagli.data_votazione,
              dettagli.esito,
              dettagli.sessione_id,
              dettagli.sessione_data,
              dettagli.sessione_label,
              dettagli.termine_parlamentare,
              favorevoli || dettagli.favorevoli,
              contrari || dettagli.contrari,
              astenuti || dettagli.astenuti,
              dettagli.presenti,
              votanti || dettagli.votanti,
              JSON.stringify({ ...dettagli.metadati, vote_result: voteResult })
            ]);
            
            salvate++;
          } catch (votError) {
            console.error(`❌ Errore nel salvare votazione:`, votError.message);
            errori++;
          }
        }
        
        console.log(`✅ Sincronizzazione da /vote-results completata: ${salvate} votazioni salvate, ${errori} errori`);
        return { salvate, errori, metodo: 'vote-results' };
      }
    } catch (voteResultsError) {
      console.log(`⚠️ Errore nel recupero da /vote-results: ${voteResultsError.message}`);
      console.log(`🔄 Fallback a metodo /meetings...`);
    }
    
    // FALLBACK: Usa il metodo originale con /meetings
    console.log(`📡 Sincronizzazione da /meetings (metodo fallback)...`);
    const sessioniDaRecuperare = limitSessioni * 10;
    const sessioni = await fetchUltimeSessioni(sessioniDaRecuperare);
    
    const dueAnniFa = new Date();
    dueAnniFa.setFullYear(oggi.getFullYear() - 2);
    
    const sessioniRecenti = sessioni.filter(sessione => {
      const dataSessione = sessione['activity_date'] || sessione['activity_start_date'] || sessione['start_date'] || sessione['date'];
      if (!dataSessione) {
        const sessioneId = sessione['id'] || sessione['activity_id'] || '';
        const match = sessioneId.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, year, month, day] = match;
          const data = new Date(year, month - 1, day);
          return data >= dueAnniFa;
        }
        return false;
      }
      const data = new Date(dataSessione);
      return data >= dueAnniFa;
    }).slice(0, limitSessioni);
    
    console.log(`📊 Sessioni recuperate: ${sessioni.length}, sessioni recenti (ultimi 2 anni): ${sessioniRecenti.length}`);
    
    if (sessioniRecenti.length === 0) {
      console.log(`⚠️ Nessuna sessione recente trovata. Le sessioni disponibili sono più vecchie di 2 anni.`);
      return { salvate: 0, errori: 0, messaggio: 'Nessuna sessione recente disponibile', metodo: 'meetings-fallback' };
    }
    
    let salvate = 0;
    let errori = 0;
    
    for (const sessione of sessioniRecenti) {
      try {
        const sessioneId = sessione['id'] || sessione['activity_id'] || 'N/A';
        const votazioniIds = estraiVotazioniDaSessione(sessione);
        
        console.log(`📋 Sessione ${sessioneId}: ${votazioniIds.length} votazioni trovate`);
        
        if (votazioniIds.length === 0) {
          console.log(`   ⚠️ Nessuna votazione VOT trovata in questa sessione`);
          continue;
        }
        
        for (const votazioneId of votazioniIds) {
          try {
            const dettagli = await estraiDettagliVotazione(votazioneId, sessione);
            
            console.log(`   📅 Votazione ${dettagli.votazione_id}: data_votazione=${dettagli.data_votazione}, sessione_data=${dettagli.sessione_data}`);
            
            await pool.query(`
              INSERT INTO parlamento_europeo (
                uri, votazione_id, titolo, descrizione, data_votazione, esito,
                sessione_id, sessione_data, sessione_label, termine_parlamentare,
                favorevoli, contrari, astenuti, presenti, votanti, metadati,
                data_sincronizzazione
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
              ON CONFLICT (uri) DO UPDATE SET
                titolo = EXCLUDED.titolo,
                descrizione = EXCLUDED.descrizione,
                data_votazione = EXCLUDED.data_votazione,
                esito = EXCLUDED.esito,
                sessione_id = EXCLUDED.sessione_id,
                sessione_data = EXCLUDED.sessione_data,
                sessione_label = EXCLUDED.sessione_label,
                termine_parlamentare = EXCLUDED.termine_parlamentare,
                favorevoli = EXCLUDED.favorevoli,
                contrari = EXCLUDED.contrari,
                astenuti = EXCLUDED.astenuti,
                presenti = EXCLUDED.presenti,
                votanti = EXCLUDED.votanti,
                metadati = EXCLUDED.metadati,
                updated_at = CURRENT_TIMESTAMP,
                data_sincronizzazione = CURRENT_TIMESTAMP
            `, [
              dettagli.uri,
              dettagli.votazione_id,
              dettagli.titolo,
              dettagli.descrizione,
              dettagli.data_votazione,
              dettagli.esito,
              dettagli.sessione_id,
              dettagli.sessione_data,
              dettagli.sessione_label,
              dettagli.termine_parlamentare,
              dettagli.favorevoli,
              dettagli.contrari,
              dettagli.astenuti,
              dettagli.presenti,
              dettagli.votanti,
              JSON.stringify(dettagli.metadati)
            ]);
            
            salvate++;
          } catch (votError) {
            console.error(`❌ Errore nel salvare votazione ${votazioneId}:`, votError.message);
            errori++;
          }
        }
      } catch (sessError) {
        console.error(`❌ Errore nell'elaborare sessione:`, sessError.message);
        errori++;
      }
    }
    
    console.log(`✅ Sincronizzazione completata: ${salvate} votazioni salvate, ${errori} errori`);
    return { salvate, errori, metodo: 'meetings-fallback' };
  } catch (error) {
    console.error('❌ Errore nella sincronizzazione:', error);
    throw error;
  }
}

/**
 * Recupera le ultime votazioni dal database
 * Ordina per data decrescente e filtra per escludere votazioni troppo vecchie
 * Se non ci sono votazioni recenti, restituisce comunque le più recenti disponibili
 */
async function getUltimeVotazioni(limit = 10) {
  try {
    await ensureTableExists();
    
    // Forza solo votazioni dal 2025 in poi (non dati vecchi)
    // Questo assicura che vengano mostrate solo votazioni recenti
    const dataMinima = new Date('2025-01-01');
    const dataMinimaStr = '2025-01-01';
    
    // Recupera solo votazioni dal 2025 in poi (non dati vecchi)
    let result = await pool.query(`
      SELECT 
        id, uri, votazione_id, titolo, descrizione, data_votazione,
        esito, sessione_id, sessione_data, sessione_label,
        favorevoli, contrari, astenuti, presenti, votanti,
        termine_parlamentare, metadati,
        created_at, updated_at, data_sincronizzazione
      FROM parlamento_europeo
      WHERE titolo IS NOT NULL 
        AND titolo != ''
        AND (
          (data_votazione IS NOT NULL AND data_votazione >= $2)
          OR (data_votazione IS NULL AND data_sincronizzazione >= $2)
        )
      ORDER BY 
        COALESCE(data_votazione, data_sincronizzazione) DESC NULLS LAST,
        data_sincronizzazione DESC NULLS LAST,
        id DESC
      LIMIT $1
    `, [limit, dataMinimaStr]);
    
    console.log(`📊 Recuperate ${result.rows.length} votazioni recenti (filtro data minima: ${dataMinimaStr})`);
    
    // NON fare fallback su dati vecchi - se non ci sono votazioni recenti, restituisci array vuoto
    // Questo forza l'utente a eseguire una sincronizzazione per ottenere dati aggiornati
    if (result.rows.length === 0) {
      console.log(`⚠️ Nessuna votazione recente trovata nel database.`);
      console.log(`   Il database contiene solo votazioni vecchie. Eseguire una sincronizzazione manuale.`);
      console.log(`   Usa: POST /api/voti-parlamento-europeo/sincronizza o GET /api/voti-parlamento-europeo/ultime?refresh=true`);
      // Restituisci array vuoto invece di dati obsoleti
      return [];
    }
    
    // Log delle date delle votazioni recuperate per debug
    if (result.rows.length > 0) {
      console.log(`📅 Date delle votazioni recuperate:`);
      result.rows.forEach((votazione, index) => {
        const dataVotazione = votazione.data_votazione || votazione.data_sincronizzazione || 'N/A';
        const isVecchia = votazione.data_votazione && new Date(votazione.data_votazione) < dataMinima;
        console.log(`   ${index + 1}. ${votazione.titolo?.substring(0, 50)}... - Data: ${dataVotazione} ${isVecchia ? '(vecchia)' : ''}`);
      });
    } else {
      console.log(`⚠️ Nessuna votazione trovata nel database`);
    }
    
    return result.rows;
  } catch (error) {
    console.error('❌ Errore nel recupero votazioni:', error);
    throw error;
  }
}

/**
 * Recupera i dettagli di una singola votazione
 */
async function getDettagliVotazione(uri) {
  try {
    await ensureTableExists();
    
    const result = await pool.query(`
      SELECT 
        id, uri, votazione_id, titolo, descrizione, data_votazione,
        esito, sessione_id, sessione_data, sessione_label,
        favorevoli, contrari, astenuti, presenti, votanti,
        termine_parlamentare, metadati,
        created_at, updated_at, data_sincronizzazione
      FROM parlamento_europeo
      WHERE uri = $1
      LIMIT 1
    `, [uri]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Errore nel recupero dettagli:', error);
    throw error;
  }
}

/**
 * Recupera i voti nominali dei MEP italiani per una votazione
 * Usa prima l'API ufficiale (/vote-results con votedFor/votedAgainst/votedAbstained)
 * Se non disponibile, usa il fallback con fonti esterne
 */
async function getVotiNominaliMEPItaliani(uriVotazione) {
  try {
    await ensureTableExists();
    
    // Recupera dalla cache se disponibile
    const result = await pool.query(`
      SELECT 
        mep_id,
        nome_completo,
        nome_mep,
        cognome_mep,
        gruppo_politico,
        voto
      FROM parlamento_europeo_voti_nominali
      WHERE uri_votazione = $1
        AND paese = 'IT'
      ORDER BY voto, nome_completo
    `, [uriVotazione]);
    
    if (result.rows.length > 0) {
      const voti = {
        favorevoli: [],
        contrari: [],
        astenuti: [],
        assenti: [],
        disponibili: true
      };
      
      result.rows.forEach(row => {
        const mepInfo = {
          id: row.mep_id,
          nome_completo: row.nome_completo,
          nome: row.nome_mep,
          cognome: row.cognome_mep,
          gruppo_politico: row.gruppo_politico
        };
        
        if (row.voto === 'Favorevole') {
          voti.favorevoli.push(mepInfo);
        } else if (row.voto === 'Contrario') {
          voti.contrari.push(mepInfo);
        } else if (row.voto === 'Astenuto') {
          voti.astenuti.push(mepInfo);
        } else if (row.voto === 'Assente') {
          voti.assenti.push(mepInfo);
        }
      });
      
      return voti;
    }
    
    // NUOVO APPROCCIO: Prova prima con l'API ufficiale usando /vote-results
    try {
      console.log('📡 Tentativo recupero voti da API ufficiale /vote-results...');
      
      // Recupera la lista dei MEP italiani (con cache)
      const mepMap = await fetchMEPItaliani();
      
      if (mepMap.size === 0) {
        console.log('⚠️ Nessun MEP italiano trovato, uso fallback');
        throw new Error('Nessun MEP italiano disponibile');
      }
      
      // Estrai l'ID della votazione dall'URI
      const votazioneId = uriVotazione.split('/').pop();
      
      // Prova a recuperare il risultato della votazione direttamente
      // L'endpoint potrebbe essere /vote-results/{id} o simile
      try {
        const voteResultResponse = await axios.get(`${API_BASE}/vote-results/${encodeURIComponent(votazioneId)}`, {
          headers: {
            'Accept': 'application/ld+json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 10000
        });
        
        const voteResult = Array.isArray(voteResultResponse.data) 
          ? voteResultResponse.data[0] 
          : voteResultResponse.data;
        
        if (voteResult) {
          const votiItaliani = await estraiVotiMEPItalianiDaVoteResult(voteResult, mepMap);
          
          if (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0) {
            console.log(`✅ Trovati ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti dall'API ufficiale`);
            
            // Salva nel database per la prossima volta
            await salvaVotiMEPItaliani(uriVotazione, votiItaliani);
            
            return {
              ...votiItaliani,
              disponibili: true
            };
          }
        }
      } catch (apiError) {
        // Se l'endpoint specifico non esiste, prova a cercare nella lista generale
        console.log(`⚠️ Endpoint specifico non disponibile, provo ricerca nella lista generale: ${apiError.message}`);
        
        // Cerca nella lista generale dei vote-results
        const allVoteResults = await fetchUltimeVotazioniDefinitive(50); // Recupera più risultati per trovare quello giusto
        const matchingVote = allVoteResults.find(vr => {
          const vrId = vr.id || vr['@id'] || vr.activity_id || '';
          return vrId === uriVotazione || vrId.includes(votazioneId) || votazioneId.includes(vrId.split('/').pop());
        });
        
        if (matchingVote) {
          const votiItaliani = await estraiVotiMEPItalianiDaVoteResult(matchingVote, mepMap);
          
          if (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0) {
            console.log(`✅ Trovati voti dalla lista generale: ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti`);
            
            // Salva nel database per la prossima volta
            await salvaVotiMEPItaliani(uriVotazione, votiItaliani);
            
            return {
              ...votiItaliani,
              disponibili: true
            };
          }
        }
      }
    } catch (officialApiError) {
      console.log(`⚠️ Approccio API ufficiale fallito, uso fallback: ${officialApiError.message}`);
      // Continua con il fallback esistente
    }
    
    // NUOVO APPROCCIO: Prova prima con l'API ufficiale usando /vote-results
    try {
      console.log('📡 Tentativo recupero voti da API ufficiale /vote-results...');
      
      // Recupera la lista dei MEP italiani (con cache)
      const mepMap = await fetchMEPItaliani();
      
      if (mepMap.size === 0) {
        console.log('⚠️ Nessun MEP italiano trovato, uso fallback');
        throw new Error('Nessun MEP italiano disponibile');
      }
      
      // Estrai l'ID della votazione dall'URI
      const votazioneId = uriVotazione.split('/').pop();
      
      // Prova a recuperare il risultato della votazione direttamente
      // L'endpoint potrebbe essere /vote-results/{id} o simile
      try {
        const voteResultResponse = await axios.get(`${API_BASE}/vote-results/${encodeURIComponent(votazioneId)}`, {
          headers: {
            'Accept': 'application/ld+json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 10000
        });
        
        const voteResult = Array.isArray(voteResultResponse.data) 
          ? voteResultResponse.data[0] 
          : voteResultResponse.data;
        
        if (voteResult) {
          const votiItaliani = await estraiVotiMEPItalianiDaVoteResult(voteResult, mepMap);
          
          if (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0) {
            console.log(`✅ Trovati ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti dall'API ufficiale`);
            
            // Salva nel database per la prossima volta
            await salvaVotiMEPItaliani(uriVotazione, votiItaliani);
            
            return {
              ...votiItaliani,
              disponibili: true
            };
          }
        }
      } catch (apiError) {
        // Se l'endpoint specifico non esiste, prova a cercare nella lista generale
        console.log(`⚠️ Endpoint specifico non disponibile, provo ricerca nella lista generale: ${apiError.message}`);
        
        // Cerca nella lista generale dei vote-results
        const allVoteResults = await fetchUltimeVotazioniDefinitive(50); // Recupera più risultati per trovare quello giusto
        const matchingVote = allVoteResults.find(vr => {
          const vrId = vr.id || vr['@id'] || vr.activity_id || '';
          return vrId === uriVotazione || vrId.includes(votazioneId) || votazioneId.includes(vrId.split('/').pop());
        });
        
        if (matchingVote) {
          const votiItaliani = await estraiVotiMEPItalianiDaVoteResult(matchingVote, mepMap);
          
          if (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0) {
            console.log(`✅ Trovati voti dalla lista generale: ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti`);
            
            // Salva nel database per la prossima volta
            await salvaVotiMEPItaliani(uriVotazione, votiItaliani);
            
            return {
              ...votiItaliani,
              disponibili: true
            };
          }
        }
      }
    } catch (officialApiError) {
      console.log(`⚠️ Approccio API ufficiale fallito, uso fallback: ${officialApiError.message}`);
      // Continua con il fallback esistente
    }
    
    // FALLBACK: Recupera informazioni sulla votazione per costruire il link al documento PDF
    const votazioneResult = await pool.query(`
      SELECT 
        votazione_id,
        metadati
      FROM parlamento_europeo
      WHERE uri = $1
      LIMIT 1
    `, [uriVotazione]);
    
    let linkDocumento = null;
    if (votazioneResult.rows.length > 0) {
      const metadati = votazioneResult.rows[0].metadati || {};
      const documentoVoti = metadati.documento_voti || null;
      
      // Usa il documento voti dai metadati se disponibile
      if (documentoVoti) {
        if (documentoVoti.startsWith('http://') || documentoVoti.startsWith('https://')) {
          linkDocumento = documentoVoti;
        } else if (documentoVoti.startsWith('/')) {
          linkDocumento = `https://www.europarl.europa.eu${documentoVoti}`;
        } else {
          linkDocumento = `https://www.europarl.europa.eu/doceo/document/${documentoVoti}`;
        }
      }
    }
    
    // Se non ci sono dati in cache, prova a recuperare da fonti esterne
    try {
      console.log('📡 Tentativo di recupero voti da fonti esterne (fallback)...');
      if (votazioneResult.rows.length > 0) {
        // Usa l'URI completo invece del solo votazione_id per una migliore corrispondenza
        const votazioneId = uriVotazione || votazioneResult.rows[0].votazione_id;
        const metadati = votazioneResult.rows[0].metadati || {};
        const documentoVoti = metadati.documento_voti || null;
        
        console.log(`   URI votazione: ${uriVotazione}`);
        console.log(`   Votazione ID: ${votazioneResult.rows[0].votazione_id}`);
        console.log(`   Documento voti: ${documentoVoti}`);
        
        const votiEsterni = await getVotiMEPItalianiDaParltrack(votazioneId, documentoVoti);
        
        if (votiEsterni && 
            (votiEsterni.favorevoli.length > 0 || 
             votiEsterni.contrari.length > 0 || 
             votiEsterni.astenuti.length > 0)) {
          // Salva i voti nel database per la prossima volta
          await salvaVotiMEPItaliani(uriVotazione, votiEsterni);
          
          return {
            ...votiEsterni,
            disponibili: true
          };
        }
      }
    } catch (esterniError) {
      console.error('⚠️ Errore nel recupero da fonti esterne:', esterniError.message);
      // Continua e restituisci messaggio informativo
    }
    
    // Se non ci sono dati da nessuna fonte, restituisci vuoto con info
    return {
      favorevoli: [],
      contrari: [],
      astenuti: [],
      assenti: [],
      disponibili: false,
      linkDocumento: linkDocumento,
      messaggio: 'I voti individuali dei MEP non sono disponibili tramite l\'API ufficiale del Parlamento Europeo. Per consultare i voti nominali, visita il sito ufficiale del PE o utilizza fonti alternative come MEPvote.eu o Parltrack.'
    };
  } catch (error) {
    console.error('❌ Errore nel recupero voti nominali MEP italiani:', error);
    return {
      favorevoli: [],
      contrari: [],
      astenuti: [],
      assenti: [],
      disponibili: false,
      messaggio: 'Errore nel recupero dei voti individuali.'
    };
  }
}

/**
 * Recupera la lista dei MEP italiani dall'API del PE
 * Salva in cache per evitare chiamate ripetute
 */
async function fetchMEPItaliani() {
  try {
    console.log(`📡 Recupero MEP italiani da ${API_BASE}/meps`);
    
    const response = await axios.get(`${API_BASE}/meps`, {
      params: {
        limit: 1000, // Dovrebbero essere circa 76 MEP italiani
        offset: 0
      },
      headers: {
        'Accept': 'application/ld+json',
        'User-Agent': 'DemosApp-1.0.0'
      }
    });
    
    // Estrai i dati dalla risposta
    let meps = [];
    if (Array.isArray(response.data)) {
      meps = response.data;
    } else if (response.data && Array.isArray(response.data)) {
      meps = response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      meps = response.data.data;
    } else if (response.data && response.data['@graph'] && Array.isArray(response.data['@graph'])) {
      meps = response.data['@graph'];
    }
    
    // Filtra solo i MEP italiani
    const mepItaliani = meps.filter(mep => {
      const citizenship = mep.citizenship || mep.country || mep.nationality || mep['citizenship'] || mep['country'];
      const countryCode = mep.country_code || mep['country_code'];
      
      // Verifica se è italiano
      if (typeof citizenship === 'string') {
        return citizenship.toLowerCase().includes('italy') || 
               citizenship.toLowerCase().includes('italia') ||
               citizenship === 'IT' || citizenship === 'ITA';
      }
      if (typeof citizenship === 'object' && citizenship !== null) {
        const citValue = citizenship['@value'] || citizenship.value || citizenship.id;
        if (citValue) {
          return citValue.toLowerCase().includes('italy') || 
                 citValue.toLowerCase().includes('italia') ||
                 citValue === 'IT' || citValue === 'ITA';
        }
      }
      if (countryCode) {
        return countryCode === 'IT' || countryCode === 'ITA';
      }
      
      return false;
    });
    
    // Crea una mappa ID -> nome per facilitare la ricerca
    const mepMap = new Map();
    mepItaliani.forEach(mep => {
      const mepId = mep.id || mep['@id'] || mep.person_id;
      const label = mep.label || mep['rdfs:label'] || mep.name || mep.full_name;
      
      if (mepId && label) {
        // Estrai nome e cognome se possibile
        const labelStr = typeof label === 'string' ? label : (label.it || label.en || label.fr || '');
        const parts = labelStr.split(' ');
        const nome = parts[0] || '';
        const cognome = parts.slice(1).join(' ') || '';
        
        mepMap.set(mepId, {
          id: mepId,
          nome_completo: labelStr,
          nome: nome,
          cognome: cognome,
          gruppo_politico: mep.political_group || mep.group || null
        });
      }
    });
    
    console.log(`✅ Trovati ${mepItaliani.length} MEP italiani`);
    return mepMap;
  } catch (error) {
    console.error('❌ Errore nel recupero MEP italiani:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    // Restituisci mappa vuota invece di fallire
    return new Map();
  }
}

/**
 * Recupera le ultime votazioni definitive usando /vote-results
 * Approccio diretto e più affidabile rispetto a /meetings
 */
async function fetchUltimeVotazioniDefinitive(limit = 3) {
  try {
    console.log(`📡 Recupero ultime ${limit} votazioni definitive da ${API_BASE}/vote-results`);
    
    const response = await axios.get(`${API_BASE}/vote-results`, {
      params: {
        limit: limit * 3, // Recupera più risultati per filtrare meglio
        offset: 0,
        sort: '-date' // Ordinamento decrescente per data
      },
      headers: {
        'Accept': 'application/ld+json',
        'User-Agent': 'DemosApp-1.0.0'
      }
    });
    
    // Estrai i dati dalla risposta
    let voteResults = [];
    if (Array.isArray(response.data)) {
      voteResults = response.data;
    } else if (response.data && Array.isArray(response.data)) {
      voteResults = response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      voteResults = response.data.data;
    } else if (response.data && response.data['@graph'] && Array.isArray(response.data['@graph'])) {
      voteResults = response.data['@graph'];
    }
    
    // Filtra per votazioni definitive
    // Le votazioni definitive sono solitamente associate a "Text Adopted" o hanno metadati specifici
    const votazioniDefinitive = voteResults.filter(vote => {
      // Cerca indicatori di votazione definitiva
      const activityType = vote.activity_type || vote['activity_type'] || vote.type;
      const label = vote.label || vote['rdfs:label'] || vote.title;
      const labelStr = typeof label === 'string' ? label : (label?.it || label?.en || '');
      
      // Verifica se è una votazione definitiva
      // Le votazioni definitive spesso hanno "Final" o "Text Adopted" nel label
      const isFinal = labelStr && (
        labelStr.toLowerCase().includes('final') ||
        labelStr.toLowerCase().includes('text adopted') ||
        labelStr.toLowerCase().includes('adopted')
      );
      
      // Oppure verifica il tipo di attività
      const isVoteType = activityType && (
        activityType.includes('VOT') ||
        activityType.includes('vote') ||
        activityType.includes('Vote')
      );
      
      return isVoteType && (isFinal || !labelStr); // Se non ha label, assumiamo sia una votazione normale
    });
    
    // Prendi solo le prime 'limit' votazioni uniche (per ID)
    const uniqueVotes = new Map();
    for (const vote of votazioniDefinitive) {
      const voteId = vote.id || vote['@id'] || vote.activity_id;
      if (voteId && !uniqueVotes.has(voteId)) {
        uniqueVotes.set(voteId, vote);
        if (uniqueVotes.size >= limit) break;
      }
    }
    
    const result = Array.from(uniqueVotes.values());
    console.log(`✅ Trovate ${result.length} votazioni definitive`);
    
    return result;
  } catch (error) {
    console.error('❌ Errore nel recupero votazioni definitive:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    return [];
  }
}

/**
 * Estrae i voti dei MEP italiani da una votazione usando l'API ufficiale
 * Usa votedFor, votedAgainst, votedAbstained
 */
async function estraiVotiMEPItalianiDaVoteResult(voteResult, mepMap) {
  const voti = {
    favorevoli: [],
    contrari: [],
    astenuti: [],
    assenti: []
  };
  
  if (!voteResult || !mepMap || mepMap.size === 0) {
    return voti;
  }
  
  // Estrai le liste di votanti
  const votedFor = voteResult.votedFor || voteResult['votedFor'] || voteResult['eli-dl:votedFor'] || [];
  const votedAgainst = voteResult.votedAgainst || voteResult['votedAgainst'] || voteResult['eli-dl:votedAgainst'] || [];
  const votedAbstained = voteResult.votedAbstained || voteResult['votedAbstained'] || voteResult['eli-dl:votedAbstained'] || [];
  
  // Normalizza gli array (potrebbero essere array di ID o array di oggetti)
  const normalizeIds = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.id || item['@id'] || item.person_id || item.mep_id;
      }
      return null;
    }).filter(Boolean);
  };
  
  const forIds = normalizeIds(votedFor);
  const againstIds = normalizeIds(votedAgainst);
  const abstainedIds = normalizeIds(votedAbstained);
  
  // Confronta con la mappa dei MEP italiani
  for (const [mepId, mepInfo] of mepMap.entries()) {
    // Normalizza l'ID per il confronto (potrebbero avere formati diversi)
    const mepIdNormalized = mepId.split('/').pop(); // Prendi solo l'ultima parte
    
    if (forIds.some(id => {
      const idNormalized = typeof id === 'string' ? id.split('/').pop() : String(id);
      return idNormalized === mepIdNormalized || id === mepId || id.includes(mepIdNormalized);
    })) {
      voti.favorevoli.push(mepInfo);
    } else if (againstIds.some(id => {
      const idNormalized = typeof id === 'string' ? id.split('/').pop() : String(id);
      return idNormalized === mepIdNormalized || id === mepId || id.includes(mepIdNormalized);
    })) {
      voti.contrari.push(mepInfo);
    } else if (abstainedIds.some(id => {
      const idNormalized = typeof id === 'string' ? id.split('/').pop() : String(id);
      return idNormalized === mepIdNormalized || id === mepId || id.includes(mepIdNormalized);
    })) {
      voti.astenuti.push(mepInfo);
    } else {
      // Se non è in nessuna lista, è assente
      voti.assenti.push(mepInfo);
    }
  }
  
  return voti;
}

module.exports = {
  ensureTableExists,
  fetchUltimeSessioni,
  estraiVotazioniDaSessione,
  estraiDettagliVotazione,
  sincronizzaVotazioniPE,
  getUltimeVotazioni,
  getDettagliVotazione,
  getVotiNominaliMEPItaliani,
  fetchDettagliVotazioneDiretta,
  estraiTitoloVotazione,
  fetchMEPItaliani,
  fetchUltimeVotazioniDefinitive,
  estraiVotiMEPItalianiDaVoteResult
};
