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
    
    console.log(`🔍 DEBUG - Query per grado ${grado}:`, opinionQuery);
    console.log(`🔍 DEBUG - Parametri query:`, [grado]);
    console.log(`🔍 DEBUG - Risultati trovati:`, opinionResult.rows.length);
    console.log(`🔍 DEBUG - Prime 3 opinioni:`, opinionResult.rows.slice(0, 3).map(o => ({ text: o.text, gradi: o.gradi_opinione })));
    
    if (opinionResult.rows.length === 0) {
      console.log(`⚠️ Nessuna opinione trovata per il grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Query per ottenere le risposte dell'utente - SOLO COLONNE ESISTENTI
    const userQuery = `
      SELECT 
        -- Opinion nazionali/europee
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali (senza prefissi)
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale,
        nuove_case_popolari, nuove_piste_ciclabili, nuovi_asili_nido_comunali,
        nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti,
        sicurezza_strade_scolastiche, sostegno_commercio_locale,
        verde_pubblico_e_giardini,
        -- Opinion regionali (senza prefissi)
        nuovi_inceneritori, chiusura_ospedali_di_provincia,
        -- Opinion nazionali/comunali (senza prefissi)
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici,
        riduzione_parcheggi_a_pagamento
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    // Mappa delle opinioni ai campi del database - SENZA PREFISSI
    const opinionMapping = {
      // Opinion nazionali/europee/regionali/comunali (stesse colonne, senza prefissi)
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
      
      // Opinion regionali/comunali (senza prefissi)
      'nuovi_inceneritori': 'nuovi_inceneritori',
      'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
      
      // Opinion comunali (senza prefissi)
      'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
      'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
      'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
      'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
      'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
      
      // Opinion nazionali/comunali (senza prefissi)
      'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
      'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
      'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
      'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
      'nuove_case_popolari': 'nuove_case_popolari',
      'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
      'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
      'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
      'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
      
      // Colonne extra (senza prefissi) - SOLO COLONNE ESISTENTI
      'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
      'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
      'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
      'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
      'sostegno_commercio_locale': 'sostegno_commercio_locale',
      'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
    };
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      const opinionId = opinion.id; // Usa l'ID corretto dalla tabella opinioni
      const userAnswer = userAnswers[opinionMapping[opinionId]];
      
      console.log(`🔍 DEBUG - Mappatura opinione:`, {
        text: opinion.text,
        opinionId: opinionId,
        mappedField: opinionMapping[opinionId],
        userAnswer: userAnswer
      });
      
      // Converti le risposte del database al formato frontend
      let frontendAnswer = null;
      if (userAnswer === 'Sì') frontendAnswer = 'Favorevole';
      else if (userAnswer === 'No') frontendAnswer = 'Contrario';
      else if (userAnswer === 'Indeciso') frontendAnswer = 'Indeciso';
      else if (userAnswer === 'Contrario') frontendAnswer = 'Contrario'; // Aggiunto per compatibilità
      else if (userAnswer === 'Favorevole') frontendAnswer = 'Favorevole'; // Aggiunto per compatibilità
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

// GET /api/opinioni/proposte - Ottieni tutte le opinioni (per gestione)
router.get('/proposte', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/proposte - Richiesta opinioni per gestione');
    
    const query = `
      SELECT id, text, gradi_opinione, created_at, updated_at
      FROM opinioni
      ORDER BY text
    `;
    
    const result = await pool.query(query);
    
    console.log(`✅ Trovate ${result.rows.length} opinioni per gestione`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

module.exports = router;
