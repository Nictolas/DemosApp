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
    const response = await axios.get(`${API_BASE}/meetings`, {
      params: {
        'page[size]': limit
      },
      headers: {
        'Accept': 'application/ld+json'
      }
    });
    
    return response.data || [];
  } catch (error) {
    console.error('❌ Errore nel recupero sessioni:', error.message);
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
 * Recupera i dettagli di una votazione
 * Nota: L'API del PE non ha un endpoint diretto per i dettagli delle votazioni,
 * quindi dobbiamo estrarre le informazioni dalla sessione
 */
function estraiDettagliVotazione(votazioneId, sessione) {
  // Estrai l'ID della votazione (ultima parte dopo l'ultimo slash)
  const parts = votazioneId.split('/');
  const votazioneIdShort = parts[parts.length - 1];
  
  // Estrai informazioni dalla sessione
  const dataSessione = sessione['activity_date'] || sessione['activity_start_date'];
  const sessioneLabel = sessione['activity_label']?.['it'] || sessione['activity_label']?.['en'] || '';
  const termineParlamentare = sessione['parliamentary_term'] || null;
  
  return {
    uri: votazioneId,
    votazione_id: votazioneIdShort,
    titolo: `Votazione ${votazioneIdShort}`, // Titolo generico, da migliorare con dati reali
    descrizione: null,
    data_votazione: dataSessione ? new Date(dataSessione).toISOString().split('T')[0] : null,
    sessione_id: sessione['activity_id'] || null,
    sessione_data: dataSessione ? new Date(dataSessione).toISOString().split('T')[0] : null,
    sessione_label: sessioneLabel,
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
        const votazioniIds = estraiVotazioniDaSessione(sessione);
        
        console.log(`📋 Sessione ${sessione['activity_id']}: ${votazioniIds.length} votazioni trovate`);
        
        for (const votazioneId of votazioniIds) {
          try {
            const dettagli = estraiDettagliVotazione(votazioneId, sessione);
            
            // Salva nel database (upsert)
            await pool.query(`
              INSERT INTO parlamento_europeo (
                uri, votazione_id, titolo, descrizione, data_votazione,
                sessione_id, sessione_data, sessione_label, termine_parlamentare, metadati,
                data_sincronizzazione
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
              ON CONFLICT (uri) DO UPDATE SET
                titolo = EXCLUDED.titolo,
                descrizione = EXCLUDED.descrizione,
                data_votazione = EXCLUDED.data_votazione,
                sessione_id = EXCLUDED.sessione_id,
                sessione_data = EXCLUDED.sessione_data,
                sessione_label = EXCLUDED.sessione_label,
                termine_parlamentare = EXCLUDED.termine_parlamentare,
                metadati = EXCLUDED.metadati,
                updated_at = CURRENT_TIMESTAMP,
                data_sincronizzazione = CURRENT_TIMESTAMP
            `, [
              dettagli.uri,
              dettagli.votazione_id,
              dettagli.titolo,
              dettagli.descrizione,
              dettagli.data_votazione,
              dettagli.sessione_id,
              dettagli.sessione_data,
              dettagli.sessione_label,
              dettagli.termine_parlamentare,
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
