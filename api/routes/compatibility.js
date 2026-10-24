const express = require('express');

const router = express.Router();

// Endpoint diretto per opinioni-list (compatibilità frontend)
const isDev = process.env.NODE_ENV !== 'production';

router.get('/opinioni-list', async (req, res) => {
  // This endpoint returns account-specific political answers. Never let HTTP
  // caches retain them, including error/empty responses and legacy clients.
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.vary('Authorization');
  // Older versions could have stored an ETag. Force a fresh 200 response
  // instead of revalidating that old personalized body with HTTP 304.
  // This cannot erase a response already stored by a client or intermediary.
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  try {
    if (isDev) {
      console.log('🔍 GET /api/opinioni-list - Richiesta diretta');
    }
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
    // Nel nuovo modello esiste solo l'ID utente (passkey o login classico), le email non sono più usate.
    const userIdFromToken = decoded.userId || decoded.sub || decoded.id;
    if (!userIdFromToken) {
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Effettua nuovamente il login'
      });
    }

    // La colonna email può non esistere più nella tabella users: qui servono solo id/status/ruolo
    const userResult = await pool.query(
      'SELECT id, status, ruolo FROM users WHERE id = $1',
      [userIdFromToken]
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
    
    if (isDev) console.log('🔍 GET /api/opinioni-list - grado:', grado);

    if (!grado) {
      return res.status(400).json({
        success: false,
        error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio'
      });
    }
    
    // Query per ottenere le opinioni del grado specificato
    // Supporto sia gradi_opinione che gradi_opinioni (il DB può avere l'uno o l'altro)
    const opinionQuery = (colGradi) => `
      SELECT o.id, o.text, o.${colGradi}
      FROM opinioni_domande o
      WHERE $1 = ANY(o.${colGradi})
      ORDER BY o.text
    `;
    let opinionResult;
    let gradiColumn = 'gradi_opinione';
    try {
      opinionResult = await pool.query(opinionQuery(gradiColumn), [grado]);
    } catch (err) {
      if (err.code === '42703' && err.message && err.message.includes('gradi_opinione')) {
        gradiColumn = 'gradi_opinioni';
        opinionResult = await pool.query(opinionQuery(gradiColumn), [grado]);
      } else {
        throw err;
      }
    }

    if (opinionResult.rows.length === 0) {
      if (isDev) console.log(`⚠️ Nessuna opinione per grado: ${grado}`);
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
      const userRow = userAnswersResult.rows[0];
      opinionResult.rows.forEach(opinion => {
        const opinionId = opinion.id;
        if (userRow.hasOwnProperty(opinionId)) {
          userAnswers[opinionId] = userRow[opinionId];
        } else {
          const variants = [
            opinionId.replace('obbligatoria', 'obbliatoria'),
            opinionId.replace('obbliatoria', 'obbligatoria')
          ];
          let found = false;
          for (const variant of variants) {
            if (userRow.hasOwnProperty(variant)) {
              userAnswers[opinionId] = userRow[variant];
              found = true;
              break;
            }
          }
          if (!found) userAnswers[opinionId] = null;
        }
      });
    }

    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      const userAnswer = userAnswers[opinion.id];
      let frontendAnswer = null;
      if (userAnswer === 'f' || userAnswer === 'c' || userAnswer === 'i') {
        frontendAnswer = userAnswer;
      } else if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        frontendAnswer = null;
      }
      return {
        id: opinion.id, // USA L'ID DIRETTO DAL DATABASE (opinioni_domande.id)
        text: opinion.text,
        grado: opinion[gradiColumn] || opinion.gradi_opinione || opinion.gradi_opinioni,
        userAnswer: frontendAnswer
      };
    });

    if (isDev) console.log(`✅ opinioni-list grado=${grado} count=${formattedOpinions.length}`);

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
