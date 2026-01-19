const axios = require('axios');
const { Pool } = require('pg');

const API_BASE = 'https://data.europarl.europa.eu/api/v2';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
    
    console.log('✅ Tabella parlamento_europeo verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella parlamento_europeo:', error);
    throw error;
  }
}

/**
 * Recupera le ultime sessioni plenarie dal PE
 */
async function fetchUltimeSessioni(limit = 10) {
  try {
    console.log(`📡 Chiamata API PE: ${API_BASE}/meetings con limit=${limit}`);
    const response = await axios.get(`${API_BASE}/meetings`, {
      params: {
        limit: limit,
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
    
    console.log(`📊 Sessioni estratte: ${sessioni.length}`);
    return sessioni;
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
 * Recupera i dettagli di una votazione
 * Prova a recuperare i risultati dei voti dall'endpoint vote-results
 */
async function estraiDettagliVotazione(votazioneId, sessione) {
  // Estrai l'ID della votazione (ultima parte dopo l'ultimo slash)
  const parts = votazioneId.split('/');
  const votazioneIdShort = parts[parts.length - 1];
  
  // Estrai informazioni dalla sessione
  const dataSessione = sessione['activity_date'] || sessione['activity_start_date'];
  const sessioneLabel = sessione['activity_label']?.['it'] || sessione['activity_label']?.['en'] || '';
  const termineParlamentare = sessione['parliamentary_term'] || null;
  const sessioneId = sessione['id'] || sessione['activity_id'];
  
  // Prova a recuperare i risultati dei voti
  let favorevoli = null;
  let contrari = null;
  let astenuti = null;
  let presenti = null;
  let votanti = null;
  let esito = null;
  let titolo = `Votazione ${votazioneIdShort}`;
  
  if (sessioneId) {
    try {
      const voteResults = await fetchVoteResults(sessioneId);
      
      // Cerca la votazione specifica nei risultati
      const votazioneResult = voteResults.find(vr => 
        vr.id === votazioneId || 
        (vr.id && vr.id.includes(votazioneIdShort)) ||
        (vr['@id'] && vr['@id'] === votazioneId)
      );
      
      if (votazioneResult) {
        // Estrai statistiche dalla votazione
        if (votazioneResult['eli-dl:vote_result_for'] || votazioneResult['vote_result_for']) {
          const voteData = votazioneResult['eli-dl:vote_result_for'] || votazioneResult['vote_result_for'];
          favorevoli = voteData['eli-dl:vote_result_in_favour'] || voteData['vote_result_in_favour'] || null;
          contrari = voteData['eli-dl:vote_result_against'] || voteData['vote_result_against'] || null;
          astenuti = voteData['eli-dl:vote_result_abstention'] || voteData['vote_result_abstention'] || null;
        }
        
        // Estrai titolo se disponibile
        if (votazioneResult['rdfs:label'] || votazioneResult['label']) {
          const label = votazioneResult['rdfs:label'] || votazioneResult['label'];
          if (typeof label === 'string') {
            titolo = label;
          } else if (label && label['it']) {
            titolo = label['it'];
          } else if (label && label['en']) {
            titolo = label['en'];
          }
        }
        
        // Determina esito
        if (favorevoli !== null && contrari !== null) {
          esito = favorevoli > contrari ? 'Approvato' : 'Non Approvato';
        }
      }
    } catch (error) {
      console.error(`⚠️ Errore nel recupero dettagli votazione ${votazioneId}:`, error.message);
    }
  }
  
  return {
    uri: votazioneId,
    votazione_id: votazioneIdShort,
    titolo: titolo,
    descrizione: null,
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
      sessione_completa: sessione
    }
  };
}

/**
 * Recupera e salva le ultime votazioni del PE
 */
async function sincronizzaVotazioniPE(limitSessioni = 5) {
  try {
    await ensureTableExists();
    
    console.log(`🔄 Sincronizzazione votazioni Parlamento Europeo (ultime ${limitSessioni} sessioni)...`);
    
    // Recupera le ultime sessioni
    const sessioni = await fetchUltimeSessioni(limitSessioni);
    
    if (!Array.isArray(sessioni)) {
      console.log('⚠️ Nessuna sessione trovata');
      return { salvate: 0, errori: 0 };
    }
    
    let salvate = 0;
    let errori = 0;
    
    // Per ogni sessione, estrai le votazioni
    for (const sessione of sessioni) {
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
    return { salvate, errori };
  } catch (error) {
    console.error('❌ Errore nella sincronizzazione:', error);
    throw error;
  }
}

/**
 * Recupera le ultime votazioni dal database
 */
async function getUltimeVotazioni(limit = 10) {
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
      WHERE titolo IS NOT NULL 
        AND titolo != ''
      ORDER BY 
        COALESCE(data_votazione, data_sincronizzazione) DESC NULLS LAST,
        data_sincronizzazione DESC NULLS LAST
      LIMIT $1
    `, [limit]);
    
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

module.exports = {
  ensureTableExists,
  fetchUltimeSessioni,
  estraiVotazioniDaSessione,
  estraiDettagliVotazione,
  sincronizzaVotazioniPE,
  getUltimeVotazioni,
  getDettagliVotazione
};
