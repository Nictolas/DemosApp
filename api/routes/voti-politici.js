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

// GET /api/voti-politici - Ottieni votazioni della Camera dei Deputati
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-politici - Richiesta votazioni Camera');
    
    // Query SPARQL per ottenere le votazioni dell'ultima legislatura
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
      LIMIT 100
    `;

    // Interroga l'endpoint SPARQL della Camera
    // SPARQL richiede POST con form-urlencoded
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

    // Processa i risultati SPARQL
    const results = response.data.results?.bindings || [];
    
    if (results.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Nessuna votazione trovata'
      });
    }

    // Raggruppa i risultati per votazione
    const votazioni = {};
    for (const result of results) {
      const votazioneUri = result.votazione?.value;
      const predicato = result.predicato?.value;
      const oggetto = result.oggetto?.value;

      if (!votazioneUri) continue;

      if (!votazioni[votazioneUri]) {
        votazioni[votazioneUri] = {
          uri: votazioneUri,
          id: votazioneUri.split('/').pop() || votazioneUri,
          data: {},
          data_creazione: null,
          descrizione: null,
          esito: null,
          sigla_atto: null,
          numero_atto: null,
          tipo_atto: null
        };
      }

      // Estrai il nome del predicato (ultima parte dopo / o #)
      const nomePredicato = predicato.split('/').pop().split('#').pop();
      
      // Mappa i predicati comuni a campi più leggibili
      if (nomePredicato === 'date' || nomePredicato === 'data') {
        votazioni[votazioneUri].data_creazione = oggetto;
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

      // Salva anche tutti i predicati originali
      votazioni[votazioneUri].data[nomePredicato] = oggetto;
    }

    // Converti l'oggetto in array
    const votazioniArray = Object.values(votazioni);

    // Ordina per data (più recenti prima)
    votazioniArray.sort((a, b) => {
      const dateA = a.data_creazione ? new Date(a.data_creazione) : new Date(0);
      const dateB = b.data_creazione ? new Date(b.data_creazione) : new Date(0);
      return dateB - dateA;
    });

    console.log(`✅ Trovate ${votazioniArray.length} votazioni`);

    res.json({
      success: true,
      data: votazioniArray,
      count: votazioniArray.length
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare votazioni:', error);
    
    // Se l'errore è relativo alla connessione SPARQL, restituisci un messaggio più chiaro
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

module.exports = router;

