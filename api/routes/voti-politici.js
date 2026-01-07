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
  const sparqlQuery = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    
    SELECT DISTINCT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a ocd:Votazione .
      ?votazione ?predicato ?oggetto .
      
      # Filtra per la XIX legislatura (2022-2027)
      ?votazione ocd:rif_legislatura ?legislatura .
      ?legislatura ocd:numero 19 .
    }
    LIMIT ${limit}
  `;

  const sparqlEndpoint = 'http://dati.camera.it/sparql';
  const params = new URLSearchParams();
  params.append('query', sparqlQuery);
  params.append('format', 'json');
  
  const response = await axios.post(sparqlEndpoint, params.toString(), {
    headers: {
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 30000
  });

  return response.data.results?.bindings || [];
}

// Funzione helper per processare e salvare i dati
async function processAndSaveVotazioni(sparqlResults) {
  if (sparqlResults.length === 0) return [];

  // Raggruppa i risultati per votazione
  const votazioni = {};
  for (const result of sparqlResults) {
    const votazioneUri = result.votazione?.value;
    const predicato = result.predicato?.value;
    const oggetto = result.oggetto?.value;

    if (!votazioneUri) continue;

    if (!votazioni[votazioneUri]) {
      votazioni[votazioneUri] = {
        uri: votazioneUri,
        votazione_id: votazioneUri.split('/').pop() || votazioneUri,
        legislatura: 19,
        data_votazione: null,
        descrizione: null,
        esito: null,
        sigla_atto: null,
        numero_atto: null,
        tipo_atto: null,
        metadati: {}
      };
    }

    // Estrai il nome del predicato
    const nomePredicato = predicato.split('/').pop().split('#').pop();
    
    // Mappa i predicati comuni
    if (nomePredicato === 'date' || nomePredicato === 'data') {
      votazioni[votazioneUri].data_votazione = oggetto;
    } else if (nomePredicato === 'description' || nomePredicato === 'descrizione') {
      votazioni[votazioneUri].descrizione = oggetto;
    } else if (nomePredicato === 'esitoVotazione' || nomePredicato === 'esito') {
      votazioni[votazioneUri].esito = oggetto;
    } else if (nomePredicato === 'siglaAtto' || nomePredicato === 'sigla_atto') {
      votazioni[votazioneUri].sigla_atto = oggetto;
    } else if (nomePredicato === 'numeroAtto' || nomePredicato === 'numero_atto') {
      votazioni[votazioneUri].numero_atto = oggetto;
    } else if (nomePredicato === 'tipoAtto' || nomePredicato === 'tipo_atto') {
      votazioni[votazioneUri].tipo_atto = oggetto;
    }

    // Salva tutti i predicati nei metadati
    votazioni[votazioneUri].metadati[nomePredicato] = oggetto;
  }

  // Salva nel database
  const savedCount = await saveVotazioniToDatabase(Object.values(votazioni));
  console.log(`✅ Salvate ${savedCount} votazioni nel database`);

  return Object.values(votazioni);
}

// Funzione helper per salvare le votazioni nel database
async function saveVotazioniToDatabase(votazioni) {
  let savedCount = 0;
  
  for (const votazione of votazioni) {
    try {
      await pool.query(
        `INSERT INTO voti_politici (
          uri, votazione_id, legislatura, data_votazione, descrizione,
          esito, sigla_atto, numero_atto, tipo_atto, metadati
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          JSON.stringify(votazione.metadati)
        ]
      );
      savedCount++;
    } catch (error) {
      console.error(`❌ Errore nel salvare votazione ${votazione.uri}:`, error.message);
    }
  }
  
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
    const sparqlResults = await fetchFromSparql(100);
    
    if (sparqlResults.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Nessuna votazione trovata',
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
      data: v.metadati
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
    
    const { limit = 100 } = req.body;
    
    const sparqlResults = await fetchFromSparql(limit);
    
    if (sparqlResults.length === 0) {
      return res.json({
        success: true,
        message: 'Nessuna votazione trovata da SPARQL',
        saved: 0
      });
    }

    const savedCount = await processAndSaveVotazioni(sparqlResults);
    
    res.json({
      success: true,
      message: `Sincronizzazione completata`,
      saved: savedCount,
      total: sparqlResults.length
    });

  } catch (error) {
    console.error('❌ Errore nella sincronizzazione:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione',
      message: error.message
    });
  }
});

module.exports = router;

