'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per migrare centralized_logs da Neon ad Axiom usando SOLO colonne GDPR obbligatorie
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const axios = require('axios');

let Axiom;
let axiomClient;

// Campi GDPR OBBLIGATORI (solo questi)
const GDPR_REQUIRED_FIELDS = [
  '_time',           // Timestamp (obbligatorio)
  'level',           // Livello log (obbligatorio)
  'message',         // Messaggio (obbligatorio)
  'user_id',         // ID utente (obbligatorio)
  'ip_address',      // IP (obbligatorio)
  'endpoint',        // Endpoint API (obbligatorio)
  'session_id',      // ID sessione (obbligatorio)
  'user_agent'       // User Agent (utile per sicurezza)
];

// Campi da ESCLUDERE (non GDPR)
const FIELDS_TO_EXCLUDE = [
  'pid', 'hostname', 'request_id', 'freed', 'afterGC', 'beforeGC',
  'alertType', 'errors', 'method', 'statusCode', 'responseTime',
  'url', 'headers', 'created', 'timestamp', 'severity', 'skipped',
  'threshold', 'total', 'updated', 'value'
];

async function migrateNeonToAxiomGDPROnly() {
  console.log('🚀 Migrazione centralized_logs da Neon ad Axiom (SOLO GDPR)\n');
  
  // Verifica variabili ambiente
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non configurato');
    process.exit(1);
  }
  
  if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
    console.error('❌ Token o Org ID Axiom mancanti');
    process.exit(1);
  }
  
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  const apiDomain = region === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
  const baseUrl = `https://${apiDomain}`;
  const edgeDomain = process.env.AXIOM_EDGE_DOMAIN
    || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
  const edgeUrl = `https://${edgeDomain}`;
  const dataset = 'centralized_logs';
  
  // Inizializza SDK Axiom
  try {
    Axiom = require('@axiomhq/axiom-node');
    axiomClient = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    console.log('✅ SDK Axiom inizializzato');
  } catch (sdkErr) {
    console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
    console.log('   Procedo con API REST...');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Step 1: Elimina dataset esistente su Axiom
    console.log('🗑️ Step 1: Eliminazione dataset centralized_logs su Axiom...');
    try {
      await axios.delete(
        `${baseUrl}/v1/datasets/${dataset}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
            'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
          }
        }
      );
      console.log('✅ Dataset centralized_logs eliminato');
    } catch (deleteErr) {
      if (deleteErr.response?.status === 404) {
        console.log('⚠️ Dataset non esiste, procediamo con la creazione');
      } else if (deleteErr.response?.status === 403) {
        console.log('⚠️ ERRORE 403: Il token non ha i permessi per eliminare il dataset.');
        console.log('   ⚠️ Devi eliminare manualmente il dataset "centralized_logs" su Axiom Dashboard');
        console.log('   ⚠️ Oppure verifica che il token abbia i permessi "Datasets" -> WRITE');
        console.log('   ⚠️ Procedo comunque con la creazione (potrebbe fallire se il dataset esiste già)...');
      } else {
        throw deleteErr;
      }
    }
    
    // Step 2: Verifica/Crea dataset su Axiom
    console.log('\n📦 Step 2: Verifica dataset centralized_logs su Axiom...');
    let datasetExists = false;
    
    try {
      // Prova prima con SDK
      if (axiomClient) {
        try {
          await axiomClient.datasets.create({
            name: dataset,
            description: 'Centralized logs - Solo campi GDPR obbligatori'
          });
          console.log('✅ Dataset centralized_logs creato (via SDK)');
          datasetExists = true;
        } catch (sdkCreateErr) {
          if (sdkCreateErr.message?.includes('already exists') || sdkCreateErr.statusCode === 409) {
            console.log('✅ Dataset centralized_logs esiste già (via SDK)');
            datasetExists = true;
          } else {
            console.log('⚠️ SDK non ha permessi per creare dataset, verifico se esiste già...');
            // Verifica se esiste
            try {
              const datasets = await axiomClient.datasets.list();
              datasetExists = datasets.some(ds => ds.name === dataset);
              if (datasetExists) {
                console.log('✅ Dataset centralized_logs esiste già');
              } else {
                console.log('⚠️ Dataset non esiste. Crea manualmente il dataset "centralized_logs" su Axiom Dashboard');
                console.log('   ⚠️ Poi riesegui lo script per migrare i dati');
                throw new Error('Dataset non esiste. Crealo manualmente su Axiom Dashboard');
              }
            } catch (listErr) {
              console.log('⚠️ Impossibile verificare dataset, procedo comunque...');
              datasetExists = true; // Assumiamo che esista
            }
          }
        }
      } else {
        console.log('⚠️ SDK non disponibile, assumo che il dataset esista già');
        datasetExists = true;
      }
    } catch (err) {
      console.log('⚠️ Errore verifica dataset:', err.message);
      console.log('   ⚠️ Assumo che il dataset esista già e procedo...');
      datasetExists = true;
    }
    
    if (!datasetExists) {
      throw new Error('Dataset centralized_logs non esiste. Crealo manualmente su Axiom Dashboard prima di continuare.');
    }
    
    // Step 3: Conta record su Neon
    console.log('\n📊 Step 3: Conteggio record su Neon...');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    const totalRecords = parseInt(countResult.rows[0].count);
    console.log(`✅ Trovati ${totalRecords.toLocaleString('it-IT')} record su Neon`);
    
    if (totalRecords === 0) {
      console.log('⚠️ Nessun record da migrare');
      await pool.end();
      return;
    }
    
    // Step 4: Estrai record esistenti da Axiom per evitare duplicati
    console.log('\n🔍 Step 4: Estrazione record esistenti da Axiom per evitare duplicati...');
    const existingKeys = new Set();
    
    try {
      // Estrai tutti i record esistenti (con limit per performance)
      const existingQuery = `['${dataset}'] | limit 100000`;
      const existingResult = await axiomClient.query(existingQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        timeout: 300000
      });
      
      let existingRecords = [];
      if (existingResult.matches && Array.isArray(existingResult.matches)) {
        existingRecords = existingResult.matches;
      } else if (existingResult.buckets && Array.isArray(existingResult.buckets)) {
        existingRecords = existingResult.buckets.flatMap(b => b.rows || b.data || []);
      } else if (existingResult.data?.rows && Array.isArray(existingResult.data.rows)) {
        existingRecords = existingResult.data.rows;
      } else if (existingResult.rows && Array.isArray(existingResult.rows)) {
        existingRecords = existingResult.rows;
      }
      
      // Crea chiavi uniche per i record esistenti
      // Chiave: _time + message + user_id + ip_address
      existingRecords.forEach(record => {
        const data = record.data || record;
        const time = record._time || data._time || '';
        const message = (data.message || '').toString();
        const userId = (data.user_id || '').toString();
        const ipAddress = (data.ip_address || '').toString();
        const key = `${time}|${message}|${userId}|${ipAddress}`;
        existingKeys.add(key);
      });
      
      console.log(`✅ Trovati ${existingKeys.size.toLocaleString('it-IT')} record esistenti su Axiom`);
      console.log(`   ⚠️ Questi record verranno saltati per evitare duplicati\n`);
    } catch (existingErr) {
      console.log(`⚠️ Impossibile estrarre record esistenti: ${existingErr.message}`);
      console.log(`   ⚠️ Procedo comunque con la migrazione (potrebbero esserci duplicati)\n`);
    }
    
    // Step 5: Estrai e migra record in batch (solo quelli non presenti)
    console.log('📤 Step 5: Migrazione record (solo campi GDPR, senza duplicati)...');
    const batchSize = 1000;
    let offset = 0;
    let migrated = 0;
    let skipped = 0;
    let batches = 0;
    
    while (offset < totalRecords) {
      const query = `
        SELECT 
          timestamp,
          level,
          message,
          user_id,
          ip_address,
          endpoint,
          session_id,
          user_agent
        FROM centralized_logs
        ORDER BY timestamp ASC
        LIMIT $1 OFFSET $2
      `;
      
      const result = await pool.query(query, [batchSize, offset]);
      
      if (result.rows.length === 0) {
        break;
      }
      
      // Converti record Neon in formato Axiom (solo campi GDPR)
      const axiomRecords = [];
      
      for (const row of result.rows) {
        // Converti timestamp BIGINT a ISO string
        let timestamp;
        try {
          if (row.timestamp) {
            timestamp = new Date(parseInt(row.timestamp)).toISOString();
          } else {
            timestamp = new Date().toISOString();
          }
        } catch (e) {
          timestamp = new Date().toISOString();
        }
        
        // Decodifica livello log
        const levelMap = {
          'I': 'INFO',
          'E': 'ERROR',
          'W': 'WARNING',
          'D': 'DEBUG'
        };
        const level = levelMap[row.level] || row.level || 'INFO';
        
        // Crea chiave unica per questo record
        const message = (row.message || '').toString();
        const userId = (row.user_id || '').toString();
        const ipAddress = (row.ip_address || '').toString();
        const uniqueKey = `${timestamp}|${message}|${userId}|${ipAddress}`;
        
        // Verifica se il record esiste già su Axiom
        if (existingKeys.has(uniqueKey)) {
          skipped++;
          continue; // Salta questo record
        }
        
        // Crea record con SOLO campi GDPR obbligatori
        // NOTA: Axiom richiede che _time sia una stringa ISO 8601
        const record = {
          _time: timestamp,
          level: level,
          message: message,
          log_type: 'application'
        };
        
        // Aggiungi solo campi GDPR se presenti (anche se null, per mantenere struttura)
        record.user_id = row.user_id || null;
        record.ip_address = row.ip_address || null;
        record.endpoint = row.endpoint || null;
        record.session_id = row.session_id || null;
        record.user_agent = row.user_agent || null;
        
        // NOTA: NON includiamo request_id (non GDPR obbligatorio)
        
        axiomRecords.push(record);
      }
      
      // Invia batch ad Axiom solo se ci sono record da inviare
      if (axiomRecords.length > 0) {
        try {
          const response = await axios.post(
            `${edgeUrl}/v1/ingest/${dataset}`,
            axiomRecords,
            {
              headers: {
                'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
              },
              timeout: 60000
            }
          );
          
          // Verifica risposta
          if (response.status === 200 || response.status === 204) {
            // Verifica se ci sono errori nella risposta
            if (response.data) {
              const ingested = response.data.ingested || 0;
              const failed = response.data.failed || 0;
              
              if (failed > 0) {
                console.error(`⚠️ Batch ${batches}: ${failed} record falliti su ${axiomRecords.length}`);
                if (response.data.failures && response.data.failures.length > 0) {
                  console.error(`   Errori:`, JSON.stringify(response.data.failures.slice(0, 3), null, 2)); // Mostra primi 3 errori
                }
              }
              
              if (ingested > 0) {
                migrated += ingested;
                if (batches % 10 === 0 || offset + batchSize >= totalRecords) {
                  console.log(`   ✅ Batch ${batches}: ${ingested}/${axiomRecords.length} record ingeriti (failed: ${failed}), ${skipped} saltati (totale migrati: ${migrated.toLocaleString('it-IT')}, saltati: ${skipped.toLocaleString('it-IT')})`);
                }
              } else {
                migrated += axiomRecords.length; // Fallback se ingested non è presente
                if (batches % 10 === 0 || offset + batchSize >= totalRecords) {
                  console.log(`   ✅ Batch ${batches}: ${axiomRecords.length} record inviati (status: ${response.status}, response: ${JSON.stringify(response.data)}), ${skipped} saltati (totale migrati: ${migrated.toLocaleString('it-IT')}, saltati: ${skipped.toLocaleString('it-IT')})`);
                }
              }
            } else {
              migrated += axiomRecords.length;
              if (batches % 10 === 0 || offset + batchSize >= totalRecords) {
                console.log(`   ✅ Batch ${batches}: ${axiomRecords.length} record inviati (status: ${response.status}, no response data), ${skipped} saltati (totale migrati: ${migrated.toLocaleString('it-IT')}, saltati: ${skipped.toLocaleString('it-IT')})`);
              }
            }
            
            batches++;
          } else {
            console.error(`⚠️ Batch ${batches}: Risposta inattesa (status: ${response.status})`);
            console.error(`   Response data:`, response.data);
          }
        } catch (ingestErr) {
          console.error(`❌ Errore ingest batch ${batches}:`, ingestErr.response?.status, ingestErr.response?.data || ingestErr.message);
          console.error(`   Batch size: ${axiomRecords.length}`);
          console.error(`   Primo record:`, JSON.stringify(axiomRecords[0], null, 2));
          throw ingestErr;
        }
      } else {
        // Nessun record da inviare in questo batch (tutti duplicati)
        if (offset + batchSize >= totalRecords || skipped % 1000 === 0) {
          console.log(`   ⏭️  Batch ${Math.floor(offset / batchSize) + 1}: Tutti i record sono già presenti (saltati: ${skipped.toLocaleString('it-IT')})`);
        }
      }
      
      offset += batchSize;
    }
    
    console.log(`\n✅ Migrazione completata!`);
    console.log(`   Record migrati: ${migrated.toLocaleString('it-IT')}`);
    console.log(`   Record saltati (già presenti): ${skipped.toLocaleString('it-IT')}`);
    console.log(`   Batch inviati: ${batches}`);
    console.log(`   Campi inclusi: ${GDPR_REQUIRED_FIELDS.join(', ')}`);
    
    if (skipped > 0) {
      console.log(`\n✅ Nessun duplicato generato: ${skipped.toLocaleString('it-IT')} record già presenti sono stati saltati`);
    }
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui migrazione
migrateNeonToAxiomGDPROnly()
  .then(() => {
    console.log('\n✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });

