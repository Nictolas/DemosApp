const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { generaAnalisiLegge, recuperaAnalisiDaCache } = require('../services/leggeAnalysisService');
const { getPool } = require('../config/database');
const { loadFromDb: loadOpenpolisUltimiDdl, fetchUltimiDdlApprovati, saveToDb: saveOpenpolisDdlToDb } = require('../services/openpolisCosaSuccedeService');
const { loadFromDb: loadOpenpolisVotazioniFinali, fetchVotazioniFinaliDecisive, saveToDb: saveOpenpolisVotazioniFinaliToDb } = require('../services/openpolisVotazioniFinaliService');
const axios = require('axios');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Funzione per assicurarsi che la tabella "parlamento" esista
async function ensureParlamentoTableExists() {
  try {
    // Crea la tabella parlamento con tutte le colonne necessarie
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parlamento (
        id SERIAL PRIMARY KEY,
        uri TEXT NOT NULL UNIQUE,
        votazione_id TEXT,
        camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
        titolo TEXT NOT NULL,
        descrizione TEXT,
        data_votazione DATE,
        esito VARCHAR(50),
        uri_seduta TEXT,
        numero_seduta TEXT,
        titolo_seduta TEXT,
        legislatura INTEGER,
        favorevoli INTEGER,
        contrari INTEGER,
        presenti INTEGER,
        votanti INTEGER,
        maggioranza INTEGER,
        tipo_votazione TEXT,
        approvato INTEGER,
        metadati JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crea indici
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_uri ON parlamento(uri)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_camera ON parlamento(camera)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_data_votazione ON parlamento(data_votazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_esito ON parlamento(esito)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_legislatura ON parlamento(legislatura)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_numero_seduta ON parlamento(numero_seduta)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_data_sincronizzazione ON parlamento(data_sincronizzazione DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_metadati_gin ON parlamento USING GIN (metadati)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parlamento_camera_data ON parlamento(camera, data_votazione DESC NULLS LAST)`);
    
    // Crea trigger per updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_parlamento_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_parlamento_updated_at ON parlamento;
      CREATE TRIGGER trigger_update_parlamento_updated_at
        BEFORE UPDATE ON parlamento
        FOR EACH ROW
        EXECUTE FUNCTION update_parlamento_updated_at()
    `);
    
    console.log('✅ Tabella parlamento verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella parlamento:', error);
  }
}

// Funzione per assicurarsi che la tabella esista (legacy - mantiene compatibilità)
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

// Inizializza le tabelle all'avvio
ensureTableExists(); // Tabella legacy voti_politici
ensureParlamentoTableExists(); // Nuova tabella parlamento

// Funzione helper per recuperare dati da SPARQL (Camera o Senato)
async function fetchFromSparql(camera = 'Camera', limit = 100) {
  let sparqlQuery;
  let sparqlEndpoint;
  
  if (camera === 'Senato') {
    // Query SPARQL per il Senato - Recupera TUTTI i dati disponibili incluso dalla seduta
    sparqlQuery = `
      PREFIX osr: <http://dati.senato.it/osr/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                      ?tipoVotazione ?astenuti ?numeroLegale ?presidente ?esito ?seduta 
                      ?sedutaData ?sedutaNumero ?sedutaLegislatura ?sedutaTipo
      WHERE {
        ?votazione a osr:Votazione .
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
        OPTIONAL { ?votazione osr:contrari ?contrari . }
        OPTIONAL { ?votazione osr:presenti ?presenti . }
        OPTIONAL { ?votazione osr:votanti ?votanti . }
        OPTIONAL { ?votazione osr:maggioranza ?maggioranza . }
        OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
        OPTIONAL { ?votazione osr:astenuti ?astenuti . }
        OPTIONAL { ?votazione osr:numeroLegale ?numeroLegale . }
        OPTIONAL { ?votazione osr:presidente ?presidente . }
        OPTIONAL { ?votazione osr:esito ?esito . }
        OPTIONAL { 
          ?votazione osr:seduta ?seduta .
          OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
          OPTIONAL { ?seduta osr:numeroSeduta ?sedutaNumero . }
          OPTIONAL { ?seduta osr:legislatura ?sedutaLegislatura . }
          OPTIONAL { ?seduta osr:tipoSeduta ?sedutaTipo . }
        }
      }
      ORDER BY DESC(?sedutaData) DESC(?votazione)
      LIMIT ${limit}
    `;
    sparqlEndpoint = 'https://dati.senato.it/sparql';
  } else {
    // Query SPARQL per la Camera - Recupera TUTTI i dati disponibili incluso dalla seduta
    sparqlQuery = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT DISTINCT ?votazione ?label ?approvato ?seduta ?sedutaData ?sedutaNumero ?sedutaTitle ?sedutaLegislatura
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        FILTER(CONTAINS(STR(?votazione), "vs19"))
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione ocd:approvato ?approvato . }
        OPTIONAL { 
          ?votazione ocd:rif_seduta ?seduta .
          OPTIONAL { ?seduta ocd:data ?sedutaData . }
          OPTIONAL { ?seduta ocd:identifier ?sedutaNumero . }
          OPTIONAL { ?seduta ocd:title ?sedutaTitle . }
          OPTIONAL { 
            ?seduta ocd:rif_leg ?legislatura .
            OPTIONAL { ?legislatura ocd:numero ?sedutaLegislatura . }
          }
        }
      }
      ORDER BY DESC(?sedutaData) DESC(?votazione)
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

// Funzione helper per processare e salvare i dati nella tabella "parlamento"
async function processAndSaveVotazioni(sparqlResults, camera = 'Camera') {
  if (sparqlResults.length === 0) return [];

  const votazioni = {};
  
  for (const result of sparqlResults) {
    const votazioneUri = result.votazione?.value;
    if (!votazioneUri) continue;

    if (!votazioni[votazioneUri]) {
      // Estrai legislatura dalla seduta o da URI
      let legislatura = null;
      if (camera === 'Senato' && result.sedutaLegislatura?.value) {
        legislatura = parseInt(result.sedutaLegislatura.value);
      } else if (camera === 'Camera' && result.sedutaLegislatura?.value) {
        legislatura = parseInt(result.sedutaLegislatura.value);
      } else if (votazioneUri.includes('vs19') || votazioneUri.includes('19')) {
        legislatura = 19;
      }
      
      // Determina esito in base alla camera
      let esito = null;
      let approvato = null;
      if (camera === 'Camera') {
        // Camera usa approvato (1 o 0)
        approvato = result.approvato?.value === '1' || result.approvato?.value === 1 ? 1 : 
                   result.approvato?.value === '0' || result.approvato?.value === 0 ? 0 : null;
        esito = approvato === 1 ? 'Approvato' : approvato === 0 ? 'Non Approvato' : null;
      } else if (camera === 'Senato') {
        // Senato usa favorevoli e contrari
        const favorevoli = parseInt(result.favorevoli?.value || 0);
        const contrari = parseInt(result.contrari?.value || 0);
        if (favorevoli > contrari) {
          esito = 'Approvato';
        } else if (contrari > favorevoli) {
          esito = 'Non Approvato';
        }
      }
      
      // Estrai data dalla seduta
      let dataVotazione = null;
      if (camera === 'Camera' && result.sedutaData?.value) {
        // Camera: formato YYYYMMDD (es. 20230607)
        const dateStr = result.sedutaData.value;
        if (dateStr.match(/^\d{8}$/)) {
          // Formato YYYYMMDD
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          dataVotazione = `${year}-${month}-${day}`;
        }
      } else if (camera === 'Senato' && result.sedutaData?.value) {
        // Senato: formato YYYY-MM-DD
        const dateStr = result.sedutaData.value;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          dataVotazione = dateStr.split('T')[0];
        }
      }
      
      // Estrai numero seduta
      const numeroSeduta = result.sedutaNumero?.value || null;
      
      // Estrai titolo seduta (solo Camera)
      const titoloSeduta = result.sedutaTitle?.value || null;
      
      votazioni[votazioneUri] = {
        uri: votazioneUri,
        votazione_id: votazioneUri.split('/').pop() || votazioneUri,
        camera: camera,
        titolo: result.label?.value || 'Votazione parlamentare',
        descrizione: result.label?.value || null,
        data_votazione: dataVotazione,
        esito: esito,
        uri_seduta: result.seduta?.value || null,
        numero_seduta: numeroSeduta,
        titolo_seduta: titoloSeduta,
        legislatura: legislatura,
        // Dati specifici Senato
        favorevoli: camera === 'Senato' ? parseInt(result.favorevoli?.value || 0) : null,
        contrari: camera === 'Senato' ? parseInt(result.contrari?.value || 0) : null,
        presenti: camera === 'Senato' ? parseInt(result.presenti?.value || 0) : null,
        votanti: camera === 'Senato' ? parseInt(result.votanti?.value || 0) : null,
        maggioranza: camera === 'Senato' ? parseInt(result.maggioranza?.value || 0) : null,
        tipo_votazione: camera === 'Senato' ? result.tipoVotazione?.value || null : null,
        // Dati aggiuntivi Senato
        astenuti: camera === 'Senato' ? parseInt(result.astenuti?.value || 0) : null,
        numero_legale: camera === 'Senato' ? parseInt(result.numeroLegale?.value || 0) : null,
        presidente: camera === 'Senato' ? result.presidente?.value || null : null,
        // Dati specifici Camera
        approvato: camera === 'Camera' ? approvato : null,
        // Metadati aggiuntivi (include tutto per riferimento futuro)
        metadati: {
          label: result.label?.value || null,
          approvato: result.approvato?.value || null,
          favorevoli: result.favorevoli?.value || null,
          contrari: result.contrari?.value || null,
          presenti: result.presenti?.value || null,
          votanti: result.votanti?.value || null,
          astenuti: result.astenuti?.value || null,
          numeroLegale: result.numeroLegale?.value || null,
          presidente: result.presidente?.value || null,
          esito: result.esito?.value || null,
          tipoVotazione: result.tipoVotazione?.value || null,
          seduta: result.seduta?.value || null,
          sedutaData: result.sedutaData?.value || null,
          sedutaNumero: result.sedutaNumero?.value || null,
          sedutaTitle: result.sedutaTitle?.value || null,
          sedutaLegislatura: result.sedutaLegislatura?.value || null,
          sedutaTipo: result.sedutaTipo?.value || null,
          camera: camera,
          // Nota: Gli endpoint SPARQL forniscono solo dati tecnici sulle votazioni.
          // Per il contesto legislativo completo (nome legge, numero, descrizione dettagliata)
          // servirebbe integrazione con altre fonti (Openpolis, portali ufficiali, ecc.)
          nota_limiti: 'Dati tecnici da SPARQL. Contesto legislativo richiede altre fonti.'
        }
      };
    }
  }

  // Salva nella tabella "parlamento"
  const savedCount = await saveVotazioniToParlamento(Object.values(votazioni));
  console.log(`✅ Salvate ${savedCount} votazioni nella tabella parlamento per ${camera}`);

  return Object.values(votazioni);
}

// Funzione helper per salvare le votazioni nella tabella "parlamento"
// Funzione per salvare i voti nominali nella tabella cache
/**
 * Crea notifiche per gli utenti che hanno scelto questo senatore
 */
async function creaNotificheParlamentoDaVotiNominali(nomePolitico, camera, titoloVotazione, voto, dataVotazione) {
  try {
    if (!nomePolitico || !titoloVotazione || !voto) {
      return; // Non creare notifiche se non ci sono dati
    }
    
    // Crea hash univoco per evitare duplicati
    const crypto = require('crypto');
    const hashInput = `${nomePolitico}-${titoloVotazione}`.toLowerCase().trim();
    const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');
    
    // Verifica se la notifica esiste già
    const existingNotifica = await pool.query(
      'SELECT id FROM notifiche_voti_parlamento WHERE votazione_hash = $1',
      [votazioneHash]
    );
    
    if (existingNotifica.rows.length > 0) {
      return; // Notifica già esistente
    }
    
    // Trova il politico nella tabella users per ottenere il suo ID
    // Prova prima con nome completo, poi con nome + cognome
    let politicoResult = await pool.query(
      `SELECT id FROM users 
       WHERE CONCAT(nome, ' ', cognome) = $1 
         AND ruolo = 'P' 
         AND grado_elezione = $2`,
      [nomePolitico, camera === 'Senato' ? 'S' : 'C']
    );
    
    // Se non trovato, prova a dividere nome e cognome
    if (politicoResult.rows.length === 0) {
      const partiNome = nomePolitico.trim().split(' ');
      if (partiNome.length >= 2) {
        const nome = partiNome[0];
        const cognome = partiNome.slice(1).join(' ');
        politicoResult = await pool.query(
          `SELECT id FROM users 
           WHERE nome = $1 AND cognome = $2 
             AND ruolo = 'P' 
             AND grado_elezione = $3`,
          [nome, cognome, camera === 'Senato' ? 'S' : 'C']
        );
      }
    }
    
    if (politicoResult.rows.length === 0) {
      console.log(`[!] Politico ${nomePolitico} non trovato nella tabella users, notifica non creata`);
      return;
    }
    
    const politicoId = politicoResult.rows[0].id;
    
    // Trova gli utenti che hanno questo rappresentante
    const campoRappresentante = camera === 'Senato' ? 'rappresentante_senato' : 'rappresentante_camera';
    const utentiResult = await pool.query(
      `SELECT id FROM users WHERE ${campoRappresentante} = $1 AND status = 'a'`,
      [politicoId]
    );
    
    if (utentiResult.rows.length === 0) {
      return; // Nessun utente ha scelto questo rappresentante
    }
    
    // Crea la notifica
    // Nota: Il titolo viene formattato quando viene recuperato in routes/notifiche.js
    // basandosi sul genere del politico, quindi qui salviamo solo il titolo base
    const titolo = titoloVotazione;
    const testo = `Il voto di ${nomePolitico}: ${voto}`;
    
    try {
      await pool.query(
        `INSERT INTO notifiche_voti_parlamento (
          id_utente, politico, camera, titolo, testo, voto, data, votazione_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (votazione_hash) DO NOTHING`,
        [politicoId, nomePolitico, camera, titolo, testo, voto, dataVotazione, votazioneHash]
      );
      
      console.log(`[OK] Notifica creata per ${utentiResult.rows.length} utenti che hanno scelto ${nomePolitico}`);
    } catch (error) {
      if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
        console.error(`[ERR] Errore creazione notifica per ${nomePolitico}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`[ERR] Errore nella creazione notifiche per ${nomePolitico}:`, error.message);
  }
}

async function saveVotiNominaliToCache(uriVotazione, camera, votiNominali, bindingsFav, bindingsContr, bindingsAst) {
  try {
    // Assicurati che la tabella esista
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parlamento_voti_nominali (
        id SERIAL PRIMARY KEY,
        uri_votazione TEXT NOT NULL,
        camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
        nome_politico TEXT NOT NULL,
        voto VARCHAR(20) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto')),
        uri_politico TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uri_votazione, nome_politico, voto)
      )
    `);
    
    // Crea indici se non esistono
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_uri_votazione 
      ON parlamento_voti_nominali(uri_votazione)
    `);
    
    // Recupera il titolo della votazione per le notifiche
    let titoloVotazione = null;
    let dataVotazione = null;
    try {
      const votazioneResult = await pool.query(
        'SELECT titolo, data_votazione FROM parlamento WHERE uri = $1',
        [uriVotazione]
      );
      if (votazioneResult.rows.length > 0) {
        titoloVotazione = votazioneResult.rows[0].titolo;
        dataVotazione = votazioneResult.rows[0].data_votazione;
      }
    } catch (error) {
      console.warn(`⚠️ Errore recupero titolo votazione: ${error.message}`);
    }
    
    let savedCount = 0;
    
    // Salva voti favorevoli
    for (const binding of bindingsFav || []) {
      const nome = binding.nomeSenatore?.value;
      const uriPolitico = binding.senatore?.value;
      if (nome && nome.trim() !== '') {
        try {
          await pool.query(
            `INSERT INTO parlamento_voti_nominali (uri_votazione, camera, nome_politico, voto, uri_politico, data_sincronizzazione)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (uri_votazione, nome_politico, voto) 
             DO UPDATE SET 
               updated_at = CURRENT_TIMESTAMP,
               data_sincronizzazione = CURRENT_TIMESTAMP`,
            [uriVotazione, camera, nome, 'Favorevole', uriPolitico || null]
          );
          savedCount++;
          
          // Crea notifica se è un nuovo voto salvato (solo per Senato)
          if (camera === 'Senato' && titoloVotazione) {
            await creaNotificheParlamentoDaVotiNominali(nome, camera, titoloVotazione, 'Favorevole', dataVotazione);
          }
        } catch (error) {
          console.warn(`⚠️ Errore salvataggio voto favorevole ${nome}:`, error.message);
        }
      }
    }
    
    // Salva voti contrari
    for (const binding of bindingsContr || []) {
      const nome = binding.nomeSenatore?.value;
      const uriPolitico = binding.senatore?.value;
      if (nome && nome.trim() !== '') {
        try {
          await pool.query(
            `INSERT INTO parlamento_voti_nominali (uri_votazione, camera, nome_politico, voto, uri_politico, data_sincronizzazione)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (uri_votazione, nome_politico, voto) 
             DO UPDATE SET 
               updated_at = CURRENT_TIMESTAMP,
               data_sincronizzazione = CURRENT_TIMESTAMP`,
            [uriVotazione, camera, nome, 'Contrario', uriPolitico || null]
          );
          savedCount++;
          
          // Crea notifica se è un nuovo voto salvato (solo per Senato)
          if (camera === 'Senato' && titoloVotazione) {
            await creaNotificheParlamentoDaVotiNominali(nome, camera, titoloVotazione, 'Contrario', dataVotazione);
          }
        } catch (error) {
          console.warn(`⚠️ Errore salvataggio voto contrario ${nome}:`, error.message);
        }
      }
    }
    
    // Salva astenuti
    for (const binding of bindingsAst || []) {
      const nome = binding.nomeSenatore?.value;
      const uriPolitico = binding.senatore?.value;
      if (nome && nome.trim() !== '') {
        try {
          await pool.query(
            `INSERT INTO parlamento_voti_nominali (uri_votazione, camera, nome_politico, voto, uri_politico, data_sincronizzazione)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (uri_votazione, nome_politico, voto) 
             DO UPDATE SET 
               updated_at = CURRENT_TIMESTAMP,
               data_sincronizzazione = CURRENT_TIMESTAMP`,
            [uriVotazione, camera, nome, 'Astenuto', uriPolitico || null]
          );
          savedCount++;
          
          // Crea notifica se è un nuovo voto salvato (solo per Senato)
          if (camera === 'Senato' && titoloVotazione) {
            await creaNotificheParlamentoDaVotiNominali(nome, camera, titoloVotazione, 'Astenuto', dataVotazione);
          }
        } catch (error) {
          console.warn(`⚠️ Errore salvataggio voto astenuto ${nome}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Salvati ${savedCount} voti nominali nella cache`);
  } catch (error) {
    console.error(`❌ Errore nel salvataggio voti nominali nella cache:`, error.message);
  }
}

async function saveVotazioniToParlamento(votazioni) {
  let savedCount = 0;
  let errorCount = 0;
  
  console.log(`💾 Tentativo di salvare ${votazioni.length} votazioni nella tabella parlamento...`);
  
  for (const votazione of votazioni) {
    try {
      const result = await pool.query(
        `INSERT INTO parlamento (
          uri, votazione_id, camera, titolo, descrizione, data_votazione, esito,
          uri_seduta, numero_seduta, titolo_seduta, legislatura,
          favorevoli, contrari, presenti, votanti, maggioranza, tipo_votazione,
          approvato, metadati
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb)
        ON CONFLICT (uri) 
        DO UPDATE SET
          titolo = EXCLUDED.titolo,
          descrizione = EXCLUDED.descrizione,
          data_votazione = EXCLUDED.data_votazione,
          esito = EXCLUDED.esito,
          uri_seduta = EXCLUDED.uri_seduta,
          numero_seduta = EXCLUDED.numero_seduta,
          titolo_seduta = EXCLUDED.titolo_seduta,
          legislatura = EXCLUDED.legislatura,
          favorevoli = EXCLUDED.favorevoli,
          contrari = EXCLUDED.contrari,
          presenti = EXCLUDED.presenti,
          votanti = EXCLUDED.votanti,
          maggioranza = EXCLUDED.maggioranza,
          tipo_votazione = EXCLUDED.tipo_votazione,
          approvato = EXCLUDED.approvato,
          metadati = EXCLUDED.metadati,
          updated_at = CURRENT_TIMESTAMP,
          data_sincronizzazione = CURRENT_TIMESTAMP`,
        [
          votazione.uri,
          votazione.votazione_id,
          votazione.camera,
          votazione.titolo,
          votazione.descrizione,
          votazione.data_votazione,
          votazione.esito,
          votazione.uri_seduta,
          votazione.numero_seduta,
          votazione.titolo_seduta,
          votazione.legislatura,
          votazione.favorevoli,
          votazione.contrari,
          votazione.presenti,
          votazione.votanti,
          votazione.maggioranza,
          votazione.tipo_votazione,
          votazione.approvato,
          JSON.stringify(votazione.metadati)
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

// Funzione helper per salvare le votazioni nel database (legacy - mantiene compatibilità)
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

// POST /api/voti-politici/sync-openpolis-ultimi-ddl - Sincronizza manualmente ultimi DDL approvati da Openpolis "Cosa succede"
router.post('/sync-openpolis-ultimi-ddl', verifyToken, async (req, res) => {
  try {
    console.log('🔄 POST /api/voti-politici/sync-openpolis-ultimi-ddl - Sync manuale Openpolis ultimi DDL');
    const { runOpenpolisCosaSuccedeSync } = require('../jobs/openpolisCosaSuccedeJob');
    await runOpenpolisCosaSuccedeSync();
    const openpolisDdl = await loadOpenpolisUltimiDdl(pool);
    return res.json({
      success: true,
      message: 'Sync Openpolis ultimi DDL completato',
      camera: openpolisDdl.camera || null,
      senato: openpolisDdl.senato || null
    });
  } catch (error) {
    console.error('❌ Errore sync Openpolis ultimi DDL:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione Openpolis ultimi DDL',
      message: error.message
    });
  }
});

// GET /api/voti-politici/votazioni-finali-decisive - Solo votazioni finali decisive (Openpolis, main_vote_type=is_final)
router.get('/votazioni-finali-decisive', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    let rows = await loadOpenpolisVotazioniFinali(pool, limit);
    if (rows.length === 0) {
      try {
        const items = await fetchVotazioniFinaliDecisive(limit);
        if (items.length > 0) {
          await saveOpenpolisVotazioniFinaliToDb(items, pool);
          rows = await loadOpenpolisVotazioniFinali(pool, limit);
        }
      } catch (e) {
        console.warn('⚠️ Fallback fetch votazioni finali:', e.message);
      }
    }
    const data = rows.map(r => ({
      id: r.id,
      openpolis_id: r.openpolis_id,
      camera: r.camera,
      titolo: r.titolo,
      url_dettaglio: r.url_dettaglio,
      esito: r.esito,
      data_votazione: r.data_votazione,
      data_scraping: r.data_scraping
    }));
    return res.json({
      success: true,
      data,
      count: data.length,
      source: 'openpolis'
    });
  } catch (error) {
    console.error('❌ Errore votazioni finali decisive:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero votazioni finali decisive',
      message: error.message
    });
  }
});

// POST /api/voti-politici/sync-votazioni-finali-decisive - Sincronizza manualmente votazioni finali decisive da Openpolis
router.post('/sync-votazioni-finali-decisive', verifyToken, async (req, res) => {
  try {
    console.log('🔄 POST /api/voti-politici/sync-votazioni-finali-decisive - Sync manuale votazioni finali decisive');
    const { runOpenpolisVotazioniFinaliSync } = require('../jobs/openpolisVotazioniFinaliJob');
    await runOpenpolisVotazioniFinaliSync();
    const rows = await loadOpenpolisVotazioniFinali(pool, 50);
    return res.json({
      success: true,
      message: 'Sync votazioni finali decisive completato',
      count: rows.length
    });
  } catch (error) {
    console.error('❌ Errore sync votazioni finali decisive:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione',
      message: error.message
    });
  }
});

// GET /api/voti-politici/ultime - Ottieni le ultime N votazioni (default: 3) da Camera e Senato separatamente
router.get('/ultime', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 3, 100); // Default 3, max 100
    const useCache = req.query.cache !== 'false'; // Default true, usa cache se disponibile
    const forceRefresh = req.query.refresh === 'true'; // Forza refresh da SPARQL
    console.log(`🔍 GET /api/voti-politici/ultime - Richiesta ultime ${limit} votazioni per Camera e Senato (cache: ${useCache}, forceRefresh: ${forceRefresh})`);
    
    await ensureParlamentoTableExists();
    
    const result = {
      camera: [],
      senato: []
    };
    
    // Funzione helper per recuperare votazioni da database o SPARQL
    async function getVotazioni(camera, limitCount) {
      let votazioni = [];
      let shouldRefresh = false;
      
      // Se cache è abilitata, prova prima a recuperare dalla tabella "parlamento"
      if (useCache) {
        try {
          // Controlla se ci sono dati recenti (ultime 24 ore) nel database
          const checkRecent = await pool.query(`
            SELECT MAX(data_sincronizzazione) as last_sync, MAX(data_votazione) as last_date
            FROM parlamento
            WHERE camera = $1
          `, [camera]);
          
          const lastSync = checkRecent.rows[0]?.last_sync;
          const lastDate = checkRecent.rows[0]?.last_date;
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          // Se i dati sono più vecchi di 1 giorno, recupera da SPARQL
          shouldRefresh = !lastSync || new Date(lastSync) < oneDayAgo;
          
          if (shouldRefresh) {
            console.log(`🔄 Dati nel database troppo vecchi (ultima sync: ${lastSync || 'N/A'}), recupero da SPARQL...`);
          } else {
            const query = `
              SELECT 
                p.id,
                p.uri,
                p.votazione_id,
                p.camera,
                p.titolo,
                p.descrizione,
                p.data_votazione,
                p.esito,
                p.uri_seduta,
                p.numero_seduta,
                p.titolo_seduta,
                p.legislatura,
                p.favorevoli,
                p.contrari,
                p.presenti,
                p.votanti,
                p.maggioranza,
                p.tipo_votazione,
                p.approvato,
                p.metadati,
                p.created_at,
                p.updated_at,
                p.data_sincronizzazione,
                -- Dati arricchiti da votazioni_parlamento (Openpolis)
                vp.descrizione_votazione as descrizione_openpolis,
                vp.spiegazione as spiegazione_ai
              FROM parlamento p
              LEFT JOIN votazioni_parlamento vp ON (
                LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
                AND p.camera = vp.camera
                AND (
                  (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
                  (p.data_votazione = vp.data_votazione)
                )
              )
              WHERE p.titolo IS NOT NULL 
                AND p.titolo != ''
                AND p.titolo != 'N/A'
                AND p.camera = $1
              ORDER BY 
                COALESCE(p.data_votazione, p.data_sincronizzazione) DESC NULLS LAST,
                p.data_sincronizzazione DESC NULLS LAST,
                p.updated_at DESC NULLS LAST
              LIMIT $2
            `;
            
            const dbResult = await pool.query(query, [camera, limitCount]);
            
            if (dbResult.rows.length > 0) {
            votazioni = dbResult.rows.map(votazione => {
              // Usa descrizione da Openpolis se disponibile, altrimenti quella da SPARQL
              const descrizioneCompleta = votazione.descrizione_openpolis || 
                                         votazione.descrizione || 
                                         votazione.titolo || 
                                         'Votazione parlamentare';
              
              // Usa spiegazione AI se disponibile
              const spiegazione = votazione.spiegazione_ai || 
                                 votazione.metadati?.spiegazione || 
                                 null;
              
              return {
                id: votazione.id,
                uri: votazione.uri, // IMPORTANTE: URI per endpoint dettagli
                votazione_id: votazione.votazione_id,
                legislatura: votazione.legislatura,
                data_votazione: votazione.data_votazione || (votazione.data_sincronizzazione ? votazione.data_sincronizzazione.split('T')[0] : null),
                titolo_votazione: votazione.titolo || 'Votazione parlamentare',
                descrizione: descrizioneCompleta,
                descrizione_votazione: descrizioneCompleta,
                descrizione_completa: descrizioneCompleta,
                esito: votazione.esito,
                sigla_atto: null,
                numero_atto: null,
                tipo_atto: votazione.tipo_votazione,
                camera: votazione.camera || camera,
                spiegazione: spiegazione,
                url_votazione: votazione.uri || null,
                numero_seduta: votazione.numero_seduta || null,
                titolo_seduta: votazione.titolo_seduta || null,
                favorevoli: votazione.favorevoli,
                contrari: votazione.contrari,
                presenti: votazione.presenti,
                votanti: votazione.votanti,
                maggioranza: votazione.maggioranza,
                approvato: votazione.approvato,
                // Dati aggiuntivi dai metadati
                astenuti: votazione.metadati?.astenuti || null,
                numero_legale: votazione.metadati?.numeroLegale || null,
                presidente: votazione.metadati?.presidente || null,
                tipo_seduta: votazione.metadati?.sedutaTipo || null,
                metadati: votazione.metadati || {},
                data_sincronizzazione: votazione.data_sincronizzazione,
                data_aggiornamento: votazione.updated_at,
                source: 'database',
                // Flag per indicare se abbiamo dati arricchiti
                dati_arricchiti: !!votazione.descrizione_openpolis
              };
            });
            
              console.log(`✅ Trovate ${votazioni.length} votazioni ${camera} nella tabella parlamento`);
            }
          }
        } catch (dbError) {
          console.warn(`⚠️ Errore nel recupero da database per ${camera}, recupero da SPARQL:`, dbError.message);
        }
      }
      
      // Se non ci sono dati in cache, cache disabilitata, dati troppo vecchi, o refresh forzato, recupera direttamente da SPARQL
      if (votazioni.length === 0 || shouldRefresh || forceRefresh) {
        console.log(`📥 Recupero dati direttamente da SPARQL per ${camera}...`);
        
        try {
          const sparqlResults = await fetchFromSparql(camera, limitCount * 2); // Prendi più risultati per avere scelta
          if (sparqlResults.length > 0) {
            const votazioniProcessate = await processAndSaveVotazioni(sparqlResults, camera);
            
            // Ordina per data (più recente prima) e prendi le prime N
            votazioniProcessate.sort((a, b) => {
              const dateA = a.data_votazione ? new Date(a.data_votazione) : new Date(0);
              const dateB = b.data_votazione ? new Date(b.data_votazione) : new Date(0);
              return dateB - dateA; // Più recente prima
            });
            
            // Prendi le prime N votazioni uniche (per descrizione + camera)
            const uniqueVotazioni = [];
            const seen = new Set();
            
            for (const votazione of votazioniProcessate) {
              const key = `${votazione.descrizione || ''}_${votazione.camera || ''}_${votazione.data_votazione || ''}`;
              if (!seen.has(key) && uniqueVotazioni.length < limitCount) {
                seen.add(key);
                uniqueVotazioni.push(votazione);
              }
            }
            
            // Formatta le votazioni
            votazioni = uniqueVotazioni.map(votazione => ({
              id: votazione.id || null,
              uri: votazione.uri,
              votazione_id: votazione.votazione_id,
              legislatura: votazione.legislatura,
              data_votazione: votazione.data_votazione || null,
              titolo_votazione: votazione.titolo || votazione.descrizione || 'Votazione parlamentare',
              descrizione: votazione.descrizione || votazione.titolo || 'Votazione parlamentare',
              descrizione_votazione: votazione.descrizione || votazione.titolo || 'Votazione parlamentare',
              descrizione_completa: votazione.descrizione || votazione.titolo || 'Votazione parlamentare',
              esito: votazione.esito,
              sigla_atto: null,
              numero_atto: null,
              tipo_atto: votazione.tipo_votazione,
              camera: votazione.camera || camera,
              spiegazione: votazione.metadati?.spiegazione || null,
              url_votazione: votazione.uri || null,
              numero_seduta: votazione.numero_seduta || null,
              titolo_seduta: votazione.titolo_seduta || null,
              favorevoli: votazione.favorevoli,
              contrari: votazione.contrari,
              presenti: votazione.presenti,
              votanti: votazione.votanti,
              maggioranza: votazione.maggioranza,
              approvato: votazione.approvato,
              // Dati aggiuntivi dai metadati
              astenuti: votazione.metadati?.astenuti || null,
              numero_legale: votazione.metadati?.numeroLegale || null,
              presidente: votazione.metadati?.presidente || null,
              tipo_seduta: votazione.metadati?.sedutaTipo || null,
              metadati: votazione.metadati || {},
              data_sincronizzazione: votazione.data_sincronizzazione || new Date().toISOString(),
              data_aggiornamento: new Date().toISOString(),
              source: 'sparql',
              dati_arricchiti: false // Da SPARQL, non arricchito
            }));
            
            console.log(`✅ Recuperate ${votazioni.length} votazioni ${camera} da SPARQL`);
          }
        } catch (error) {
          console.error(`❌ Errore nel recupero da SPARQL ${camera}:`, error.message);
        }
      }
      
      return votazioni;
    }
    
    // Recupera votazioni Camera e Senato in parallelo
    const [votazioniCamera, votazioniSenato] = await Promise.all([
      getVotazioni('Camera', limit),
      getVotazioni('Senato', limit)
    ]);

    // Arricchisci con ultimi DDL approvati da Openpolis "Cosa succede" (titoli descrittivi)
    let openpolisDdl = await loadOpenpolisUltimiDdl(pool);
    // Se tabella vuota, fetch una volta da Openpolis e salva in background
    if (!openpolisDdl.camera && !openpolisDdl.senato) {
      try {
        const fetched = await Promise.race([
          fetchUltimiDdlApprovati(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
        ]);
        openpolisDdl = fetched;
        if (fetched.camera || fetched.senato) {
          setImmediate(() => saveOpenpolisDdlToDb(fetched, pool).catch(() => {}));
        }
      } catch (e) {
        console.warn('⚠️ Fallback fetch Openpolis ultimi DDL:', e.message);
      }
    }
    const openpolisItem = (row, camera) => ({
      id: null,
      uri: row.url_dettaglio,
      votazione_id: row.codice_ddl || null,
      legislatura: 19,
      data_votazione: row.data_approvazione || null,
      titolo_votazione: row.titolo,
      descrizione: row.titolo,
      descrizione_votazione: row.titolo,
      descrizione_completa: row.titolo,
      esito: 'Approvato',
      sigla_atto: null,
      numero_atto: null,
      tipo_atto: null,
      camera: camera,
      spiegazione: null,
      url_votazione: row.url_dettaglio,
      numero_seduta: null,
      titolo_seduta: null,
      favorevoli: null,
      contrari: null,
      presenti: null,
      votanti: null,
      maggioranza: null,
      approvato: 1,
      astenuti: null,
      numero_legale: null,
      presidente: null,
      tipo_seduta: null,
      metadati: {},
      data_sincronizzazione: row.data_scraping ? new Date(row.data_scraping).toISOString() : null,
      data_aggiornamento: null,
      source: 'openpolis',
      dati_arricchiti: true
    });
    if (openpolisDdl.camera) {
      result.camera = [openpolisItem(openpolisDdl.camera, 'Camera'), ...votazioniCamera].slice(0, limit);
    } else {
      result.camera = votazioniCamera;
    }
    if (openpolisDdl.senato) {
      result.senato = [openpolisItem(openpolisDdl.senato, 'Senato'), ...votazioniSenato].slice(0, limit);
    } else {
      result.senato = votazioniSenato;
    }

    // Dati combinati: merge SPARQL/DB + Openpolis (votazioni finali decisive) per data + camera
    const openpolisFinali = await loadOpenpolisVotazioniFinali(pool, 50);
    const normDate = (d) => (d && (typeof d === 'string' ? d.split('T')[0] : d)) || '';

    const openpolisFinaliItem = (row) => ({
      id: null,
      uri: row.url_dettaglio,
      votazione_id: row.openpolis_id || null,
      legislatura: 19,
      data_votazione: row.data_votazione || null,
      titolo_votazione: row.titolo,
      descrizione: row.titolo,
      descrizione_votazione: row.titolo,
      descrizione_completa: row.titolo,
      esito: row.esito || null,
      camera: row.camera,
      url_votazione: row.url_dettaglio,
      source: 'openpolis',
      dati_arricchiti: true,
      favorevoli: null,
      contrari: null,
      presenti: null,
      votanti: null,
      maggioranza: null,
      approvato: null,
      astenuti: null,
      numero_legale: null,
      presidente: null,
      tipo_seduta: null,
      metadati: {},
      spiegazione: null
    });

    function buildCombined(list, openpolisRows, cameraLabel, maxItems) {
      const usedOpenpolisIds = new Set();
      const combined = [];
      for (const v of list) {
        const dateKey = normDate(v.data_votazione);
        const openpolisMatch = openpolisRows.find(
          (r) => !usedOpenpolisIds.has(r.id) && normDate(r.data_votazione) === dateKey
        );
        if (openpolisMatch) {
          usedOpenpolisIds.add(openpolisMatch.id);
          combined.push({
            ...v,
            titolo_votazione: openpolisMatch.titolo,
            descrizione_votazione: openpolisMatch.titolo,
            descrizione: openpolisMatch.titolo,
            descrizione_completa: openpolisMatch.titolo,
            url_votazione: openpolisMatch.url_dettaglio,
            source: 'combined',
            dati_arricchiti: true
          });
        } else {
          combined.push(v);
        }
      }
      for (const r of openpolisRows) {
        if (usedOpenpolisIds.has(r.id)) continue;
        combined.push(openpolisFinaliItem(r));
      }
      combined.sort((a, b) => {
        const da = a.data_votazione ? new Date(a.data_votazione) : new Date(0);
        const db = b.data_votazione ? new Date(b.data_votazione) : new Date(0);
        return db - da;
      });
      return combined.slice(0, maxItems);
    }

    const openpolisCamera = (openpolisFinali || []).filter((r) => r.camera === 'Camera');
    const openpolisSenato = (openpolisFinali || []).filter((r) => r.camera === 'Senato');
    result.combined = {
      camera: buildCombined(result.camera, openpolisCamera, 'Camera', limit),
      senato: buildCombined(result.senato, openpolisSenato, 'Senato', limit)
    };

    const totalCount = result.camera.length + result.senato.length;
    
    if (totalCount === 0 && (!result.combined?.camera?.length && !result.combined?.senato?.length)) {
      return res.json({
        success: true,
        data: result,
        camera: result.camera,
        senato: result.senato,
        combined: result.combined || { camera: [], senato: [] },
        count: {
          camera: result.camera.length,
          senato: result.senato.length,
          combined_camera: result.combined?.camera?.length ?? 0,
          combined_senato: result.combined?.senato?.length ?? 0,
          total: 0
        },
        message: 'Nessuna votazione trovata. Gli endpoint SPARQL potrebbero non restituire risultati per la XIX legislatura.'
      });
    }
    
    const hasOpenpolisCamera = result.camera.length > 0 && result.camera[0].source === 'openpolis';
    const hasOpenpolisSenato = result.senato.length > 0 && result.senato[0].source === 'openpolis';
    if (hasOpenpolisCamera || hasOpenpolisSenato) {
      res.setHeader('X-Voti-Parlamento-Openpolis', [hasOpenpolisCamera && 'camera', hasOpenpolisSenato && 'senato'].filter(Boolean).join(','));
    }
    console.log(`✅ Restituite ${result.camera.length} votazioni Camera e ${result.senato.length} votazioni Senato${hasOpenpolisCamera || hasOpenpolisSenato ? ' (con DDL Openpolis)' : ''}`);

    return res.json({
      success: true,
      data: result,
      camera: result.camera,
      senato: result.senato,
      combined: result.combined,
      count: {
        camera: result.camera.length,
        senato: result.senato.length,
        combined_camera: result.combined?.camera?.length ?? 0,
        combined_senato: result.combined?.senato?.length ?? 0,
        total: totalCount
      }
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

// GET /api/voti-politici/dettagli/:uri - Ottieni dettagli completi di una singola votazione
router.get('/dettagli/:uri', verifyToken, async (req, res) => {
  try {
    const { uri } = req.params;
    const decodedUri = decodeURIComponent(uri);
    
    console.log(`🔍 GET /api/voti-politici/dettagli - Richiesta dettagli per: ${decodedUri}`);
    
    await ensureParlamentoTableExists();
    
    // Recupera la votazione dal database
    const query = `
      SELECT 
        p.id,
        p.uri,
        p.votazione_id,
        p.camera,
        p.titolo,
        p.descrizione,
        p.data_votazione,
        p.esito,
        p.uri_seduta,
        p.numero_seduta,
        p.titolo_seduta,
        p.legislatura,
        p.favorevoli,
        p.contrari,
        p.presenti,
        p.votanti,
        p.maggioranza,
        p.tipo_votazione,
        p.approvato,
        p.metadati,
        p.created_at,
        p.updated_at,
        p.data_sincronizzazione,
        vp.descrizione_votazione as descrizione_openpolis,
        vp.spiegazione as spiegazione_ai
      FROM parlamento p
      LEFT JOIN votazioni_parlamento vp ON (
        LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
        AND p.camera = vp.camera
        AND (
          (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
          (p.data_votazione = vp.data_votazione)
        )
      )
      WHERE p.uri = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [decodedUri]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Votazione non trovata'
      });
    }
    
    const votazione = result.rows[0];
    
    // Arricchisci con voti nominali se disponibili (solo Senato)
    let votiNominali = {
      favorevoli: [],
      contrari: [],
      astenuti: []
    };
    
    // Prima prova a recuperare dalla tabella cache
    try {
      const votiCacheQuery = `
        SELECT nome_politico, voto
        FROM parlamento_voti_nominali
        WHERE uri_votazione = $1
        ORDER BY voto, nome_politico
      `;
      const votiCacheResult = await pool.query(votiCacheQuery, [decodedUri]);
      
      if (votiCacheResult.rows.length > 0) {
        // Usa i dati dalla cache
        votiCacheResult.rows.forEach(row => {
          if (row.voto === 'Favorevole') {
            votiNominali.favorevoli.push(row.nome_politico);
          } else if (row.voto === 'Contrario') {
            votiNominali.contrari.push(row.nome_politico);
          } else if (row.voto === 'Astenuto') {
            votiNominali.astenuti.push(row.nome_politico);
          }
        });
        console.log(`✅ Voti nominali recuperati dalla cache: ${votiCacheResult.rows.length} voti`);
      } else if (votazione.camera === 'Senato') {
        // Se non ci sono in cache, recupera da SPARQL e salva
        console.log(`📥 Voti nominali non in cache, recupero da SPARQL...`);
        
        try {
        // Query per voti favorevoli
        const queryFavorevoli = `
          PREFIX osr: <http://dati.senato.it/osr/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          
          SELECT DISTINCT ?senatore ?nomeSenatore
          WHERE {
            <${decodedUri}> osr:favorevole ?senatore .
            OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
          }
          LIMIT 200
        `;
        
        const params = new URLSearchParams();
        params.append('query', queryFavorevoli);
        params.append('format', 'json');
        
        const responseFav = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
          headers: {
            'Accept': 'application/sparql-results+json, application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 15000
        });
        
        const bindingsFav = responseFav.data?.results?.bindings || [];
        votiNominali.favorevoli = bindingsFav
          .map(b => b.nomeSenatore?.value)
          .filter(nome => nome && nome.trim() !== '');
        
        // Query per voti contrari
        const queryContrari = `
          PREFIX osr: <http://dati.senato.it/osr/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          
          SELECT DISTINCT ?senatore ?nomeSenatore
          WHERE {
            <${decodedUri}> osr:contrario ?senatore .
            OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
          }
          LIMIT 200
        `;
        
        params.set('query', queryContrari);
        const responseContr = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
          headers: {
            'Accept': 'application/sparql-results+json, application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 15000
        });
        
        const bindingsContr = responseContr.data?.results?.bindings || [];
        votiNominali.contrari = bindingsContr
          .map(b => b.nomeSenatore?.value)
          .filter(nome => nome && nome.trim() !== '');
        
        // Query per astenuti
        const queryAstenuti = `
          PREFIX osr: <http://dati.senato.it/osr/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          
          SELECT DISTINCT ?senatore ?nomeSenatore
          WHERE {
            <${decodedUri}> osr:astenuto ?senatore .
            OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
          }
          LIMIT 200
        `;
        
        params.set('query', queryAstenuti);
        const responseAst = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
          headers: {
            'Accept': 'application/sparql-results+json, application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 15000
        });
        
        const bindingsAst = responseAst.data?.results?.bindings || [];
        votiNominali.astenuti = bindingsAst
          .map(b => b.nomeSenatore?.value)
          .filter(nome => nome && nome.trim() !== '');
        
        console.log(`✅ Recuperati ${votiNominali.favorevoli.length} favorevoli, ${votiNominali.contrari.length} contrari, ${votiNominali.astenuti.length} astenuti`);
        
        // Salva i voti nominali nella tabella cache
        await saveVotiNominaliToCache(decodedUri, votazione.camera, votiNominali, bindingsFav, bindingsContr, bindingsAst);
        
      } catch (error) {
        console.warn(`⚠️ Errore nel recupero voti nominali: ${error.message}`);
        // Continua senza voti nominali
      }
      }
    } catch (error) {
      console.warn(`⚠️ Errore nel recupero voti nominali dalla cache: ${error.message}`);
    }
    
    // Formatta la risposta
    const descrizioneCompleta = votazione.descrizione_openpolis || 
                               votazione.descrizione || 
                               votazione.titolo || 
                               'Votazione parlamentare';
    
    const spiegazione = votazione.spiegazione_ai || 
                       votazione.metadati?.spiegazione || 
                       null;
    
    const dettagli = {
      id: votazione.id,
      uri: votazione.uri,
      votazione_id: votazione.votazione_id,
      camera: votazione.camera,
      titolo: votazione.titolo || 'Votazione parlamentare',
      descrizione: descrizioneCompleta,
      descrizione_votazione: descrizioneCompleta,
      data_votazione: votazione.data_votazione || null,
      esito: votazione.esito,
      legislatura: votazione.legislatura,
      numero_seduta: votazione.numero_seduta,
      titolo_seduta: votazione.titolo_seduta,
      spiegazione: spiegazione,
      
      // Statistiche
      favorevoli: votazione.favorevoli,
      contrari: votazione.contrari,
      presenti: votazione.presenti,
      votanti: votazione.votanti,
      maggioranza: votazione.maggioranza,
      astenuti: votazione.metadati?.astenuti || null,
      numero_legale: votazione.metadati?.numeroLegale || null,
      tipo_votazione: votazione.tipo_votazione,
      approvato: votazione.approvato,
      
      // Informazioni aggiuntive
      presidente: votazione.metadati?.presidente || null,
      tipo_seduta: votazione.metadati?.sedutaTipo || null,
      uri_seduta: votazione.uri_seduta,
      
      // Voti nominali (solo se disponibili)
      voti_nominali: votiNominali.favorevoli.length > 0 || 
                    votiNominali.contrari.length > 0 || 
                    votiNominali.astenuti.length > 0 ? votiNominali : null,
      
      // Metadati completi
      metadati: votazione.metadati || {},
      dati_arricchiti: !!votazione.descrizione_openpolis,
      data_sincronizzazione: votazione.data_sincronizzazione,
      data_aggiornamento: votazione.updated_at
    };
    
    // Recupera o genera analisi legge (spiegazione generale + effetti positivi + negativi)
    let analisiLegge = null;
    try {
      // Controlla se è richiesta la rigenerazione forzata
      const forceRegenerate = req.query.force === 'true' || req.query.regenera === 'true';
      
      if (forceRegenerate) {
        console.log(`🔄 Rigenerazione forzata analisi legge per ${decodedUri}...`);
        // Genera nuova analisi (sovrascriverà quella in cache)
        analisiLegge = await generaAnalisiLegge(decodedUri, {
          titolo: votazione.titolo,
          descrizione: descrizioneCompleta,
          camera: votazione.camera,
          data_votazione: votazione.data_votazione
        });
      } else {
        // Prima prova a recuperare dalla cache
        analisiLegge = await recuperaAnalisiDaCache(decodedUri);
        
        // Se non c'è in cache, genera nuova analisi
        if (!analisiLegge) {
          console.log(`📝 Analisi legge non in cache, generazione nuova analisi...`);
          analisiLegge = await generaAnalisiLegge(decodedUri, {
            titolo: votazione.titolo,
            descrizione: descrizioneCompleta,
            camera: votazione.camera,
            data_votazione: votazione.data_votazione
          });
        }
      }
      
      // Aggiungi analisi ai dettagli se disponibile
      if (analisiLegge) {
        dettagli.analisi_legge = {
          spiegazione_generale: analisiLegge.spiegazione_generale,
          effetti_positivi: analisiLegge.effetti_positivi,
          effetti_negativi: analisiLegge.effetti_negativi,
          numero_legge: analisiLegge.numero_legge,
          tipo_atto: analisiLegge.tipo_atto,
          provider_ai: analisiLegge.provider_ai,
          modello_ai: analisiLegge.modello_ai,
          data_generazione: analisiLegge.data_generazione
        };
      }
    } catch (error) {
      console.warn(`⚠️ Errore nel recupero/generazione analisi legge: ${error.message}`);
      // Continua senza analisi legge (non bloccare la risposta)
    }
    
    res.json({
      success: true,
      data: dettagli
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero dettagli votazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dettagli',
      message: error.message
    });
  }
});

module.exports = router;

