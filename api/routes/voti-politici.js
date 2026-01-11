const express = require('express');
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Funzione per assicurarsi che la tabella esista
async function ensureTableExists() {
  try {
    // Crea la tabella
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voti_politici (
        id SERIAL PRIMARY KEY,
        uri TEXT NOT NULL UNIQUE,
        votazione_id TEXT NOT NULL,
        legislatura INTEGER,
        data_votazione DATE,
        descrizione TEXT,
        esito TEXT,
        sigla_atto TEXT,
        numero_atto TEXT,
        tipo_atto TEXT,
        camera VARCHAR(50) CHECK (camera IN ('Camera', 'Senato')),
        metadati JSONB DEFAULT '{}'::jsonb,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Aggiungi colonna camera se non esiste (per migrazione)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'voti_politici' AND column_name = 'camera'
        ) THEN
          ALTER TABLE voti_politici ADD COLUMN camera VARCHAR(50);
          ALTER TABLE voti_politici ADD CONSTRAINT voti_politici_camera_check 
            CHECK (camera IN ('Camera', 'Senato'));
          UPDATE voti_politici SET camera = 'Camera' WHERE camera IS NULL;
          ALTER TABLE voti_politici ALTER COLUMN camera SET NOT NULL;
        END IF;
      END $$;
    `);
    
    // Crea indici
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_votazione_id ON voti_politici(votazione_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_legislatura ON voti_politici(legislatura)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_data_votazione ON voti_politici(data_votazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_esito ON voti_politici(esito)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_sigla_atto ON voti_politici(sigla_atto)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_camera ON voti_politici(camera)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_data_sincronizzazione ON voti_politici(data_sincronizzazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_metadati_gin ON voti_politici USING GIN (metadati)`);
    
    // Crea funzione per trigger
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_voti_politici_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.data_aggiornamento = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // Crea trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_voti_politici_updated_at ON voti_politici;
      CREATE TRIGGER trigger_update_voti_politici_updated_at
        BEFORE UPDATE ON voti_politici
        FOR EACH ROW
        EXECUTE FUNCTION update_voti_politici_updated_at()
    `);
    
    console.log('✅ Tabella voti_politici verificata/creata con supporto Camera e Senato');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella voti_politici:', error);
    // Non bloccare se c'è un errore
  }
}

// Inizializza la tabella all'avvio
ensureTableExists();

// Funzione helper per recuperare dati da SPARQL (Camera o Senato)
async function fetchFromSparql(camera = 'Camera', limit = 100) {
  let sparqlQuery;
  let sparqlEndpoint;
  
  if (camera === 'Senato') {
    // Query SPARQL per il Senato
    // Il Senato usa namespace diverso: http://dati.senato.it/osr/
    // Tipo: http://dati.senato.it/osr/Votazione
    // Predicati: favorevoli, contrari, favorevole (voti individuali), seduta, label
    sparqlQuery = `
      PREFIX osr: <http://dati.senato.it/osr/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?seduta ?tipoVotazione ?presenti ?votanti
      WHERE {
        ?votazione a osr:Votazione .
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione osr:seduta ?seduta . }
        OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
        OPTIONAL { ?votazione osr:contrari ?contrari . }
        OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
        OPTIONAL { ?votazione osr:presenti ?presenti . }
        OPTIONAL { ?votazione osr:votanti ?votanti . }
      }
      ORDER BY DESC(?votazione)
      LIMIT ${limit}
    `;
    sparqlEndpoint = 'https://dati.senato.it/sparql';
  } else {
    // Query SPARQL per la Camera (default)
    sparqlQuery = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT DISTINCT ?votazione ?label ?approvato ?seduta
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        FILTER(CONTAINS(STR(?votazione), "vs19"))
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione ocd:approvato ?approvato . }
        OPTIONAL { ?votazione ocd:rif_seduta ?seduta . }
      }
      ORDER BY DESC(?votazione)
      LIMIT ${limit}
    `;
    sparqlEndpoint = 'http://dati.camera.it/sparql';
  }
  
  console.log(`🔍 SPARQL Query per ${camera}:`, sparqlQuery);
  console.log(`🔍 SPARQL Endpoint:`, sparqlEndpoint);
  
  try {
    // Prova prima con GET (metodo standard per SPARQL)
    const params = new URLSearchParams();
    params.append('query', sparqlQuery);
    params.append('format', 'json');
    
    const response = await axios.get(`${sparqlEndpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    console.log(`✅ SPARQL Response status (${camera}):`, response.status);
    console.log(`✅ SPARQL Response data keys:`, Object.keys(response.data || {}));
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`📊 SPARQL Results (${camera}): ${bindings.length} bindings trovati`);
    
    if (bindings.length === 0 && response.data?.results) {
      console.log(`⚠️ Nessun binding trovato per ${camera}, ma response.data.results esiste`);
      console.log('📋 Response data completo:', JSON.stringify(response.data, null, 2).substring(0, 500));
    }
    
    return bindings;
  } catch (error) {
    console.error(`❌ Errore nella chiamata SPARQL (${camera}):`, error.message);
    if (error.response) {
      console.error(`❌ SPARQL Response status:`, error.response.status);
      console.error(`❌ SPARQL Response data:`, error.response.data);
    }
    throw error;
  }
}

// Funzione helper per processare e salvare i dati
async function processAndSaveVotazioni(sparqlResults, camera = 'Camera') {
  if (sparqlResults.length === 0) return [];

  // I risultati ora hanno struttura diretta: votazione, label, approvato, seduta
  const votazioni = {};
  
  for (const result of sparqlResults) {
    const votazioneUri = result.votazione?.value;
    if (!votazioneUri) continue;

    if (!votazioni[votazioneUri]) {
      // Estrai legislatura da URI (vs19 per Camera, potrebbe essere diverso per Senato)
      let legislatura = null;
      if (votazioneUri.includes('vs19') || votazioneUri.includes('19')) {
        legislatura = 19;
      }
      
      // Determina esito in base alla camera
      let esito = null;
      if (camera === 'Camera') {
        // Camera usa approvato (1 o 0)
        esito = result.approvato?.value === '1' || result.approvato?.value === 1 ? 'Approvato' : 
                result.approvato?.value === '0' || result.approvato?.value === 0 ? 'Non Approvato' : null;
      } else if (camera === 'Senato') {
        // Senato usa favorevoli e contrari
        const favorevoli = parseInt(result.favorevoli?.value || 0);
        const contrari = parseInt(result.contrari?.value || 0);
        const maggioranza = parseInt(result.maggioranza?.value || 0);
        if (favorevoli > contrari) {
          esito = 'Approvato';
        } else if (contrari > favorevoli) {
          esito = 'Non Approvato';
        }
        // Se pari, potrebbe essere necessario controllare altri fattori
      }
      
      votazioni[votazioneUri] = {
        uri: votazioneUri,
        votazione_id: votazioneUri.split('/').pop() || votazioneUri,
        legislatura: legislatura,
        data_votazione: null,
        descrizione: result.label?.value || null,
        esito: esito,
        sigla_atto: null,
        numero_atto: null,
        tipo_atto: result.tipoVotazione?.value || null, // Senato ha tipoVotazione
        camera: camera,
        seduta: result.seduta?.value || null,
        metadati: {
          label: result.label?.value || null,
          approvato: result.approvato?.value || null,
          favorevoli: result.favorevoli?.value || null,
          contrari: result.contrari?.value || null,
          presenti: result.presenti?.value || null,
          votanti: result.votanti?.value || null,
          tipoVotazione: result.tipoVotazione?.value || null,
          seduta: result.seduta?.value || null,
          camera: camera
        }
      };
    }
  }

  // Salva nel database
  const savedCount = await saveVotazioniToDatabase(Object.values(votazioni));
  console.log(`✅ Salvate ${savedCount} votazioni nel database per ${camera}`);

  return Object.values(votazioni);
}

// Funzione helper per salvare le votazioni nel database
async function saveVotazioniToDatabase(votazioni) {
  let savedCount = 0;
  let errorCount = 0;
  
  console.log(`💾 Tentativo di salvare ${votazioni.length} votazioni nel database...`);
  
  for (const votazione of votazioni) {
    try {
      // Salva seduta nei metadati se non c'è una colonna dedicata
      const metadatiCompleti = {
        ...votazione.metadati,
        seduta: votazione.seduta || null
      };
      
      const result = await pool.query(
        `INSERT INTO voti_politici (
          uri, votazione_id, legislatura, data_votazione, descrizione,
          esito, sigla_atto, numero_atto, tipo_atto, camera, metadati
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        ON CONFLICT (uri) 
        DO UPDATE SET
          data_votazione = EXCLUDED.data_votazione,
          descrizione = EXCLUDED.descrizione,
          esito = EXCLUDED.esito,
          sigla_atto = EXCLUDED.sigla_atto,
          numero_atto = EXCLUDED.numero_atto,
          tipo_atto = EXCLUDED.tipo_atto,
          camera = EXCLUDED.camera,
          metadati = EXCLUDED.metadati,
          data_aggiornamento = CURRENT_TIMESTAMP`,
        [
            votazione.uri,
            votazione.votazione_id,
            votazione.legislatura,
            votazione.data_votazione,
            votazione.descrizione,
            votazione.esito,
            votazione.sigla_atto,
            votazione.numero_atto,
            votazione.tipo_atto,
            votazione.camera || 'Camera', // Default a Camera se non specificato
            JSON.stringify(metadatiCompleti)
          ]
      );
      savedCount++;
      if (savedCount % 10 === 0) {
        console.log(`  💾 Salvate ${savedCount}/${votazioni.length} votazioni...`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Errore nel salvare votazione ${votazione.uri}:`, error.message);
      console.error(`❌ Dettagli errore:`, error);
    }
  }
  
  console.log(`✅ Salvataggio completato: ${savedCount} salvate, ${errorCount} errori`);
  return savedCount;
}

