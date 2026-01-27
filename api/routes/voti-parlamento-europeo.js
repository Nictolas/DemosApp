const express = require('express');
const { verifyToken } = require('../middleware/auth');
const {
  getUltimeVotazioni,
  getDettagliVotazione,
  sincronizzaVotazioniPE,
  getVotiNominaliMEPItaliani
} = require('../services/parlamentoEuropeoService');
const { generaAnalisiLegge, recuperaAnalisiDaCache } = require('../services/leggeAnalysisService');

const router = express.Router();

// GET /api/voti-parlamento-europeo/ultime - Ottieni le ultime N votazioni
router.get('/ultime', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 1, 100); // Default 1 (ultima votazione), max 100
    const forceRefresh = req.query.refresh === 'true'; // Forza refresh da API
    
    console.log(`🔍 GET /api/voti-parlamento-europeo/ultime - Richiesta ultime ${limit} votazioni (refresh: ${forceRefresh})`);
    
    // Recupera dal database
    let votazioni = await getUltimeVotazioni(limit);
    
    // Se non ci sono votazioni recenti o è richiesto refresh, sincronizza
    // Controlla anche se tutte le votazioni sono vecchie (più di 6 mesi)
    const oggi = new Date();
    const seiMesiFa = new Date();
    seiMesiFa.setMonth(oggi.getMonth() - 6);
    
    const tutteVecchie = votazioni.length > 0 && votazioni.every(v => {
      const dataVotazione = v.data_votazione ? new Date(v.data_votazione) : null;
      return dataVotazione && dataVotazione < seiMesiFa;
    });
    
    if (votazioni.length === 0 || tutteVecchie || forceRefresh) {
      try {
        console.log('🔄 Database vuoto o refresh richiesto, sincronizzazione in corso...');
        const syncResult = await sincronizzaVotazioniPE(5); // Sincronizza ultime 5 sessioni
        console.log(`✅ Sincronizzazione completata: ${syncResult.salvate} salvate, ${syncResult.errori} errori`);
        // Ricarica dopo la sincronizzazione
        votazioni = await getUltimeVotazioni(limit);
        console.log(`📊 Votazioni recuperate dopo sincronizzazione: ${votazioni.length}`);
      } catch (syncError) {
        console.error('❌ Errore nella sincronizzazione:', syncError);
        console.error('   Stack:', syncError.stack);
        // Se c'è un errore ma abbiamo già dei dati, restituiscili comunque
        if (votazioni.length === 0) {
          return res.status(500).json({
            success: false,
            message: 'Errore nella sincronizzazione dei dati dal Parlamento Europeo',
            error: syncError.message,
            details: 'Impossibile recuperare le votazioni. Verifica i log del server per maggiori dettagli.'
          });
        }
      }
    }
    
    // Formatta la risposta
    const votazioniFormattate = votazioni.map(v => ({
      id: v.id,
      uri: v.uri,
      votazione_id: v.votazione_id,
      titolo: v.titolo,
      descrizione: v.descrizione,
      data_votazione: v.data_votazione,
      esito: v.esito,
      sessione_id: v.sessione_id,
      sessione_data: v.sessione_data,
      sessione_label: v.sessione_label,
      favorevoli: v.favorevoli,
      contrari: v.contrari,
      astenuti: v.astenuti,
      presenti: v.presenti,
      votanti: v.votanti,
      termine_parlamentare: v.termine_parlamentare,
      metadati: v.metadati || {},
      data_sincronizzazione: v.data_sincronizzazione
    }));
    
    console.log(`✅ Restituisco ${votazioniFormattate.length} votazioni`);
    
    res.json({
      success: true,
      data: votazioniFormattate,
      count: votazioniFormattate.length
    });
  } catch (error) {
    console.error('❌ Errore nel recupero votazioni PE:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle votazioni',
      error: error.message,
      details: error.stack
    });
  }
});

// GET /api/voti-parlamento-europeo/dettagli/:uri - Ottieni dettagli completi di una singola votazione
router.get('/dettagli/:uri', verifyToken, async (req, res) => {
  try {
    const { uri } = req.params;
    const decodedUri = decodeURIComponent(uri);
    
    console.log(`🔍 GET /api/voti-parlamento-europeo/dettagli - Richiesta dettagli per: ${decodedUri}`);
    
    // Recupera la votazione dal database
    const votazione = await getDettagliVotazione(decodedUri);
    
    if (!votazione) {
      return res.status(404).json({
        success: false,
        message: 'Votazione non trovata'
      });
    }
    
    // Recupera voti nominali MEP italiani
    let votiNominaliMEPItaliani = null;
    try {
      votiNominaliMEPItaliani = await getVotiNominaliMEPItaliani(decodedUri);
    } catch (votiError) {
      console.error('⚠️ Errore nel recupero voti nominali MEP italiani:', votiError.message);
      // Continua comunque senza voti nominali
    }
    
    // Verifica se esiste già un'analisi AI
    let analisiLegge = null;
    try {
      analisiLegge = await recuperaAnalisiDaCache(decodedUri);
      
      // Se non esiste, genera una nuova analisi
      if (!analisiLegge && votazione.titolo) {
        console.log('🤖 Generazione analisi AI per la votazione...');
        analisiLegge = await generaAnalisiLegge(votazione.titolo, decodedUri);
      }
    } catch (analisiError) {
      console.error('⚠️ Errore nella generazione analisi:', analisiError.message);
      // Continua comunque senza analisi
    }
    
    // Formatta la risposta
    const risposta = {
      id: votazione.id,
      uri: votazione.uri,
      votazione_id: votazione.votazione_id,
      titolo: votazione.titolo,
      descrizione: votazione.descrizione,
      data_votazione: votazione.data_votazione,
      esito: votazione.esito,
      sessione_id: votazione.sessione_id,
      sessione_data: votazione.sessione_data,
      sessione_label: votazione.sessione_label,
      favorevoli: votazione.favorevoli,
      contrari: votazione.contrari,
      astenuti: votazione.astenuti,
      presenti: votazione.presenti,
      votanti: votazione.votanti,
      termine_parlamentare: votazione.termine_parlamentare,
      metadati: votazione.metadati || {},
      data_sincronizzazione: votazione.data_sincronizzazione,
      voti_nominali_mep_italiani: votiNominaliMEPItaliani,
      analisi_legge: analisiLegge ? {
        spiegazione_generale: analisiLegge.spiegazione_generale,
        effetti_positivi: analisiLegge.effetti_positivi,
        effetti_negativi: analisiLegge.effetti_negativi,
        numero_legge: analisiLegge.numero_legge,
        tipo_atto: analisiLegge.tipo_atto,
        provider_ai: analisiLegge.provider_ai,
        modello_ai: analisiLegge.modello_ai,
        data_generazione: analisiLegge.data_generazione
      } : null
    };
    
    res.json({
      success: true,
      data: risposta
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dettagli PE:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero dei dettagli',
      error: error.message
    });
  }
});

