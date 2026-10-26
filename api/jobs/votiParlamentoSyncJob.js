const { isPrivacyRecoveryMaintenanceActive } = require('../middleware/privacyRecoveryMaintenance');
const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');

// Configurazione database PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Funzione helper per recuperare dati da SPARQL (Camera o Senato)
 * Recupera TUTTI i dati disponibili incluso dalla seduta
 */
async function fetchFromSparql(camera = 'Camera', limit = 100) {
  let sparqlQuery;
  let sparqlEndpoint;
  
  if (camera === 'Senato') {
    // Solo XIX legislatura (come da indicazione datamaster@senato.it)
    sparqlQuery = `
      PREFIX osr: <http://dati.senato.it/osr/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                      ?tipoVotazione ?seduta ?sedutaData ?sedutaNumero ?sedutaLegislatura
      WHERE {
        ?votazione a osr:Votazione .
        ?votazione osr:seduta ?seduta .
        ?seduta osr:legislatura 19 .
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
        OPTIONAL { ?votazione osr:contrari ?contrari . }
        OPTIONAL { ?votazione osr:presenti ?presenti . }
        OPTIONAL { ?votazione osr:votanti ?votanti . }
        OPTIONAL { ?votazione osr:maggioranza ?maggioranza . }
        OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
        OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
        OPTIONAL { ?seduta osr:numeroSeduta ?sedutaNumero . }
        OPTIONAL { ?seduta osr:legislatura ?sedutaLegislatura . }
      }
      ORDER BY DESC(?sedutaData) DESC(?sedutaNumero) DESC(?votazione)
      LIMIT ${limit}
    `;
    sparqlEndpoint = 'https://dati.senato.it/sparql';
  } else {
    // Camera: solo XIX legislatura (ocd:rif_legislatura); data da ocd:data o dc:date
    sparqlQuery = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      
      SELECT DISTINCT ?votazione ?label ?approvato ?seduta ?sedutaData ?sedutaDataDc ?sedutaNumero ?sedutaTitle ?sedutaLegislatura
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        ?votazione ocd:rif_legislatura ?legislatura .
        ?legislatura ocd:numero 19 .
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione ocd:approvato ?approvato . }
        OPTIONAL { 
          ?votazione ocd:rif_seduta ?seduta .
          OPTIONAL { ?seduta ocd:data ?sedutaData . }
          OPTIONAL { ?seduta dc:date ?sedutaDataDc . }
          OPTIONAL { ?seduta ocd:identifier ?sedutaNumero . }
          OPTIONAL { ?seduta ocd:title ?sedutaTitle . }
          OPTIONAL { 
            ?seduta ocd:rif_leg ?leg .
            OPTIONAL { ?leg ocd:numero ?sedutaLegislatura . }
          }
        }
      }
      ORDER BY DESC(?sedutaData) DESC(?sedutaDataDc) DESC(?votazione)
      LIMIT ${limit}
    `;
    sparqlEndpoint = 'http://dati.camera.it/sparql';
  }
  
  try {
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

    const bindings = response.data?.results?.bindings || [];
    return bindings;
  } catch (error) {
    console.error(`❌ Errore nella chiamata SPARQL (${camera}):`, error.message);
    throw error;
  }
}

/**
 * Processa e salva le votazioni nella tabella "parlamento"
 */
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
      
      // Determina esito
      let esito = null;
      let approvato = null;
      if (camera === 'Camera') {
        approvato = result.approvato?.value === '1' || result.approvato?.value === 1 ? 1 : 
                   result.approvato?.value === '0' || result.approvato?.value === 0 ? 0 : null;
        esito = approvato === 1 ? 'Approvato' : approvato === 0 ? 'Non Approvato' : null;
      } else if (camera === 'Senato') {
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
      if (camera === 'Camera') {
        const dateStr = result.sedutaData?.value || result.sedutaDataDc?.value;
        if (dateStr) {
          if (dateStr.match(/^\d{8}$/)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            dataVotazione = `${year}-${month}-${day}`;
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            dataVotazione = dateStr.split('T')[0];
          }
        }
      } else if (camera === 'Senato' && result.sedutaData?.value) {
        // Senato: formato YYYY-MM-DD
        const dateStr = result.sedutaData.value;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          dataVotazione = dateStr.split('T')[0];
        }
      }
      
      const numeroSeduta = result.sedutaNumero?.value || null;
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
        favorevoli: camera === 'Senato' ? parseInt(result.favorevoli?.value || 0) : null,
        contrari: camera === 'Senato' ? parseInt(result.contrari?.value || 0) : null,
        presenti: camera === 'Senato' ? parseInt(result.presenti?.value || 0) : null,
        votanti: camera === 'Senato' ? parseInt(result.votanti?.value || 0) : null,
        maggioranza: camera === 'Senato' ? parseInt(result.maggioranza?.value || 0) : null,
        tipo_votazione: camera === 'Senato' ? result.tipoVotazione?.value || null : null,
        approvato: camera === 'Camera' ? approvato : null,
        metadati: {
          label: result.label?.value || null,
          approvato: result.approvato?.value || null,
          favorevoli: result.favorevoli?.value || null,
          contrari: result.contrari?.value || null,
          presenti: result.presenti?.value || null,
          votanti: result.votanti?.value || null,
          tipoVotazione: result.tipoVotazione?.value || null,
          seduta: result.seduta?.value || null,
          sedutaData: result.sedutaData?.value || null,
          sedutaNumero: result.sedutaNumero?.value || null,
          sedutaTitle: result.sedutaTitle?.value || null,
          sedutaLegislatura: result.sedutaLegislatura?.value || null,
          camera: camera
        }
      };
    }
  }

  // Salva nella tabella "parlamento"
  let savedCount = 0;
  for (const votazione of Object.values(votazioni)) {
    try {
      await pool.query(
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
    } catch (error) {
      console.error(`❌ Errore nel salvare votazione ${votazione.uri}:`, error.message);
    }
  }
  
  return savedCount;
}

/**
 * Job per sincronizzare le votazioni parlamentari.
 * Default ogni 6 ore; override con env VOTI_PARLAMENTO_SYNC_CRON (sintassi node-cron).
 */
const votiParlamentoSyncCron = process.env.VOTI_PARLAMENTO_SYNC_CRON || '0 */6 * * *';
const votiParlamentoSyncJob = cron.schedule(votiParlamentoSyncCron, async () => {
  if (isPrivacyRecoveryMaintenanceActive()) return;
  try {
    console.log('🔄 Avvio sincronizzazione automatica votazioni parlamentari...');
    
    const limit = 50; // Limite per ogni camera
    let totalSaved = 0;
    
    // Sincronizza Camera
    try {
      console.log('🔍 Sincronizzazione Camera...');
      const sparqlResultsCamera = await fetchFromSparql('Camera', limit);
      if (sparqlResultsCamera.length > 0) {
        const saved = await processAndSaveVotazioni(sparqlResultsCamera, 'Camera');
        totalSaved += saved;
        console.log(`✅ Camera: ${saved} votazioni salvate/aggiornate`);
      }
    } catch (error) {
      console.error('❌ Errore sincronizzazione Camera:', error.message);
    }
    
    // Sincronizza Senato
    try {
      console.log('🔍 Sincronizzazione Senato...');
      const sparqlResultsSenato = await fetchFromSparql('Senato', limit);
      if (sparqlResultsSenato.length > 0) {
        const saved = await processAndSaveVotazioni(sparqlResultsSenato, 'Senato');
        totalSaved += saved;
        console.log(`✅ Senato: ${saved} votazioni salvate/aggiornate`);
      }
    } catch (error) {
      console.error('❌ Errore sincronizzazione Senato:', error.message);
    }
    
    console.log(`✅ Sincronizzazione completata: ${totalSaved} votazioni totali salvate/aggiornate`);
    
  } catch (error) {
    console.error('❌ Errore nella sincronizzazione automatica votazioni parlamentari:', error);
  }
}, {
  scheduled: false, // Non avviare automaticamente (va avviato manualmente)
  timezone: 'Europe/Rome'
});

/**
 * Avvia il job di sincronizzazione
 */
const startVotiParlamentoSyncJob = () => {
  if (isPrivacyRecoveryMaintenanceActive()) return;
  console.log('🚀 Avvio job sincronizzazione votazioni parlamentari...');
  console.log(`   - Cron: ${votiParlamentoSyncCron}`);
  console.log('   - Camera e Senato');
  
  votiParlamentoSyncJob.start();
  
  console.log('✅ Job sincronizzazione votazioni parlamentari avviato');
};

/**
 * Ferma il job di sincronizzazione
 */
const stopVotiParlamentoSyncJob = () => {
  console.log('🛑 Arresto job sincronizzazione votazioni parlamentari...');
  votiParlamentoSyncJob.stop();
  console.log('✅ Job sincronizzazione votazioni parlamentari fermato');
};

module.exports = {
  startVotiParlamentoSyncJob,
  stopVotiParlamentoSyncJob,
  votiParlamentoSyncJob
};