// GET /api/voti-politici - Ottieni votazioni dalla tabella (o da SPARQL se vuota)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-politici - Richiesta votazioni Camera');
    
    await ensureTableExists();
    
    // Prova prima a recuperare dal database
    const { camera: filterCamera } = req.query; // Filtro opzionale per camera
    
    let query = `
      SELECT 
        id, uri, votazione_id, legislatura, data_votazione, descrizione,
        esito, sigla_atto, numero_atto, tipo_atto, camera, metadati,
        data_sincronizzazione, data_aggiornamento
      FROM voti_politici
    `;
    
    const queryParams = [];
    if (filterCamera && (filterCamera === 'Camera' || filterCamera === 'Senato')) {
      query += ` WHERE camera = $1`;
      queryParams.push(filterCamera);
    }
    
    query += ` ORDER BY data_votazione DESC NULLS LAST, data_sincronizzazione DESC LIMIT 100`;
    
    const dbResult = await pool.query(query, queryParams);

    if (dbResult.rows.length > 0) {
      // Restituisci i dati dal database
      const votazioni = dbResult.rows.map(row => ({
        id: row.id,
        uri: row.uri,
        votazione_id: row.votazione_id,
        legislatura: row.legislatura,
        data_creazione: row.data_votazione,
        descrizione: row.descrizione,
        esito: row.esito,
        sigla_atto: row.sigla_atto,
        numero_atto: row.numero_atto,
        tipo_atto: row.tipo_atto,
        camera: row.camera || 'Camera',
        data: row.metadati || {},
        seduta: row.metadati?.seduta || null,
        data_sincronizzazione: row.data_sincronizzazione,
        data_aggiornamento: row.data_aggiornamento
      }));

      return res.json({
        success: true,
        data: votazioni,
        count: votazioni.length,
        source: 'database'
      });
    }

    // Se il database è vuoto, recupera da SPARQL e salva
    const cameraToFetch = filterCamera || 'Camera'; // Default Camera se non specificato
    console.log(`📥 Database vuoto, recupero dati da SPARQL per ${cameraToFetch}...`);
    let sparqlResults;
    try {
      sparqlResults = await fetchFromSparql(cameraToFetch, 100);
      console.log(`📊 SPARQL ha restituito ${sparqlResults.length} risultati per ${cameraToFetch}`);
    } catch (sparqlError) {
      console.error(`❌ Errore nel recupero da SPARQL (${cameraToFetch}):`, sparqlError);
      return res.status(503).json({
        success: false,
        data: [],
        error: 'Errore nel recupero dati da SPARQL',
        message: sparqlError.message || `Impossibile connettersi all'endpoint SPARQL del ${cameraToFetch}`,
        source: 'sparql'
      });
    }
    
    if (sparqlResults.length === 0) {
      console.log(`⚠️ Nessun risultato da SPARQL per ${cameraToFetch}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna votazione trovata nell'endpoint SPARQL del ${cameraToFetch}. La query potrebbe non restituire risultati per la XIX legislatura.`,
        source: 'sparql'
      });
    }

    const votazioni = await processAndSaveVotazioni(sparqlResults, cameraToFetch);
    
    // Converti per il formato di risposta
    const formattedVotazioni = votazioni.map(v => ({
      uri: v.uri,
      id: v.votazione_id,
      votazione_id: v.votazione_id,
      legislatura: v.legislatura,
      data_creazione: v.data_votazione,
      descrizione: v.descrizione,
      esito: v.esito,
      sigla_atto: v.sigla_atto,
      numero_atto: v.numero_atto,
      tipo_atto: v.tipo_atto,
      camera: v.camera || cameraToFetch,
      data: v.metadati,
      seduta: v.seduta || null
    }));

    res.json({
      success: true,
      data: formattedVotazioni,
      count: formattedVotazioni.length,
      source: 'sparql'
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare votazioni:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        error: 'Servizio SPARQL non disponibile',
        message: 'Impossibile connettersi all\'endpoint SPARQL della Camera dei Deputati'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message || 'Impossibile recuperare le votazioni'
    });
  }
});

