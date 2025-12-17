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
    console.log(`🔍 DEBUG - Prime 5 opinioni trovate:`, opinionResult.rows.slice(0, 5).map(o => ({ text: o.text, gradi: o.gradi_opinione })));
    
    if (opinionResult.rows.length === 0) {
      console.log(`⚠️ Nessuna opinione trovata per il grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Query per ottenere le risposte dell'utente dalla tabella opinioni_risposte
    // Recupera direttamente la riga dell'utente e poi accedi alle colonne per ID
    const userAnswersQuery = `
      SELECT * FROM opinioni_risposte WHERE user_id = $1
    `;
    const userAnswersResult = await pool.query(userAnswersQuery, [userId]);
    
    const userAnswers = {};
    
    if (userAnswersResult.rows.length > 0) {
      // Prendi la prima (e unica) riga dell'utente
      const userRow = userAnswersResult.rows[0];
      const availableColumns = Object.keys(userRow).filter(k => k !== 'user_id' && k !== 'fonti_opinioni');
      
      console.log('🔍 DEBUG - Colonne disponibili in opinioni_risposte:', availableColumns);
      console.log('🔍 DEBUG - Valori nelle colonne:');
      availableColumns.forEach(col => {
        if (userRow[col] !== null && userRow[col] !== undefined && userRow[col] !== '') {
          console.log(`  ${col} = ${userRow[col]}`);
        }
      });
      
      // Per ogni opinione, cerca la risposta nella colonna corrispondente
      opinionResult.rows.forEach(opinion => {
        const opinionId = opinion.id;
        // Prendi il valore dalla colonna corrispondente usando l'ID
        if (userRow.hasOwnProperty(opinionId)) {
          userAnswers[opinionId] = userRow[opinionId];
          console.log(`✅ DEBUG - Risposta trovata per ${opinionId}: ${userRow[opinionId]}`);
        } else {
          // Prova anche con varianti del nome (per gestire errori di ortografia)
          const variants = [
            opinionId.replace('obbligatoria', 'obbliatoria'),
            opinionId.replace('obbliatoria', 'obbligatoria')
          ];
          let found = false;
          for (const variant of variants) {
            if (userRow.hasOwnProperty(variant)) {
              userAnswers[opinionId] = userRow[variant];
              console.log(`✅ DEBUG - Risposta trovata per ${opinionId} (variante ${variant}): ${userRow[variant]}`);
              found = true;
              break;
            }
          }
          if (!found) {
            console.log(`⚠️ DEBUG - Colonna ${opinionId} non trovata in opinioni_risposte`);
            console.log(`⚠️ DEBUG - Colonne simili cercate:`, variants);
            userAnswers[opinionId] = null;
          }
        }
      });
      
      console.log('🔍 DEBUG - User answers caricate:', Object.keys(userAnswers).length);
    } else {
      console.log('⚠️ DEBUG - Nessuna riga trovata in opinioni_risposte per utente:', userId);
    }
    
    console.log('🔍 DEBUG - User answers caricate:', Object.keys(userAnswers).length);
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      const userAnswer = userAnswers[opinion.id]; // Usa l'ID per trovare la risposta
      
      // Restituisci direttamente i valori compressi dal database
      let frontendAnswer = null;
      if (userAnswer === 'f' || userAnswer === 'c' || userAnswer === 'i') {
        frontendAnswer = userAnswer;
      } else if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        frontendAnswer = null;
      }
      
      console.log(`🔍 DEBUG - Formattando opinione: id=${opinion.id}, text="${opinion.text}", userAnswer=${userAnswer}`);
      
      return {
        id: opinion.id, // USA L'ID DIRETTO DAL DATABASE (opinioni_domande.id)
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
