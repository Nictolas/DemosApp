const express = require('express');
const { pool } = require('../../middleware/auth');
const { decompressGender } = require('../../utils/genderUtils');
const { decompressUserLocation } = require('../../utils/locationUtils');
const { verifyAccessToken, verifyOAuthPendingToken } = require('../../utils/jwt');
const { decrypt: decryptEmail } = require('../../utils/emailCrypto');

const router = express.Router();
const isSchemaMigrationError = (error) => (
  error &&
  (error.code === '42P01' || error.code === '42703')
);

// GET /api/auth/me - Ottieni profilo utente autenticato
router.get('/me', async (req, res) => {
  try {
    console.log('🔍 GET /api/auth/me - Richiesta profilo utente (route modulare)');
    
    // Verifica token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token JWT mancante o malformato');
      return res.status(401).json({
        success: false,
        error: 'Token mancante',
        message: 'Token di autenticazione richiesto'
      });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Token ricevuto:', token.substring(0, 20) + '...');

    // Verifica e decodifica token (access normale o pending OAuth)
    let decoded;
    try {
      decoded = verifyAccessToken(token);
      console.log('✅ Token JWT verificato per utente (id):', decoded.userId);
    } catch (accessError) {
      try {
        decoded = verifyOAuthPendingToken(token);
        return res.json({
          success: true,
          user: null,
          pendingRegistration: true,
        });
      } catch (pendingError) {
        console.log('❌ Token JWT non valido:', pendingError.message);
        return res.status(401).json({
          success: false,
          error: 'Token non valido',
          message: 'Token di autenticazione scaduto o non valido'
        });
      }
    }

    // Recupera dati utente
    let result;
    try {
      result = await pool.query(
        `SELECT
           u.id, u.email, u.nome, u.cognome, u.ruolo, u.status, u.created_at, u.updated_at,
           COALESCE(up.genere, u.genere) AS genere,
           COALESCE(up.data_nascita, u.data_nascita) AS data_nascita,
           COALESCE(up.cittadinanza, u.cittadinanza) AS cittadinanza,
           COALESCE(up.paese_residenza, u.paese_residenza) AS paese_residenza,
           COALESCE(up.regione_residenza, u.regione_residenza) AS regione_residenza,
           COALESCE(up.provincia_residenza, u.provincia_residenza) AS provincia_residenza,
           COALESCE(up.comune_residenza, u.comune_residenza) AS comune_residenza,
           COALESCE(up.grado_elezione, u.grado_elezione) AS grado_elezione,
           COALESCE(up.paese_elezione, u.paese_elezione) AS paese_elezione,
           COALESCE(up.regione_elezione, u.regione_elezione) AS regione_elezione,
           COALESCE(up.provincia_elezione, u.provincia_elezione) AS provincia_elezione,
           COALESCE(up.comune_elezione, u.comune_elezione) AS comune_elezione,
           COALESCE(up.grado_candidatura, u.grado_candidatura) AS grado_candidatura,
           COALESCE(up.paese_candidatura, u.paese_candidatura) AS paese_candidatura,
           COALESCE(up.regione_candidatura, u.regione_candidatura) AS regione_candidatura,
           COALESCE(up.provincia_candidatura, u.provincia_candidatura) AS provincia_candidatura,
           COALESCE(up.comune_candidatura, u.comune_candidatura) AS comune_candidatura,
           COALESCE(ur.rappresentante_europeo, u.rappresentante_europeo) AS rappresentante_europeo,
           COALESCE(ur.rappresentante_camera, u.rappresentante_camera) AS rappresentante_camera,
           COALESCE(ur.rappresentante_senato, u.rappresentante_senato) AS rappresentante_senato,
           COALESCE(ur.rappresentante_regionale, u.rappresentante_regionale) AS rappresentante_regionale,
           COALESCE(ur.rappresentante_comune, u.rappresentante_comune) AS rappresentante_comune,
           COALESCE(ur.candidato_europeo, u.candidato_europeo) AS candidato_europeo,
           COALESCE(ur.candidato_camera, u.candidato_camera) AS candidato_camera,
           COALESCE(ur.candidato_senato, u.candidato_senato) AS candidato_senato,
           COALESCE(ur.candidato_regionale, u.candidato_regionale) AS candidato_regionale,
           COALESCE(ur.candidato_comune, u.candidato_comune) AS candidato_comune,
           COALESCE(up.facebook_url, u.facebook_url) AS facebook_url,
           COALESCE(up.twitter_url, u.twitter_url) AS twitter_url,
           COALESCE(up.instagram_url, u.instagram_url) AS instagram_url,
           COALESCE(up.linkedin_url, u.linkedin_url) AS linkedin_url,
           COALESCE(up.telegram_url, u.telegram_url) AS telegram_url,
           COALESCE(up.website_url, u.website_url) AS website_url,
           COALESCE(up.twitch_url, u.twitch_url) AS twitch_url,
           COALESCE(up.youtube_url, u.youtube_url) AS youtube_url
         FROM users u
         LEFT JOIN user_profile up ON up.user_id = u.id
         LEFT JOIN user_representatives ur ON ur.user_id = u.id
         WHERE u.id = $1`,
        [decoded.userId]
      );
    } catch (queryError) {
      if (!isSchemaMigrationError(queryError)) {
        throw queryError;
      }

      console.warn('⚠️ Fallback query /auth/me su users (schema nuovo non disponibile):', queryError.message);
      result = await pool.query(
        `SELECT id, email, nome, cognome, genere, data_nascita, cittadinanza,
                paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
                ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
                grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
                rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
                candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
                status, created_at, updated_at,
                facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url
         FROM users
         WHERE id = $1`,
        [decoded.userId]
      );
    }

    if (result.rows.length === 0) {
      console.log('❌ Utente non trovato nel database');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Utente non trovato nel database'
      });
    }

    const user = result.rows[0];
    const emailDecrypted = decryptEmail(user.email);
    if (user.email != null) user.email = emailDecrypted;
    console.log('✅ Profilo utente recuperato:', emailDecrypted ? '(email presente)' : '(nessuna email)');

    // Formatta la data di nascita per il frontend (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }

    console.log('📤 Invio profilo utente completo');

    res.json({
      success: true,
      user: {
        id: user.id,
        email: emailDecrypted ?? user.email,
        nome: user.nome,
        cognome: user.cognome,
        genere: decompressGender(user.genere),
        data_nascita: dataNascitaFormattata,
        cittadinanza: decompressUserLocation(user).cittadinanza,
        paese_residenza: decompressUserLocation(user).paese_residenza,
        regione_residenza: user.regione_residenza,
        provincia_residenza: user.provincia_residenza,
        comune_residenza: user.comune_residenza,
        ruolo: user.ruolo,
        grado_elezione: user.grado_elezione,
        paese_elezione: user.paese_elezione,
        regione_elezione: user.regione_elezione,
        provincia_elezione: user.provincia_elezione,
        comune_elezione: user.comune_elezione,
        grado_candidatura: user.grado_candidatura,
        paese_candidatura: user.paese_candidatura,
        regione_candidatura: user.regione_candidatura,
        provincia_candidatura: user.provincia_candidatura,
        comune_candidatura: user.comune_candidatura,
        rappresentante_europeo: user.rappresentante_europeo,
        rappresentante_camera: user.rappresentante_camera,
        rappresentante_senato: user.rappresentante_senato,
        rappresentante_regionale: user.rappresentante_regionale,
        rappresentante_comune: user.rappresentante_comune,
        candidato_europeo: user.candidato_europeo,
        candidato_camera: user.candidato_camera,
        candidato_senato: user.candidato_senato,
        candidato_regionale: user.candidato_regionale,
        candidato_comune: user.candidato_comune,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('💥 Errore durante il recupero profilo:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare il profilo utente',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