// POST /api/voti-politici/sync - Sincronizza manualmente i dati da SPARQL
router.post('/sync', verifyToken, async (req, res) => {
  try {
    console.log('🔄 POST /api/voti-politici/sync - Sincronizzazione manuale');
    
    await ensureTableExists();
    
    const { limit = 100, camera = 'both' } = req.body; // 'Camera', 'Senato', o 'both'
    
    // Verifica conteggio attuale
    const countBefore = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
    const countBeforeValue = parseInt(countBefore.rows[0].count);
    console.log(`📊 Record prima della sincronizzazione: ${countBeforeValue}`);
    
    let totalResults = 0;
    let totalSaved = 0;
    const results = {};
    
    // Sincronizza Camera
    if (camera === 'Camera' || camera === 'both') {
      console.log(`🔍 Recupero dati da SPARQL Camera con limit=${limit}...`);
      try {
        const sparqlResults = await fetchFromSparql('Camera', limit);
        console.log(`📊 SPARQL Camera ha restituito ${sparqlResults.length} bindings`);
        
        if (sparqlResults.length > 0) {
          console.log('🔄 Processo e salvo i dati Camera...');
          const votazioni = await processAndSaveVotazioni(sparqlResults, 'Camera');
          results.camera = {
            sparqlResults: sparqlResults.length,
            votazioniProcessate: votazioni.length
          };
          totalResults += sparqlResults.length;
        } else {
          results.camera = { sparqlResults: 0, votazioniProcessate: 0 };
        }
      } catch (error) {
        console.error('❌ Errore sincronizzazione Camera:', error.message);
        results.camera = { error: error.message };
      }
    }
    
    // Sincronizza Senato
    if (camera === 'Senato' || camera === 'both') {
      console.log(`🔍 Recupero dati da SPARQL Senato con limit=${limit}...`);
      try {
        const sparqlResults = await fetchFromSparql('Senato', limit);
        console.log(`📊 SPARQL Senato ha restituito ${sparqlResults.length} bindings`);
        
        if (sparqlResults.length > 0) {
          console.log('🔄 Processo e salvo i dati Senato...');
          const votazioni = await processAndSaveVotazioni(sparqlResults, 'Senato');
          results.senato = {
            sparqlResults: sparqlResults.length,
            votazioniProcessate: votazioni.length
          };
          totalResults += sparqlResults.length;
        } else {
          results.senato = { sparqlResults: 0, votazioniProcessate: 0 };
        }
      } catch (error) {
        console.error('❌ Errore sincronizzazione Senato:', error.message);
        results.senato = { error: error.message };
      }
    }
    
    // Verifica conteggio dopo
    const countAfter = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
    const countAfterValue = parseInt(countAfter.rows[0].count);
    const newRecords = countAfterValue - countBeforeValue;
    
    console.log(`📊 Record dopo la sincronizzazione: ${countAfterValue}`);
    console.log(`✅ Nuovi record aggiunti: ${newRecords}`);
    
    res.json({
      success: true,
      message: `Sincronizzazione completata`,
      saved: newRecords,
      total: totalResults,
      results: results,
      countBefore: countBeforeValue,
      countAfter: countAfterValue
    });

  } catch (error) {
    console.error('❌ Errore nella sincronizzazione:', error);
    console.error('❌ Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione',
      message: error.message,
      details: error.stack
    });
  }
});

