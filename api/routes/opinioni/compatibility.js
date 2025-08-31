const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/opinioni-list - Endpoint per frontend (compatibilità)
router.get('/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const userId = req.userId;
    
    console.log('🔍 GET /api/opinioni/opinioni-list - Richiesta opinioni per grado:', grado);
    console.log('👤 User ID:', userId);
    
    if (!grado) {
      return res.status(400).json({
        success: false,
        error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio'
      });
    }
    
    // Query per ottenere le opinioni del grado specificato
    const opinionQuery = `
      SELECT o.id, o.text, o.gradi_opinione
      FROM opinioni o
      WHERE $1 = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery, [grado]);
    
    if (opinionResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Query per ottenere le risposte dell'utente
    const userQuery = `
      SELECT 
        -- Opinion nazionali
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali
        comunale_cassonetti_intelligenti_con_tessera, comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        comunale_divieto_di_nuovi_fast_food_nel_centro_storico, comunale_estensione_delle_zone_a_traffico_limitato,
        comunale_finanziamento_eventi_culturali_gratuiti, comunale_nuova_biblioteca_comunale,
        comunale_nuove_case_popolari, comunale_nuove_piste_ciclabili, comunale_nuovi_asili_nido_comunali,
        comunale_nuovo_stadio_comunale, comunale_parcheggi_gratuiti_per_residenti,
        comunale_potenziamento_trasporto_pubblico, comunale_riduzione_tasse_rifiuti,
        comunale_sicurezza_strade_scolastiche, comunale_sostegno_commercio_locale,
        comunale_verde_pubblico_e_giardini,
        -- Opinion regionali
        regionale_nuovi_inceneritori, regionale_chiusura_ospedali_di_provincia
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    // Mappa delle opinioni ai campi del database
    const opinionMapping = {
      'energia_nucleare': 'energia_nucleare',
      'sperimentazione_animale': 'sperimentazione_animale',
      'legalizzazione_canapa': 'legalizzazione_canapa',
      'caccia': 'caccia',
      'eutanasia': 'eutanasia',
      'carne_coltivata': 'carne_coltivata',
      'cittadina_animale': 'cittadina_animale',
      'nato': 'nato',
      'matrimonio_gay': 'matrimonio_gay',
      'salario_minimo': 'salario_minimo',
      'case_chiuse': 'case_chiuse',
      'omobitransfobia': 'omobitransfobia',
      'comunale_cassonetti_intelligenti_con_tessera': 'comunale_cassonetti_intelligenti_con_tessera',
      'comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti',
      'comunale_divieto_di_nuovi_fast_food_nel_centro_storico': 'comunale_divieto_di_nuovi_fast_food_nel_centro_storico',
      'comunale_estensione_delle_zone_a_traffico_limitato': 'comunale_estensione_delle_zone_a_traffico_limitato',
      'comunale_finanziamento_eventi_culturali_gratuiti': 'comunale_finanziamento_eventi_culturali_gratuiti',
      'comunale_nuova_biblioteca_comunale': 'comunale_nuova_biblioteca_comunale',
      'comunale_nuove_case_popolari': 'comunale_nuove_case_popolari',
      'comunale_nuove_piste_ciclabili': 'comunale_nuove_piste_ciclabili',
      'comunale_nuovi_asili_nido_comunali': 'comunale_nuovi_asili_nido_comunali',
      'comunale_nuovo_stadio_comunale': 'comunale_nuovo_stadio_comunale',
      'comunale_parcheggi_gratuiti_per_residenti': 'comunale_parcheggi_gratuiti_per_residenti',
      'comunale_potenziamento_trasporto_pubblico': 'comunale_potenziamento_trasporto_pubblico',
      'comunale_riduzione_tasse_rifiuti': 'comunale_riduzione_tasse_rifiuti',
      'comunale_sicurezza_strade_scolastiche': 'comunale_sicurezza_strade_scolastiche',
      'comunale_sostegno_commercio_locale': 'comunale_sostegno_commercio_locale',
      'comunale_verde_pubblico_e_giardini': 'comunale_verde_pubblico_e_giardini',
      'regionale_nuovi_inceneritori': 'regionale_nuovi_inceneritori',
      'regionale_chiusura_ospedali_di_provincia': 'regionale_chiusura_ospedali_di_provincia'
    };
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      const opinionId = opinion.text.toLowerCase().replace(/\s+/g, '_');
      const userAnswer = userAnswers[opinionMapping[opinionId]];
      
      // Converti le risposte del database al formato frontend
      let frontendAnswer = null;
      if (userAnswer === 'Sì') frontendAnswer = 'Favorevole';
      else if (userAnswer === 'No') frontendAnswer = 'Contrario';
      else if (userAnswer === 'Indeciso') frontendAnswer = 'Indeciso';
      else if (userAnswer === null) frontendAnswer = 'Astenuto';
      
      return {
        id: opinionId,
        text: opinion.text,
        grado: opinion.gradi_opinione,
        userAnswer: frontendAnswer
      };
    });
    
    console.log(`✅ Trovate ${formattedOpinions.length} opinioni per grado: ${grado}`);
    
    res.json({
      success: true,
      data: formattedOpinions,
      grado: grado,
      total: formattedOpinions.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

// GET /api/opinioni/proposte - Ottieni opinioni proposte dagli utenti
router.get('/proposte', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/proposte - Richiesta opinioni proposte');
    
    const query = `
      SELECT id, text, user_id, created_at, status
      FROM opinioni_proposte
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni proposte'
    });
  }
});

module.exports = router;
