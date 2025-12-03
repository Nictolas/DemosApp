/**
 * 🔐 Controller Autenticazione CIE (Carta d'Identità Elettronica)
 * 
 * Implementa il flusso OIDC Authorization Code Flow per l'autenticazione tramite CIE.
 * 
 * Endpoints:
 * - GET /cie/login - Inizia il flusso OIDC
 * - GET /cie/callback - Gestisce la callback dall'Identity Provider
 */

const express = require('express');
// Usa fetch nativo di Node.js (disponibile da Node 18+)
// Node.js su Render dovrebbe essere >= 18, quindi fetch è disponibile nativamente
// Verifica che fetch sia disponibile
if (typeof globalThis.fetch === 'undefined' && typeof fetch === 'undefined') {
  throw new Error('fetch non disponibile. Node.js 18+ richiesto per fetch nativo.');
}
// Usa fetch nativo (disponibile globalmente in Node.js 18+)
const fetchFunction = globalThis.fetch || fetch;

const { getPool } = require('../../config/database');
const { generateTokenPair } = require('../../utils/jwt');
const crypto = require('crypto');

const router = express.Router();
const pool = getPool();

// Configurazione OIDC da variabili d'ambiente
const getOIDCConfig = () => {
  const issuerUrl = process.env.CIE_ISSUER_URL || process.env.OIDC_ISSUER_URL;
  const clientId = process.env.CIE_CLIENT_ID || process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.CIE_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.CIE_REDIRECT_URI || process.env.OIDC_REDIRECT_URI;

  if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Configurazione OIDC incompleta. Verifica le variabili d\'ambiente.');
  }

  return {
    issuerUrl: issuerUrl.replace(/\/$/, ''), // Rimuovi trailing slash
    clientId,
    clientSecret,
    redirectUri
  };
};

// Store temporaneo per state e PKCE (in produzione usare Redis)
const oidcStateStore = new Map();

/**
 * GET /cie/login
 * Inizia il flusso OIDC reindirizzando all'Identity Provider
 * Supporta sia redirect diretto che risposta JSON con URL (per evitare problemi con Safe Browsing)
 */
