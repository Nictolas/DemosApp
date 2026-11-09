const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getPool } = require('../config/database');
const { generaAnalisiLegge, recuperaAnalisiDaCache } = require('../services/leggeAnalysisService');
const { hasDocumentaryContext } = require('../services/parliamentGroundedAnalysis');

const router = express.Router();
const pool = getPool();

// Legacy aggregate read side only: no ensureTableExists/DDL and no historical
// nominal vote writer. The current single-vote persistence has a separate owner.
async function readRecentEuropeanAggregates(limit) {
  const result = await pool.query(`
    SELECT id, uri, votazione_id, titolo, descrizione, data_votazione, esito,
           sessione_id, sessione_data, sessione_label, favorevoli, contrari,
           astenuti, presenti, votanti, termine_parlamentare, metadati,
           data_sincronizzazione
    FROM parlamento_europeo
    WHERE data_votazione >= (CURRENT_DATE - INTERVAL '120 days')
      AND data_votazione <= CURRENT_DATE
      AND titolo IS NOT NULL AND titolo <> ''
    ORDER BY data_votazione DESC, id DESC
    LIMIT $1
  `, [Math.max(1, Math.min(Number(limit) || 1, 10))]);
  return result.rows;
}
async function readEuropeanAggregateByUri(uri) {
  const result = await pool.query(`
    SELECT id, uri, votazione_id, titolo, descrizione, data_votazione, esito,
           sessione_id, sessione_data, sessione_label, favorevoli, contrari,
           astenuti, presenti, votanti, termine_parlamentare, metadati,
           data_sincronizzazione
    FROM parlamento_europeo
    WHERE uri = $1
      AND data_votazione >= (CURRENT_DATE - INTERVAL '120 days')
      AND data_votazione <= CURRENT_DATE
    LIMIT 1
  `, [uri]);
  return result.rows[0] || null;
}

// GET /api/voti-parlamento-europeo/ultime - Ottieni le ultime N votazioni
router.get('/ultime', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1, 1), 10);
    const forceRefresh = false; // Never trigger historical DB writers from a GET
    
    console.log(`🔍 GET /api/voti-parlamento-europeo/ultime - Richiesta ultime ${limit} votazioni (refresh: ${forceRefresh})`);
    
    // Recupera dal database
    console.log(`📊 Recupero votazioni dal database...`);
    let votazioni = [];
    try {
      votazioni = await readRecentEuropeanAggregates(limit);
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
      message: 'Consultazione temporaneamente non disponibile'
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
    const votazione = await readEuropeanAggregateByUri(decodedUri);
    
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
        analisiLegge = hasDocumentaryContext(votazione.descrizione)
          ? await recuperaAnalisiDaCache(decodedUri)
          : null;
        
        // Nessuna AI generata su GET: lettura della sola cache già validata.
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
      error: 'EP_READ_UNAVAILABLE'
    });
  }
});

// POST /api/voti-parlamento-europeo/rigenera-analisi/:uri - Rigenera l'analisi AI
router.post('/rigenera-analisi/:uri', verifyToken, requireAdmin, async (req, res) => {
  // QA remains opt-in even after this branch is compiled. No automatic AI on GET.
  // Never restore the legacy historical MEP vote importer or per-vote nominal tables.
  if (process.env.DEMOS_GROQ_FREE_QA_ENABLED !== 'true') {
    return res.status(409).json({
      success: false,
      message: 'Analisi Groq Free disattivata: abilitare soltanto nel collaudo autorizzato.'
    });
  }
  try {
    const uri = req.params.uri;
    if (typeof uri !== 'string' || uri.length > 512 || !uri.trim()) {
      return res.status(400).json({ success: false, message: 'Identificativo non valido' });
    }
    const votazione = await readEuropeanAggregateByUri(uri);
    if (!votazione) {
      return res.status(404).json({ success: false, message: 'Votazione non trovata' });
    }
    if (!hasDocumentaryContext(votazione.descrizione)) {
      return res.status(503).json({
        success: false,
        message: 'Testo documentale insufficiente per una spiegazione verificabile.'
      });
    }
    const analisi = await generaAnalisiLegge(uri, {
      titolo: votazione.titolo,
      descrizione: votazione.descrizione,
      camera: 'Parlamento europeo',
      data_votazione: votazione.data_votazione
    });
    if (!analisi) {
      return res.status(503).json({
        success: false,
        message: 'Spiegazione non disponibile: fonte insufficiente o quota Groq Free raggiunta.'
      });
    }
    return res.json({
      success: true,
      data: {
        spiegazione_generale: analisi.spiegazione_generale,
        effetti_positivi: analisi.effetti_positivi,
        effetti_negativi: analisi.effetti_negativi,
        numero_legge: analisi.numero_legge,
        tipo_atto: analisi.tipo_atto,
        provider_ai: analisi.provider_ai,
        modello_ai: analisi.modello_ai,
        data_generazione: analisi.data_generazione
      }
    });
  } catch (_error) {
    console.warn('Analisi Groq Free PE temporaneamente non disponibile');
    return res.status(503).json({
      success: false,
      message: 'Analisi AI temporaneamente non disponibile, dati istituzionali invariati.'
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
