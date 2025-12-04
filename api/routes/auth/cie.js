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
  // Verifica se le variabili OIDC reali sono configurate
  const issuerUrl = process.env.CIE_ISSUER_URL || process.env.OIDC_ISSUER_URL;
  const clientId = process.env.CIE_CLIENT_ID || process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.CIE_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.CIE_REDIRECT_URI || process.env.OIDC_REDIRECT_URI;

  // Se tutte le variabili sono configurate, usa la configurazione reale
  if (issuerUrl && clientId && clientSecret && redirectUri) {
    return {
      issuerUrl: issuerUrl.replace(/\/$/, ''), // Rimuovi trailing slash
      clientId,
      clientSecret,
      redirectUri
    };
  }

  // Altrimenti, usa il mock server come fallback
  console.warn('⚠️ Configurazione OIDC non trovata. Usando mock server come fallback.');
  
  // Determina l'URL base del server per l'issuer
  let baseUrl;
  if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_CIE === 'true') {
    // In development, usa localhost
    const port = process.env.PORT || 3001;
    baseUrl = `http://localhost:${port}`;
  } else {
    // In produzione, usa l'URL del backend Render
    baseUrl = process.env.BACKEND_URL || 
              process.env.RENDER_EXTERNAL_URL || 
              'https://demos-c7k0.onrender.com';
  }
  
  // Il redirectUri deve puntare al FRONTEND, non al backend
  // Questo evita problemi con Google Safe Browsing che blocca redirect a Render
  let frontendUrl;
  if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_CIE === 'true') {
    frontendUrl = 'http://localhost:3000';
  } else {
    frontendUrl = process.env.FRONTEND_URL || 'https://www.demos.community';
  }
  
  return {
    issuerUrl: `${baseUrl}/api/auth/mock-cie`,
    clientId: process.env.CIE_CLIENT_ID || 'mock-client-id',
    clientSecret: process.env.CIE_CLIENT_SECRET || 'mock-client-secret',
    redirectUri: process.env.CIE_REDIRECT_URI || `${frontendUrl}/auth/cie/callback`
  };
};

// Funzioni per gestire OIDC state nel database (necessario per istanze multiple su Render)
const saveOIDCState = async (state, codeVerifier, expiresAt) => {
  try {
    const expiresAtDate = new Date(expiresAt);
    console.log('💾 saveOIDCState: Salvando state:', state.substring(0, 16) + '...', 'expires_at:', expiresAtDate.toISOString());
    const result = await pool.query(
      `INSERT INTO oidc_states (state, code_verifier, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state) DO UPDATE SET
         code_verifier = EXCLUDED.code_verifier,
         expires_at = EXCLUDED.expires_at`,
      [state, codeVerifier, expiresAtDate]
    );
    console.log('✅ OIDC State salvato nel database:', state.substring(0, 8) + '...', 'rowCount:', result.rowCount);
    
    // Verifica che sia stato salvato correttamente
    const verify = await pool.query(
      `SELECT state, expires_at FROM oidc_states WHERE state = $1`,
      [state]
    );
    if (verify.rows.length > 0) {
      console.log('✅ saveOIDCState: Verifica - state salvato correttamente, expires_at:', verify.rows[0].expires_at);
    } else {
      console.error('❌ saveOIDCState: ERRORE - state non trovato dopo il salvataggio!');
    }
  } catch (error) {
    console.error('❌ Errore salvataggio OIDC state:', error);
    throw error;
  }
};

const getOIDCState = async (state) => {
  try {
    console.log('🔍 getOIDCState: Cercando state:', state.substring(0, 16) + '...');
    const result = await pool.query(
      `SELECT code_verifier, expires_at, created_at
       FROM oidc_states
       WHERE state = $1 AND expires_at > NOW()`,
      [state]
    );
    
    console.log('🔍 getOIDCState: Risultati query:', result.rows.length);
    
    if (result.rows.length === 0) {
      // Verifica se lo state esiste ma è scaduto
      const expiredCheck = await pool.query(
        `SELECT expires_at FROM oidc_states WHERE state = $1`,
        [state]
      );
      if (expiredCheck.rows.length > 0) {
        console.warn('⚠️ getOIDCState: State trovato ma scaduto. Expires_at:', expiredCheck.rows[0].expires_at);
      } else {
        console.warn('⚠️ getOIDCState: State non trovato nel database');
      }
      return null;
    }
    
    console.log('✅ getOIDCState: State trovato, expires_at:', result.rows[0].expires_at);
    return {
      codeVerifier: result.rows[0].code_verifier,
      expiresAt: new Date(result.rows[0].expires_at).getTime()
    };
  } catch (error) {
    console.error('❌ Errore recupero OIDC state:', error);
    return null;
  }
};

