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
        metadati JSONB DEFAULT '{}'::jsonb,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crea indici
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_votazione_id ON voti_politici(votazione_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_legislatura ON voti_politici(legislatura)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_data_votazione ON voti_politici(data_votazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_esito ON voti_politici(esito)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voti_politici_sigla_atto ON voti_politici(sigla_atto)`);
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
    
    console.log('✅ Tabella voti_politici verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella voti_politici:', error);
    // Non bloccare se c'è un errore
  }
}

// Inizializza la tabella all'avvio
ensureTableExists();

// Funzione helper per recuperare dati da SPARQL
async function fetchFromSparql(limit = 100) {
  // Query SPARQL per ottenere votazioni della XIX legislatura
  // Filtra per votazioni con "vs19" nel nome (XIX legislatura)
  // I dati disponibili sono limitati: label, approvato, rif_seduta
  // NOTA: I voti dei singoli politici NON sono disponibili tramite SPARQL
  let sparqlQuery = `
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

  const sparqlEndpoint = 'http://dati.camera.it/sparql';
  
  console.log('🔍 SPARQL Query:', sparqlQuery);
  console.log('🔍 SPARQL Endpoint:', sparqlEndpoint);
  
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

    console.log('✅ SPARQL Response status:', response.status);
    console.log('✅ SPARQL Response data keys:', Object.keys(response.data || {}));
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`📊 SPARQL Results: ${bindings.length} bindings trovati`);
    
    if (bindings.length === 0 && response.data?.results) {
      console.log('⚠️ Nessun binding trovato, ma response.data.results esiste');
      console.log('📋 Response data completo:', JSON.stringify(response.data, null, 2).substring(0, 500));
    }
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore nella chiamata SPARQL:', error.message);
    if (error.response) {
      console.error('❌ SPARQL Response status:', error.response.status);
      console.error('❌ SPARQL Response data:', error.response.data);
    }
    throw error;
  }
}

// Funzione helper per processare e salvare i dati
async function processAndSaveVotazioni(sparqlResults) {
  if (sparqlResults.length === 0) return [];

  // I risultati ora hanno struttura diretta: votazione, label, approvato, seduta
  const votazioni = {};
  
  for (const result of sparqlResults) {
    const votazioneUri = result.votazione?.value;
    if (!votazioneUri) continue;

    if (!votazioni[votazioneUri]) {
      votazioni[votazioneUri] = {
        uri: votazioneUri,
        votazione_id: votazioneUri.split('/').pop() || votazioneUri,
        legislatura: votazioneUri.includes('vs19') ? 19 : null, // Estrai da vs19 nel nome
        data_votazione: null,
        descrizione: result.label?.value || null,
        esito: result.approvato?.value === '1' || result.approvato?.value === 1 ? 'Approvato' : 
               result.approvato?.value === '0' || result.approvato?.value === 0 ? 'Non Approvato' : null,
        sigla_atto: null,
        numero_atto: null,
        tipo_atto: null,
        seduta: result.seduta?.value || null,
        metadati: {
          label: result.label?.value || null,
          approvato: result.approvato?.value || null,
          seduta: result.seduta?.value || null
        }
      };
    }
  }

  // Salva nel database
  const savedCount = await saveVotazioniToDatabase(Object.values(votazioni));
  console.log(`✅ Salvate ${savedCount} votazioni nel database`);

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
          esito, sigla_atto, numero_atto, tipo_atto, metadati
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (uri) 
        DO UPDATE SET
          data_votazione = EXCLUDED.data_votazione,
          descrizione = EXCLUDED.descrizione,
          esito = EXCLUDED.esito,
          sigla_atto = EXCLUDED.sigla_atto,
          numero_atto = EXCLUDED.numero_atto,
          tipo_atto = EXCLUDED.tipo_atto,
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
    const dbResult = await pool.query(
      `SELECT 
        id, uri, votazione_id, legislatura, data_votazione, descrizione,
        esito, sigla_atto, numero_atto, tipo_atto, metadati,
        data_sincronizzazione, data_aggiornamento
      FROM voti_politici
      ORDER BY data_votazione DESC NULLS LAST, data_sincronizzazione DESC
      LIMIT 100`
    );

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
    console.log('📥 Database vuoto, recupero dati da SPARQL...');
    let sparqlResults;
    try {
      sparqlResults = await fetchFromSparql(100);
      console.log(`📊 SPARQL ha restituito ${sparqlResults.length} risultati`);
    } catch (sparqlError) {
      console.error('❌ Errore nel recupero da SPARQL:', sparqlError);
      return res.status(503).json({
        success: false,
        data: [],
        error: 'Errore nel recupero dati da SPARQL',
        message: sparqlError.message || 'Impossibile connettersi all\'endpoint SPARQL',
        source: 'sparql'
      });
    }
    
    if (sparqlResults.length === 0) {
      console.log('⚠️ Nessun risultato da SPARQL');
      return res.json({
        success: true,
        data: [],
        message: 'Nessuna votazione trovata nell\'endpoint SPARQL. La query potrebbe non restituire risultati per la XIX legislatura.',
        source: 'sparql'
      });
    }

    const votazioni = await processAndSaveVotazioni(sparqlResults);
    
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
    
    // Verifica conteggio attuale
    const countBefore = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
    const countBeforeValue = parseInt(countBefore.rows[0].count);
    console.log(`📊 Record prima della sincronizzazione: ${countBeforeValue}`);
    
    const { limit = 100 } = req.body;
    
    console.log(`🔍 Recupero dati da SPARQL con limit=${limit}...`);
    const sparqlResults = await fetchFromSparql(limit);
    
    console.log(`📊 SPARQL ha restituito ${sparqlResults.length} bindings`);
    
    if (sparqlResults.length === 0) {
      console.log('⚠️ Nessun risultato da SPARQL');
      return res.json({
        success: true,
        message: 'Nessuna votazione trovata da SPARQL. L\'endpoint potrebbe non restituire dati o la query potrebbe non essere corretta.',
        saved: 0,
        sparqlResults: 0
      });
    }

    console.log('🔄 Processo e salvo i dati...');
    const votazioni = await processAndSaveVotazioni(sparqlResults);
    
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
      total: sparqlResults.length,
      votazioniProcessate: votazioni.length,
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
          SELECT uri, votazione_id, data_votazione, descrizione, esito, data_sincronizzazione
          FROM voti_politici
          ORDER BY data_sincronizzazione DESC
          LIMIT 5
        `);
        sampleData = sampleResult.rows;
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

