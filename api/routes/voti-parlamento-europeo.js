const express = require('express');
const { verifyToken } = require('../middleware/auth');
const {
  getUltimeVotazioni,
  getDettagliVotazione
} = require('../services/parlamentoEuropeoService');
const { generaAnalisiLegge, recuperaAnalisiDaCache } = require('../services/leggeAnalysisService');

const router = express.Router();

// GET /api/voti-parlamento-europeo/ultime - Ottieni le ultime N votazioni
router.get('/ultime', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 1, 100); // Default 1 (ultima votazione), max 100
    const forceRefresh = false; // Never trigger historical DB writers from a GET
    
    console.log(`🔍 GET /api/voti-parlamento-europeo/ultime - Richiesta ultime ${limit} votazioni (refresh: ${forceRefresh})`);
    
    // Recupera dal database
    console.log(`📊 Recupero votazioni dal database...`);
    let votazioni = [];
    try {
      votazioni = await getUltimeVotazioni(limit);
      console.log(`✅ Recuperate ${votazioni.length} votazioni dal database`);
    } catch (dbError) {
      console.error('❌ Errore nel recupero dal database:', dbError);
      // Restituisci array vuoto invece di bloccare
      votazioni = [];
    }
    
    // I refresh preesistenti costruiscono tabelle storiche. Per PROD-041
    // l'endpoint è sola lettura finché il writer canonico è integrato.
    // Se non ci sono votazioni, restituisci array vuoto invece di bloccare
    // L'utente può richiedere manualmente la sincronizzazione se necessario
    
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
    
    // Verifica se la votazione è recente (meno di 1 anno) prima di recuperare dati aggiuntivi
    const dataVotazione = votazione.data_votazione ? new Date(votazione.data_votazione) : null;
    const unAnnoFa = new Date();
    unAnnoFa.setFullYear(unAnnoFa.getFullYear() - 1);
    const isVotazioneRecente = dataVotazione && dataVotazione >= unAnnoFa;
    
    // Il lettore storico per URI scriveva (uri_votazione,mep_id), violando
    // l'unico ultimo voto e attribuendo assenze non documentate.
    // Le posizioni ufficiali saranno esposte soltanto tramite il record
    // corrente verificato del rappresentante, non nella lista storica.
    const votiNominaliMEPItaliani = null;

    // Verifica se esiste già un'analisi AI (solo per votazioni recenti)
    let analisiLegge = null;
    if (isVotazioneRecente) {
      try {
        analisiLegge = await recuperaAnalisiDaCache(decodedUri);
        
        // Se non esiste, genera una nuova analisi (solo per votazioni recenti)
        if (!analisiLegge && votazione.titolo) {
          try {
            console.log('🤖 Generazione analisi AI per la votazione...');
            // Aggiungi timeout per evitare blocchi
            const analisiPromise = generaAnalisiLegge(votazione.titolo, decodedUri);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout generazione analisi (20s)')), 20000)
            );
            analisiLegge = await Promise.race([analisiPromise, timeoutPromise]);
          } catch (analisiTimeoutError) {
            console.error('⚠️ Timeout nella generazione analisi:', analisiTimeoutError.message);
            // Continua senza analisi
          }
        }
      } catch (analisiError) {
        console.error('⚠️ Errore nella generazione analisi:', analisiError.message);
        // Continua comunque senza analisi
      }
    } else {
      console.log(`⚠️ Votazione vecchia, salto generazione analisi AI`);
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
router.post('/sincronizza', verifyToken, (_req, res) => {
  return res.status(409).json({
    success: false,
    message: 'Sincronizzazione storica disabilitata: usare esclusivamente il writer canonico ultimo-voto dopo i gate.'
  });
});

// POST /api/voti-parlamento-europeo/aggiorna-titoli - Aggiorna i titoli delle votazioni esistenti
router.post('/aggiorna-titoli', verifyToken, (_req, res) => {
  return res.status(409).json({
    success: false,
    message: 'Aggiornamento legacy sospeso durante la migrazione al solo ultimo voto.'
  });
});

module.exports = router;
