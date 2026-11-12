const express = require('express');
const { pool } = require('../../middleware/auth');
const { decompressGender } = require('../../utils/genderUtils');
const { decompressUserLocation } = require('../../utils/locationUtils');
const { verifyAccessToken, verifyOAuthPendingToken } = require('../../utils/jwt');
const { decrypt: decryptEmail } = require('../../utils/emailCrypto');
const { getAccountSubject } = require('../../services/accountCapabilitiesService');

const router = express.Router();
const isSchemaMigrationError = (error) => (
  error &&
  (error.code === '42P01' || error.code === '42703')
);

// GET /api/auth/me - Ottieni profilo utente autenticato
router.get('/me', async (req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
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
    // Non stampare token di accesso o loro prefissi nei log.

    // Verifica e decodifica token (access normale o pending OAuth)
    let decoded;
    try {
      decoded = verifyAccessToken(token);
      console.log('✅ Verifica accesso riuscita');
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
           u.id, u.email, u.nome, u.cognome, u.ruolo, u.status, u.is_dpo, u.created_at, u.updated_at,
           COALESCE(uc.political_opinions_consent, u.political_opinions_consent) AS political_opinions_consent,
           COALESCE(uc.political_opinions_consent_timestamp, u.political_opinions_consent_timestamp) AS political_opinions_consent_timestamp,
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
         LEFT JOIN user_consents uc ON uc.user_id = u.id
         WHERE u.id = $1`,
        [decoded.userId]
      );
    } catch (queryError) {
      if (!isSchemaMigrationError(queryError)) {
        throw queryError;
      }

      console.warn('⚠️ Fallback query /auth/me su users (schema nuovo non disponibile):', queryError.message);
      result = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
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
    const accountSubject = await getAccountSubject(pool, user.id);
    // A valid signed access token is not proof that an account is still active.
    // Pending OAuth tokens are handled above; revoked/deactivated real accounts
    // must not receive their profile even during a storage-format migration.
    if (!accountSubject || accountSubject.status !== 'a') {
      return res.status(401).json({
        success: false,
        error: 'Account non attivo',
        message: 'Effettua nuovamente il login'
      });
    }
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
        // Reuse the existing authenticated-session database SELECT to transmit
        // a consent epoch. No new profile endpoint/read is needed.
        // Absence of the column is unknown, not an implicit consent grant.
        political_consent: typeof user.political_opinions_consent === 'boolean'
          ? {
              granted: user.political_opinions_consent,
              timestamp: user.political_opinions_consent_timestamp || null
            }
          : null,
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
        ruolo: accountSubject?.legacyRole || user.ruolo,
        account_type: accountSubject?.capabilities?.accountType || null,
        is_admin: accountSubject?.capabilities?.isAdmin ?? (user.ruolo === 'AD'),
        // Solo indicazione autenticata per la navigazione UI; il backend
        // ricontrolla sempre i permessi DPO su DB ad ogni richiesta sensibile.
        is_dpo: user.status === 'a' && user.is_dpo === true && user.is_admin !== true && !(accountSubject?.capabilities?.isAdmin ?? (user.ruolo === 'AD')),
        is_activist: accountSubject?.capabilities?.isActivist ?? (user.ruolo === 'A'),
        is_candidate: accountSubject?.capabilities?.isCandidate ?? ['C', 'CP'].includes(user.ruolo),
        is_politician: accountSubject?.capabilities?.isPolitician ?? ['P', 'CP'].includes(user.ruolo),
        capabilities: accountSubject?.capabilities || null,
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