// GET /api/voti-politici/ultime - Ottieni le ultime N votazioni (default: 3)
router.get('/ultime', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 3, 100); // Default 3, max 100
    console.log(`🔍 GET /api/voti-politici/ultime - Richiesta ultime ${limit} votazioni`);
    
    await ensureTableExists();
    
    // Cerca le ultime votazioni da voti_politici (SPARQL)
    // Combina con votazioni_parlamento se disponibile
    // Priorità: data_votazione > data_sincronizzazione > data_aggiornamento
    const query = `
      SELECT 
        vp.id as id,
        vp.uri,
        vp.votazione_id,
        vp.legislatura,
        vp.data_votazione,
        vp.descrizione,
        vp.esito,
        vp.sigla_atto,
        vp.numero_atto,
        vp.tipo_atto,
        vp.camera,
        vp.metadati,
        vp.data_sincronizzazione,
        vp.data_aggiornamento,
        vparl.titolo_votazione,
        vparl.descrizione_votazione as descrizione_completa,
        vparl.spiegazione,
        vparl.url_votazione,
        vparl.numero_seduta
      FROM voti_politici vp
      LEFT JOIN votazioni_parlamento vparl ON vp.votazione_id = vparl.id::text
      WHERE vp.descrizione IS NOT NULL 
        AND vp.descrizione != ''
        AND vp.descrizione != 'N/A'
      ORDER BY 
        COALESCE(vp.data_votazione, vparl.data_votazione) DESC NULLS LAST,
        vp.data_sincronizzazione DESC NULLS LAST,
        vp.data_aggiornamento DESC NULLS LAST
      LIMIT $1
    `;
    
    const dbResult = await pool.query(query, [limit]);
    
    if (dbResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessuna votazione trovata nel database. Esegui la sincronizzazione da SPARQL.'
      });
    }
    
    // Formatta tutte le votazioni
    const votazioni = dbResult.rows.map(votazione => ({
      id: votazione.id,
      uri: votazione.uri,
      votazione_id: votazione.votazione_id,
      legislatura: votazione.legislatura,
      data_votazione: votazione.data_votazione || votazione.data_sincronizzazione?.split('T')[0] || null,
      descrizione: votazione.descrizione || votazione.titolo_votazione || 'Votazione parlamentare',
      descrizione_completa: votazione.descrizione_completa || votazione.descrizione,
      esito: votazione.esito,
      sigla_atto: votazione.sigla_atto,
      numero_atto: votazione.numero_atto,
      tipo_atto: votazione.tipo_atto,
      camera: votazione.camera || 'Camera',
      spiegazione: votazione.spiegazione,
      url_votazione: votazione.url_votazione,
      numero_seduta: votazione.numero_seduta,
      metadati: votazione.metadati || {},
      seduta: votazione.metadati?.seduta || null,
      data_sincronizzazione: votazione.data_sincronizzazione,
      data_aggiornamento: votazione.data_aggiornamento
    }));
    
    console.log(`✅ Restituite ${votazioni.length} votazioni`);
    
    return res.json({
      success: true,
      data: votazioni,
      count: votazioni.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero ultime votazioni:', error);
    console.error('❌ Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dati',
      message: error.message || 'Errore interno del server'
    });
  }
});

