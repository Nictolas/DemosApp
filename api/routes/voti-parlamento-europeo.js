const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
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
    const forceRefresh = req.query.refresh === 'true'; // Refresh da API solo per Admin
    
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
    
    // Sincronizza SOLO se esplicitamente richiesto con refresh=true
    // La sincronizzazione automatica è disabilitata perché può richiedere molto tempo
    // e bloccare la risposta HTTP. Usa l'endpoint POST /sincronizza per sincronizzazioni manuali.
    if (forceRefresh) {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ success: false, message: 'Operazione riservata all’amministratore' });
      }
      try {
        console.log('🔄 Refresh richiesto, sincronizzazione in corso...');
        // Usa Promise.race per aggiungere un timeout di 30 secondi
        const syncPromise = sincronizzaVotazioniPE(3); // Sincronizza solo ultime 3 sessioni per essere più veloce
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout sincronizzazione (30s)')), 30000)
        );
        
        const syncResult = await Promise.race([syncPromise, timeoutPromise]);
        console.log(`✅ Sincronizzazione completata: ${syncResult.salvate} salvate, ${syncResult.errori} errori`);
        // Ricarica dopo la sincronizzazione
        votazioni = await getUltimeVotazioni(limit);
        console.log(`📊 Votazioni recuperate dopo sincronizzazione: ${votazioni.length}`);
      } catch (syncError) {
        console.error('❌ Errore nella sincronizzazione:', syncError);
        console.error('   Stack:', syncError.stack);
        // Se c'è un errore, restituisci comunque i dati disponibili (anche se vecchi)
        // Non bloccare la risposta per errori di sincronizzazione
        if (votazioni.length === 0) {
          // Se non ci sono dati, restituisci array vuoto invece di errore
          votazioni = [];
        }
      }
    }
    
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
      error: 'Errore interno',
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
    
    // Recupera voti nominali MEP italiani (solo per votazioni recenti per evitare timeout)
    let votiNominaliMEPItaliani = null;
    if (isVotazioneRecente) {
      try {
        // Aggiungi timeout per evitare blocchi
        const votiPromise = getVotiNominaliMEPItaliani(decodedUri);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout recupero voti MEP (15s)')), 15000)
        );
        votiNominaliMEPItaliani = await Promise.race([votiPromise, timeoutPromise]);
      } catch (votiError) {
        console.error('⚠️ Errore nel recupero voti nominali MEP italiani:', votiError.message);
        // Continua comunque senza voti nominali
        votiNominaliMEPItaliani = {
          favorevoli: [],
          contrari: [],
          astenuti: [],
          assenti: [],
          disponibili: false,
          messaggio: 'Voti non disponibili per questa votazione'
        };
      }
    } else {
      console.log(`⚠️ Votazione vecchia (${dataVotazione ? dataVotazione.toISOString().split('T')[0] : 'N/A'}), salto recupero voti MEP per evitare timeout`);
      votiNominaliMEPItaliani = {
        favorevoli: [],
        contrari: [],
        astenuti: [],
        assenti: [],
        disponibili: false,
        messaggio: 'Voti non disponibili per votazioni vecchie'
      };
    }
    
    // Verifica se esiste già un'analisi AI (solo per votazioni recenti)
    let analisiLegge = null;
    if (isVotazioneRecente) {
      try {
        analisiLegge = await recuperaAnalisiDaCache(decodedUri);
        
        // Se non esiste, genera una nuova analisi (solo per votazioni recenti)
        if (!analisiLegge && votazione.titolo && req.user?.isAdmin) {
          try {
            console.log('🤖 Generazione analisi AI per la votazione...');
            // Aggiungi timeout per evitare blocchi
            const analisiPromise = generaAnalisiLegge(decodedUri, {
              titolo: votazione.titolo,
              descrizione: votazione.descrizione || '',
              camera: 'Parlamento europeo',
              data_votazione: votazione.data_votazione
            });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout generazione analisi (20s)')), 20000)
            );
            analisiLegge = await Promise.race([analisiPromise, timeoutPromise]);
          } catch (analisiTimeoutError) {
            console.warn('Analisi AI PE non disponibile: timeout o errore temporaneo');
            // Continua senza analisi
          }
        }
      } catch (analisiError) {
        console.warn('Analisi AI PE non disponibile: generazione non riuscita');
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
    console.error('Errore interno nel recupero dei dettagli delle votazioni PE');
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero dei dettagli',
      error: 'Errore interno'
    });
  }
});

// POST /api/voti-parlamento-europeo/rigenera-analisi/:uri - Rigenera l'analisi AI
router.post('/rigenera-analisi/:uri', verifyToken, requireAdmin, async (req, res) => {
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
    const analisiLegge = await generaAnalisiLegge(decodedUri, {
              titolo: votazione.titolo,
              descrizione: votazione.descrizione || '',
              camera: 'Parlamento europeo',
              data_votazione: votazione.data_votazione
            });
    
    if (!analisiLegge) {
      // Il testo ufficiale resta disponibile anche quando manca la spiegazione AI.
      return res.status(503).json({
        success: false,
        error: 'Spiegazione AI temporaneamente non disponibile',
        message: 'Non è disponibile un testo documentale sufficiente o è stata raggiunta la quota gratuita. Nessun addebito o dato di voto viene modificato.'
      });
    }

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
    console.error('Errore interno nella rigenerazione AI PE');
    res.status(500).json({
      success: false,
      message: 'Errore nella rigenerazione dell\'analisi',
      error: 'Errore interno'
    });
  }
});

// POST /api/voti-parlamento-europeo/sincronizza - Sincronizza le votazioni dal PE
router.post('/sincronizza', verifyToken, requireAdmin, async (req, res) => {
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
    console.error('Sincronizzazione votazioni PE non riuscita');
    res.status(500).json({
      success: false,
      message: 'Errore nella sincronizzazione',
      error: 'Errore interno'
    });
  }
});

// POST /api/voti-parlamento-europeo/aggiorna-titoli - Aggiorna i titoli delle votazioni esistenti
router.post('/aggiorna-titoli', verifyToken, requireAdmin, async (req, res) => {
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
    console.error('Aggiornamento titoli PE non riuscito');
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiornamento dei titoli',
      error: 'Errore interno'
    });
  }
});

module.exports = router;
