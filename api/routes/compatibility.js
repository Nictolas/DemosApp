const express = require('express');

const { getOpinionsForGrade, sortOpinionsByText, getOpinionCatalogRevision } = require('../services/opinionCatalog');
const { normalizeOpinionScope } = require('../services/politicalJurisdictionRegistryService');

const router = express.Router();

// Public, metadata-only release revision. Never returns political answers,
// does not query the users database and must not log personal data.
// A verified session is independently required before decrypting local answers.
router.get('/opinioni-catalog-revision', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  return res.json({ success: true, revision: getOpinionCatalogRevision() });
});

// Endpoint diretto per opinioni-list (compatibilità frontend)
const isDev = process.env.NODE_ENV !== 'production';

router.get('/opinioni-list', async (req, res) => {
  // Personalized political answers: forbid browser/edge storage, including errors.
  res.set('Cache-Control', 'private, no-store, max-age=0');
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
      console.error('Errore verifica JWT nelle Opinioni');
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

    // Select ONLY the published opinion columns for this electoral grade.
    // This avoids transferring all 94 answers or the fonti_opinioni JSONB
    // service field while preserving the existing single SQL round trip.
    const { grado } = req.query;
    const normalizedGrade = grado ? (normalizeOpinionScope(String(grado)) || String(grado)) : '';
    const opinionResult = { rows: sortOpinionsByText(getOpinionsForGrade(normalizedGrade)) };
    // opinionCatalog.js enforces stable, safe [a-z0-9_] identifiers at load time.
    const projection = opinionResult.rows.map(op => `a."${op.id}"`).join(', ');
    const userSql = projection
      ? `SELECT u.id, u.status, u.ruolo, row_to_json(selected) AS opinion_answers
         FROM users u
         LEFT JOIN LATERAL (
           SELECT ${projection}
           FROM opinioni_risposte a
           WHERE a.user_id = u.id
         ) selected ON true
         WHERE u.id = $1`
      : `SELECT u.id, u.status, u.ruolo, NULL::json AS opinion_answers
         FROM users u WHERE u.id = $1`;
    const userResult = await pool.query(userSql, [userIdFromToken]);
    
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
    
    if (isDev) console.log('🔍 GET /api/opinioni-list - grado:', grado);

    if (!grado) {
      return res.status(400).json({
        success: false,
        error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio'
      });
    }
    
    const gradiColumn = 'gradi_opinione';

    if (opinionResult.rows.length === 0) {
      if (isDev) console.log(`⚠️ Nessuna opinione per grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Answers already arrived with the account status (including null
    // for a newly registered user who has no response row yet).
    const userAnswers = {};
    const userRow = user.opinion_answers;
    if (userRow && typeof userRow === 'object' && !Array.isArray(userRow)) {
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
    console.error('Errore interno endpoint Opinioni');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta opinioni'
    });
  }
});

// Endpoint per opinioni-proposte rimosso - gestito da opinioniProposteRoutes dedicato

module.exports = router;