// GET /api/voti-politici/ultima - Alias per compatibilità (restituisce solo la prima)
router.get('/ultima', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-politici/ultima - Richiesta ultima votazione (alias)');
    
    await ensureTableExists();
    
    const query = `
      SELECT 
        vp.id as id,
        vp.uri,
        vp.votazione_id,
        vp.legislatura,
        vp.data_votazione,
        vp.descrizione,
        vp.esito,
        vp.sigla_atto,
        vp.numero_atto,
        vp.tipo_atto,
        vp.camera,
        vp.metadati,
        vp.data_sincronizzazione,
        vp.data_aggiornamento,
        vparl.titolo_votazione,
        vparl.descrizione_votazione as descrizione_completa,
        vparl.spiegazione
      FROM voti_politici vp
      LEFT JOIN votazioni_parlamento vparl ON vp.votazione_id = vparl.id::text
      WHERE vp.descrizione IS NOT NULL 
        AND vp.descrizione != ''
      ORDER BY 
        COALESCE(vp.data_votazione, vp.data_sincronizzazione) DESC NULLS LAST,
        vp.data_sincronizzazione DESC
      LIMIT 1
    `;
    
    const dbResult = await pool.query(query);
    
    if (dbResult.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'Nessuna votazione trovata nel database'
      });
    }
    
    const votazione = dbResult.rows[0];
    
    const response = {
      id: votazione.id,
      uri: votazione.uri,
      votazione_id: votazione.votazione_id,
      legislatura: votazione.legislatura,
      data_votazione: votazione.data_votazione,
      descrizione: votazione.descrizione || votazione.titolo_votazione,
      descrizione_completa: votazione.descrizione_completa,
      esito: votazione.esito,
      sigla_atto: votazione.sigla_atto,
      numero_atto: votazione.numero_atto,
      tipo_atto: votazione.tipo_atto,
      camera: votazione.camera || 'Camera',
      spiegazione: votazione.spiegazione,
      metadati: votazione.metadati || {},
      seduta: votazione.metadati?.seduta || null,
      data_sincronizzazione: votazione.data_sincronizzazione,
      data_aggiornamento: votazione.data_aggiornamento
    };
    
    return res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero ultima votazione:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dati',
      message: error.message || 'Errore interno del server'
    });
  }
});

// GET /api/voti-politici/debug - Endpoint di debug per verificare lo stato
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-politici/debug - Debug info');
    
    // Verifica esistenza tabella
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voti_politici'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    let count = 0;
    let sampleData = [];
    
    if (tableExists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
      count = parseInt(countResult.rows[0].count);
      
      if (count > 0) {
        const sampleResult = await pool.query(`
          SELECT uri, votazione_id, camera, data_votazione, descrizione, esito, data_sincronizzazione
          FROM voti_politici
          ORDER BY data_sincronizzazione DESC
          LIMIT 5
        `);
        sampleData = sampleResult.rows;
        
        // Aggiungi statistiche per camera
        const statsResult = await pool.query(`
          SELECT camera, COUNT(*) as count
          FROM voti_politici
          GROUP BY camera
        `);
        sampleData.stats = statsResult.rows;
      }
    }
    
    res.json({
      success: true,
      tableExists,
      recordCount: count,
      sampleData,
      message: tableExists 
        ? (count > 0 ? `Tabella esiste con ${count} record` : 'Tabella esiste ma è vuota')
        : 'Tabella non esiste'
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