router.get('/login', async (req, res) => {
  try {
    const config = getOIDCConfig();
    
    // Genera state per CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Genera code_verifier e code_challenge per PKCE (opzionale ma raccomandato)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Salva state e code_verifier
    oidcStateStore.set(state, {
      codeVerifier,
      expiresAt: Date.now() + 600000 // 10 minuti
    });

    // Costruisci URL di autorizzazione
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: 'openid profile',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${config.issuerUrl}/authorize?${authParams.toString()}`;

    // Se la richiesta accetta JSON (es. da frontend), restituisci l'URL invece di fare redirect
    const acceptHeader = req.headers.accept || '';
    const isJsonRequest = acceptHeader.includes('application/json') || req.query.format === 'json';
    
    console.log('🔐 CIE Login: Richiesta ricevuta', {
      acceptHeader,
      format: req.query.format,
      isJsonRequest,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    });
    
    if (isJsonRequest) {
      console.log('🔐 CIE Login: Restituzione URL per redirect dal frontend');
      console.log('🔐 CIE Login: Redirect URL generato:', authUrl);
      return res.json({
        success: true,
        redirectUrl: authUrl,
        message: 'Reindirizza al seguente URL per completare il login CIE'
      });
    }

    // Altrimenti, redirect diretto (per compatibilità con link diretti)
    console.log('🔐 CIE Login: Redirect a Identity Provider');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ Errore inizio flusso CIE:', error);
    
    // Assicurati di restituire sempre JSON se la richiesta lo richiede
    const acceptHeader = req.headers.accept || '';
    const isJsonRequest = acceptHeader.includes('application/json') || req.query.format === 'json';
    
    if (isJsonRequest) {
      return res.status(500).json({
        success: false,
        error: 'Errore durante l\'avvio del login CIE',
        message: error.message
      });
    }
    
    // Altrimenti, risposta standard (potrebbe essere HTML in caso di errori middleware)
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'avvio del login CIE',
      message: error.message
    });
  }
});

/**
 * GET /cie/callback
 * Gestisce la callback dall'Identity Provider dopo l'autenticazione
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Verifica errori dall'Identity Provider
    if (error) {
      console.error('❌ Errore da Identity Provider:', error, error_description);
      return res.status(400).json({
        success: false,
        error: error,
        message: error_description || 'Errore durante l\'autenticazione CIE'
      });
    }

    // Verifica parametri obbligatori
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Parametri mancanti nella callback'
      });
    }

    // Verifica state (CSRF protection)
    const stateData = oidcStateStore.get(state);
    if (!stateData) {
      return res.status(400).json({
        success: false,
        error: 'invalid_state',
        message: 'State non valido o scaduto'
      });
    }

    // Rimuovi state (one-time use)
    oidcStateStore.delete(state);

    // Verifica scadenza state
    if (Date.now() > stateData.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'expired_state',
        message: 'State scaduto'
      });
    }

    const config = getOIDCConfig();

    // Scambia authorization code con access token
    let tokenResponse;
    try {
      const tokenUrl = `${config.issuerUrl}/token`;
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: stateData.codeVerifier
      });

      const response = await fetchFunction(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenParams.toString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || `HTTP ${response.status}`);
      }

      tokenResponse = { data: await response.json() };
    } catch (tokenError) {
      console.error('❌ Errore scambio token:', tokenError.message);
      return res.status(500).json({
        success: false,
        error: 'token_exchange_failed',
        message: 'Errore durante lo scambio del token'
      });
    }

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return res.status(500).json({
        success: false,
        error: 'no_access_token',
        message: 'Token di accesso non ricevuto'
      });
    }

    // Ottieni informazioni utente
    let userInfo;
    try {
      const userInfoUrl = `${config.issuerUrl}/userinfo`;
      const userInfoResponse = await fetchFunction(userInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.json().catch(() => ({}));
        throw new Error(errorData.error_description || `HTTP ${userInfoResponse.status}`);
      }

      userInfo = await userInfoResponse.json();
    } catch (userInfoError) {
      console.error('❌ Errore recupero userinfo:', userInfoError.message);
      return res.status(500).json({
        success: false,
        error: 'userinfo_failed',
        message: 'Errore durante il recupero delle informazioni utente'
      });
    }

    // Estrai fiscal_number (può essere in fiscal_number o in altri campi)
    const fiscalNumber = userInfo.fiscal_number || 
                        userInfo.tax_id || 
                        userInfo.codice_fiscale ||
                        userInfo.sub; // Fallback a sub se non disponibile

    if (!fiscalNumber) {
      return res.status(400).json({
        success: false,
        error: 'no_fiscal_number',
        message: 'Numero fiscale non trovato nei dati utente'
      });
    }

    // Normalizza fiscal_number (rimuovi prefisso TINIT- se presente)
    const normalizedFiscalNumber = fiscalNumber.replace(/^TINIT-/, '');

    console.log('🔐 CIE Callback: Dati utente ricevuti', {
      sub: userInfo.sub,
      fiscal_number: normalizedFiscalNumber,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name
    });

    // Cerca o crea utente nel database
    let user;
    try {
      // Cerca utente esistente per fiscal_number
      const userQuery = await pool.query(
        `SELECT id, email, nome, cognome, ruolo, status, fiscal_number, created_at
         FROM users 
         WHERE fiscal_number = $1 OR fiscal_number = $2`,
        [fiscalNumber, normalizedFiscalNumber]
      );

      if (userQuery.rows.length > 0) {
        // Utente esistente - aggiorna dati se necessario
        user = userQuery.rows[0];
        
        // Aggiorna ultimo login
        await pool.query(
          `UPDATE users 
           SET updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [user.id]
        );

        console.log('✅ CIE Login: Utente esistente trovato', user.id);
      } else {
        // Nuovo utente - crea record
        const userId = crypto.randomUUID();
        const email = userInfo.email || `${normalizedFiscalNumber}@cie.local`; // Email fittizia se non disponibile
        
        await pool.query(
          `INSERT INTO users (
            id, email, nome, cognome, fiscal_number, 
            status, auth_method, verified, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            userId,
            email,
            userInfo.given_name || 'Utente',
            userInfo.family_name || 'CIE',
            normalizedFiscalNumber,
            'a', // Status attivo
            'cie', // Metodo autenticazione
            true // Verificato tramite CIE
          ]
        );

        // Recupera utente appena creato
        const newUserQuery = await pool.query(
          `SELECT id, email, nome, cognome, ruolo, status, fiscal_number, created_at
           FROM users 
           WHERE id = $1`,
          [userId]
        );

        user = newUserQuery.rows[0];
        console.log('✅ CIE Login: Nuovo utente creato', user.id);
      }
    } catch (dbError) {
      console.error('❌ Errore database durante login CIE:', dbError);
      return res.status(500).json({
        success: false,
        error: 'database_error',
        message: 'Errore durante la gestione dell\'utente nel database'
      });
    }

    // Verifica che l'utente sia attivo
    if (user.status !== 'a' && user.status !== 'A') {
      return res.status(403).json({
        success: false,
        error: 'account_inactive',
        message: 'Il tuo account non è attivo. Contatta l\'amministratore.'
      });
    }

    // Genera token JWT per la sessione
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.ruolo || 'user',
      nome: user.nome,
      cognome: user.cognome,
      authMethod: 'cie'
    };

    const tokens = generateTokenPair(tokenPayload);

    // Redirect al frontend con token (o restituisci JSON)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/auth/cie/callback`);
    redirectUrl.searchParams.set('accessToken', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    redirectUrl.searchParams.set('success', 'true');

    console.log('✅ CIE Login: Completato con successo per utente', user.id);
    res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('❌ Errore callback CIE:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error.message || 'Errore interno durante l\'autenticazione CIE'
    });
  }
});

/**
 * GET /cie/status
 * Endpoint per verificare lo stato della configurazione CIE
 */
router.get('/status', (req, res) => {
  try {
    const config = getOIDCConfig();
    const isMock = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_CIE === 'true';
    
    res.json({
      success: true,
      configured: true,
      mock: isMock,
      issuer: config.issuerUrl,
      hasClientId: !!config.clientId,
      hasClientSecret: !!config.clientSecret,
      hasRedirectUri: !!config.redirectUri
    });
  } catch (error) {
    res.json({
      success: false,
      configured: false,
      error: error.message
    });
  }
});

module.exports = router;