// POST /api/voti-parlamento-europeo/rigenera-analisi/:uri - Rigenera l'analisi AI
router.post('/rigenera-analisi/:uri', verifyToken, async (req, res) => {
  try {
    const { uri } = req.params;
    const decodedUri = decodeURIComponent(uri);
    
    console.log(`🔄 POST /api/voti-parlamento-europeo/rigenera-analisi - Rigenerazione analisi per: ${decodedUri}`);
    
    // Recupera la votazione
    const votazione = await getDettagliVotazione(decodedUri);
    
    if (!votazione) {
      return res.status(404).json({
        success: false,
        message: 'Votazione non trovata'
      });
    }
    
    // Genera nuova analisi
    const analisiLegge = await generaAnalisiLegge(votazione.titolo, decodedUri);
    
    res.json({
      success: true,
      data: {
        spiegazione_generale: analisiLegge.spiegazione_generale,
        effetti_positivi: analisiLegge.effetti_positivi,
        effetti_negativi: analisiLegge.effetti_negativi,
        numero_legge: analisiLegge.numero_legge,
        tipo_atto: analisiLegge.tipo_atto,
        provider_ai: analisiLegge.provider_ai,
        modello_ai: analisiLegge.modello_ai,
        data_generazione: analisiLegge.data_generazione
      }
    });
  } catch (error) {
    console.error('❌ Errore nella rigenerazione analisi:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nella rigenerazione dell\'analisi',
      error: error.message
    });
  }
});

// POST /api/voti-parlamento-europeo/sincronizza - Sincronizza le votazioni dal PE
router.post('/sincronizza', verifyToken, async (req, res) => {
  try {
    const limitSessioni = parseInt(req.body.limitSessioni) || 5;
    
    console.log(`🔄 POST /api/voti-parlamento-europeo/sincronizza - Sincronizzazione (${limitSessioni} sessioni)`);
    
    const risultato = await sincronizzaVotazioniPE(limitSessioni);
    
    res.json({
      success: true,
      message: `Sincronizzazione completata: ${risultato.salvate} votazioni salvate, ${risultato.errori} errori`,
      data: risultato
    });
  } catch (error) {
    console.error('❌ Errore nella sincronizzazione:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nella sincronizzazione',
      error: error.message
    });
  }
});

// POST /api/voti-parlamento-europeo/aggiorna-titoli - Aggiorna i titoli delle votazioni esistenti
router.post('/aggiorna-titoli', verifyToken, async (req, res) => {
  try {
    const { getPool } = require('../config/database');
    const pool = getPool();
    const { fetchDettagliVotazioneDiretta, estraiTitoloVotazione } = require('../services/parlamentoEuropeoService');
    
    console.log(`🔄 POST /api/voti-parlamento-europeo/aggiorna-titoli - Aggiornamento titoli`);
    
    // Recupera tutte le votazioni con titoli generici
    const result = await pool.query(`
      SELECT uri, votazione_id, titolo
      FROM parlamento_europeo
      WHERE titolo LIKE 'Votazione %' OR titolo LIKE 'Votazione del %'
      ORDER BY data_votazione DESC
      LIMIT 100
    `);
    
    let aggiornate = 0;
    let errori = 0;
    
    for (const votazione of result.rows) {
      try {
        // Prova a recuperare i dettagli direttamente
        const votazioneDiretta = await fetchDettagliVotazioneDiretta(votazione.uri);
        if (votazioneDiretta) {
          const nuovoTitolo = estraiTitoloVotazione(votazioneDiretta);
          if (nuovoTitolo && nuovoTitolo !== votazione.titolo && nuovoTitolo.length > votazione.titolo.length) {
            await pool.query(`
              UPDATE parlamento_europeo
              SET titolo = $1, updated_at = CURRENT_TIMESTAMP
              WHERE uri = $2
            `, [nuovoTitolo, votazione.uri]);
            aggiornate++;
            console.log(`✅ Aggiornato titolo per ${votazione.uri}: "${nuovoTitolo}"`);
          }
        }
      } catch (error) {
        errori++;
        console.error(`⚠️ Errore nell'aggiornamento titolo per ${votazione.uri}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Aggiornamento completato: ${aggiornate} titoli aggiornati, ${errori} errori`,
      data: {
        aggiornate,
        errori,
        totali: result.rows.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento titoli:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiornamento dei titoli',
      error: error.message
    });
  }
});

module.exports = router;