const deleteOIDCState = async (state) => {
  try {
    await pool.query('DELETE FROM oidc_states WHERE state = $1', [state]);
  } catch (error) {
    console.error('❌ Errore eliminazione OIDC state:', error);
    // Non lanciare errore, è solo pulizia
  }
};

// Fallback: Map in-memory per sviluppo locale (se la tabella non esiste)
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

    // Salva state e code_verifier nel database
    const expiresAt = Date.now() + 600000; // 10 minuti
    try {
      await saveOIDCState(state, codeVerifier, expiresAt);
    } catch (error) {
      // Fallback alla Map se il database fallisce (sviluppo locale)
      console.warn('⚠️ Fallback a Map in-memory per OIDC state');
      oidcStateStore.set(state, {
        codeVerifier,
        expiresAt
      });
    }

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
 * POST /cie/exchange
 * Scambia l'authorization code con i token di accesso
 * Questo endpoint viene chiamato dal frontend dopo aver ricevuto code e state dall'Identity Provider
 */
router.post('/exchange', async (req, res) => {
  try {
    const { code, state } = req.body;

    // Verifica parametri obbligatori
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Parametri code e state obbligatori'
      });
    }

    console.log('🔍 CIE Exchange: Verifica state:', state.substring(0, 16) + '...');
    
    // Verifica state (CSRF protection) dal database
    let stateData = await getOIDCState(state);
    
    // Fallback alla Map se non trovato nel database (sviluppo locale)
    if (!stateData) {
      console.log('⚠️ CIE Exchange: State non trovato nel database, provo Map...');
      stateData = oidcStateStore.get(state);
      if (stateData) {
        console.log('⚠️ OIDC State trovato nella Map (fallback)');
      } else {
        console.log('❌ CIE Exchange: State non trovato né nel database né nella Map');
      }
    } else {
      console.log('✅ CIE Exchange: State trovato nel database');
    }
    
    if (!stateData) {
      console.error('❌ OIDC State non trovato:', state.substring(0, 8) + '...');
      return res.status(400).json({
        success: false,
        error: 'invalid_state',
        message: 'State non valido o scaduto'
      });
    }

    // Verifica scadenza state
    if (Date.now() > stateData.expiresAt) {
      await deleteOIDCState(state);
      oidcStateStore.delete(state); // Fallback
      return res.status(400).json({
        success: false,
        error: 'expired_state',
        message: 'State scaduto'
      });
    }

    // Rimuovi state (one-time use) dal database
    await deleteOIDCState(state);
    oidcStateStore.delete(state); // Fallback

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

    console.log('🔐 CIE Exchange: Dati utente ricevuti', {
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

        console.log('✅ CIE Exchange: Utente esistente trovato', user.id);
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
        console.log('✅ CIE Exchange: Nuovo utente creato', user.id);
      }
    } catch (dbError) {
      console.error('❌ Errore database durante exchange CIE:', dbError);
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

    // Restituisci i token come JSON
    console.log('✅ CIE Exchange: Completato con successo per utente', user.id);
    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        ruolo: user.ruolo
      }
    });

  } catch (error) {
    console.error('❌ Errore exchange CIE:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error.message || 'Errore interno durante l\'autenticazione CIE'
    });
  }
});

/**
 * GET /cie/callback
 * DEPRECATO: Questo endpoint non viene più usato direttamente
 * Il callback OIDC ora punta al frontend, che chiama /exchange
 * Mantenuto per compatibilità
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

    // Verifica state (CSRF protection) dal database
    let stateData = await getOIDCState(state);
    
    // Fallback alla Map se non trovato nel database (sviluppo locale)
    if (!stateData) {
      stateData = oidcStateStore.get(state);
      if (stateData) {
        console.log('⚠️ OIDC State trovato nella Map (fallback)');
      }
    }
    
    if (!stateData) {
      console.error('❌ OIDC State non trovato:', state.substring(0, 8) + '...');
      return res.status(400).json({
        success: false,
        error: 'invalid_state',
        message: 'State non valido o scaduto'
      });
    }

    // Verifica scadenza state
    if (Date.now() > stateData.expiresAt) {
      await deleteOIDCState(state);
      oidcStateStore.delete(state); // Fallback
      return res.status(400).json({
        success: false,
        error: 'expired_state',
        message: 'State scaduto'
      });
    }

    // Rimuovi state (one-time use) dal database
    await deleteOIDCState(state);
    oidcStateStore.delete(state); // Fallback

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

    // Restituisci i token come JSON invece di fare redirect
    // Il frontend gestirà il salvataggio e il redirect
    console.log('✅ CIE Login: Completato con successo per utente', user.id);
    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        ruolo: user.ruolo
      }
    });

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

