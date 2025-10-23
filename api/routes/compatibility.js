const express = require('express');

const router = express.Router();

// Endpoint diretto per opinioni-list (compatibilità frontend)
router.get('/opinioni-list', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-list - Richiesta diretta (compatibilità frontend)');
    console.log('🔑 Headers ricevuti:', req.headers);
    console.log('🔍 Query params:', req.query);
    
    // Implementa direttamente la logica invece di reindirizzare
    const { pool } = require('../middleware/auth');
    
    // Verifica manualmente il token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token di accesso richiesto'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Decodifica il token per ottenere l'ID utente
    const { verifyAccessToken } = require('../utils/jwt');
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (jwtError) {
      console.error('❌ Errore verifica JWT:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Effettua nuovamente il login'
      });
    }
    
    // Verifica che l'utente esista e sia attivo
    const userResult = await pool.query(
      'SELECT id, email, status, ruolo FROM users WHERE id = $1 OR email = $2',
      [decoded.userId || decoded.email, decoded.email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Effettua nuovamente il login'
      });
    }
    
    const user = userResult.rows[0];
    
    if (user.status !== 'a') {
      return res.status(401).json({
        success: false,
        error: 'Account non attivo',
        message: `Il tuo account ha status "${user.status}". Contatta l'amministratore per l'attivazione.`
      });
    }
    
    const { grado } = req.query;
    const userId = user.id;
    
    console.log('🔍 GET /api/opinioni-list - Richiesta opinioni per grado:', grado);
    console.log('👤 User ID:', userId);
    console.log('🔍 DEBUG - Inizio query opinioni...');
    
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
      FROM opinioni_domande o
      WHERE $1 = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery, [grado]);
    
    console.log(`🔍 DEBUG - Query per grado ${grado}:`, opinionQuery);
    console.log(`🔍 DEBUG - Parametri query:`, [grado]);
    console.log(`🔍 DEBUG - Risultati trovati:`, opinionResult.rows.length);
    
    if (opinionResult.rows.length === 0) {
      console.log(`⚠️ Nessuna opinione trovata per il grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Query per ottenere le risposte dell'utente dalla tabella opinioni_risposte
    const userQuery = `
      SELECT o.text, orr.energia_nucleare, orr.sperimentazione_animale, orr.legalizzazione_canapa, orr.caccia, orr.eutanasia,
             orr.carne_coltivata, orr.nato, orr.matrimonio_gay, orr.salario_minimo, orr.case_chiuse, orr.omobitransfobia,
             orr.cassonetti_intelligenti_con_tessera, orr.concessione_spazi_pubblici_a_centri_sociali_autogestiti,
             orr.divieto_di_nuovi_fast_food_nel_centro_storico, orr.estensione_delle_zone_a_traffico_limitato,
             orr.finanziamento_eventi_culturali_gratuiti, orr.nuova_biblioteca_comunale,
             orr.nuove_case_popolari, orr.nuove_piste_ciclabili, orr.nuovi_asili_nido_comunali,
             orr.nuovo_stadio_comunale, orr.parcheggi_gratuiti_per_residenti,
             orr.potenziamento_trasporto_pubblico, orr.riduzione_tasse_rifiuti,
             orr.sicurezza_strade_scolastiche, orr.sostegno_commercio_locale,
             orr.verde_pubblico_e_giardini, orr.nuovi_inceneritori, orr.chiusura_ospedali_di_provincia,
             orr.raccolta_rifiuti_porta_a_porta, orr.riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
             orr.sussidi_comunali_per_famiglie_numerose, orr.videosorveglianza_in_spazi_pubblici,
             orr.riduzione_parcheggi_a_pagamento
      FROM opinioni_domande o
      LEFT JOIN opinioni_risposte orr ON orr.user_id = $1
      WHERE $2 = ANY(o.gradi_opinione)
    `;
    
    const userAnswersResult = await pool.query(userQuery, [userId, grado]);
    const userAnswers = {};
    userAnswersResult.rows.forEach(row => {
      const opinionKey = row.text.replace(/\s+/g, '_').toLowerCase();
      // Mappa la risposta dalla colonna corrispondente in opinioni_risposte
      const opinionField = opinionKey.replace(/\s+/g, '_').toLowerCase();
      userAnswers[opinionKey] = row[opinionField];
    });
    
    console.log('🔍 DEBUG - User answers caricate:', Object.keys(userAnswers).length);
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      const opinionKey = opinion.text.replace(/\s+/g, '_').toLowerCase();
      const userAnswer = userAnswers[opinionKey]; // Usa la chiave dell'opinione
      
      // Restituisci direttamente i valori compressi dal database
      let frontendAnswer = null;
      if (userAnswer === 'f' || userAnswer === 'c' || userAnswer === 'i') {
        frontendAnswer = userAnswer;
      } else if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        frontendAnswer = null;
      }
      
      return {
        id: opinionKey,
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
    console.error('💥 Errore endpoint diretto opinioni-list:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta opinioni'
    });
  }
});

// Endpoint per opinioni-proposte rimosso - gestito da opinioniProposteRoutes dedicato

module.exports = router;
