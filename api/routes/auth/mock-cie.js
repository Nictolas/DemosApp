/**
 * 🧪 Mock Server OIDC per CIE
 * 
 * Questo server simula un Identity Provider OIDC standard per lo sviluppo.
 * Viene attivato SOLO se NODE_ENV === 'development' o USE_MOCK_CIE === 'true'
 * 
 * Endpoints:
 * - GET /mock-cie/authorize - Pagina di autorizzazione mock
 * - POST /mock-cie/token - Genera access_token finto
 * - GET /mock-cie/userinfo - Restituisce dati utente mock
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Verifica se il mock server deve essere attivo
// È sempre attivo se siamo qui (il router lo abilita solo quando necessario)
const isMockEnabled = () => {
  return true; // Sempre abilitato se il router lo ha registrato
};

// Middleware per verificare se il mock è abilitato
// Non serve più controllare, il router gestisce già l'abilitazione
const checkMockEnabled = (req, res, next) => {
  next(); // Sempre passa, il router ha già verificato
};

// Store temporaneo per authorization codes (in produzione usare Redis)
const authorizationCodes = new Map();

/**
 * GET /mock-cie/authorize
 * Endpoint di autorizzazione OIDC
 * Mostra una pagina HTML con bottone "Entra come Nicolas"
 */
router.get('/authorize', checkMockEnabled, (req, res) => {
  const { client_id, redirect_uri, response_type, state, scope } = req.query;

  // Validazione parametri base
  if (!client_id || !redirect_uri || response_type !== 'code') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Parametri mancanti o non validi'
    });
  }

  // Genera authorization code
  const authCode = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60000; // 1 minuto

  // Salva il codice con i parametri della richiesta
  const authData = {
    client_id,
    redirect_uri,
    state,
    scope: scope || 'openid profile',
    expiresAt
  };
  
  authorizationCodes.set(authCode, authData);
  
  console.log('🔐 Mock CIE GET /authorize: Authorization code generato', {
    code: authCode.substring(0, 8) + '...',
    redirect_uri,
    expiresAt: new Date(expiresAt).toISOString()
  });

  // Mostra pagina HTML con bottone
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mock CIE - Autorizzazione</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 400px;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          margin-bottom: 2rem;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        }
        button:hover {
          background: #5568d3;
        }
        .info {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Mock CIE Login</h1>
        <p>Simulazione del login tramite Carta d'Identità Elettronica</p>
        <form method="POST" action="/api/auth/mock-cie/authorize">
          <input type="hidden" name="auth_code" value="${authCode}">
          <button type="submit">Entra come Nicolas</button>
        </form>
        <div class="info">
          <strong>Modalità sviluppo:</strong><br>
          Questo è un server mock per testare l'autenticazione CIE
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * POST /mock-cie/authorize
 * Gestisce la conferma dell'autorizzazione
 */
router.post('/authorize', checkMockEnabled, (req, res) => {
  try {
    const { auth_code } = req.body;
    
    console.log('🔐 Mock CIE POST /authorize: Body ricevuto', req.body);
    console.log('🔐 Mock CIE POST /authorize: auth_code', auth_code);

    if (!auth_code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Authorization code mancante'
      });
    }

    const authData = authorizationCodes.get(auth_code);

    if (!authData) {
      console.error('❌ Mock CIE POST /authorize: Authorization code non trovato', auth_code);
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Authorization code non valido'
      });
    }

    // Verifica scadenza
    if (Date.now() > authData.expiresAt) {
      authorizationCodes.delete(auth_code);
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Authorization code scaduto'
      });
    }

    // Rimuovi il codice (one-time use)
    authorizationCodes.delete(auth_code);

    // Redirect con authorization code
    try {
      console.log('🔐 Mock CIE POST /authorize: redirect_uri ricevuto', authData.redirect_uri);
      
      // Verifica che redirect_uri sia un URL valido
      let redirectUrl;
      try {
        redirectUrl = new URL(authData.redirect_uri);
      } catch (urlError) {
        // Se non è un URL assoluto, prova a costruirlo
        console.warn('⚠️ Mock CIE POST /authorize: redirect_uri non è un URL assoluto, provo a costruirlo');
        // Se inizia con /, aggiungi il protocollo e host
        if (authData.redirect_uri.startsWith('/')) {
          const protocol = req.protocol || 'https';
          const host = req.get('host') || 'demos-c7k0.onrender.com';
          redirectUrl = new URL(authData.redirect_uri, `${protocol}://${host}`);
        } else {
          throw new Error('Redirect URI non valido: ' + authData.redirect_uri);
        }
      }
      
      redirectUrl.searchParams.set('code', auth_code);
      if (authData.state) {
        redirectUrl.searchParams.set('state', authData.state);
      }

      console.log('🔐 Mock CIE POST /authorize: Redirect a', redirectUrl.toString());
      res.redirect(redirectUrl.toString());
    } catch (urlError) {
      console.error('❌ Mock CIE POST /authorize: Errore costruzione URL', urlError);
      console.error('❌ Mock CIE POST /authorize: redirect_uri originale', authData.redirect_uri);
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'Redirect URI non valido: ' + (authData.redirect_uri || 'non specificato'),
        details: urlError.message
      });
    }
  } catch (error) {
    console.error('❌ Mock CIE POST /authorize: Errore generico', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Errore interno del server',
      message: error.message
    });
  }
});

/**
 * POST /mock-cie/token
 * Endpoint per ottenere l'access token
 */
router.post('/token', checkMockEnabled, express.urlencoded({ extended: true }), express.json(), (req, res) => {
  const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;

  // Validazione
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Grant type non supportato'
    });
  }

  if (!code || !client_id || !client_secret) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Parametri mancanti'
    });
  }

  // Verifica che il codice esista (anche se già usato, per semplicità del mock)
  // In un sistema reale, il codice dovrebbe essere verificato e poi invalidato

  // Genera access token finto
  const accessToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = 3600; // 1 ora

  // Salva il token associato al codice (per userinfo)
  authorizationCodes.set(`token_${accessToken}`, {
    code,
    client_id,
    expiresAt: Date.now() + (expiresIn * 1000)
  });

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'openid profile'
  });
});

/**
 * GET /mock-cie/userinfo
 * Endpoint per ottenere i dati dell'utente
 */
router.get('/userinfo', checkMockEnabled, (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token di accesso mancante o non valido'
    });
  }

  const accessToken = authHeader.substring(7);

  // Verifica che il token esista (mock semplificato)
  const tokenData = authorizationCodes.get(`token_${accessToken}`);

  if (!tokenData) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token di accesso non valido'
    });
  }

  // Verifica scadenza
  if (Date.now() > tokenData.expiresAt) {
    authorizationCodes.delete(`token_${accessToken}`);
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token di accesso scaduto'
    });
  }

  // Restituisce dati utente mock fissi
  res.json({
    sub: '123456',
    given_name: 'Nicolas',
    family_name: 'Micheletti',
    fiscal_number: 'TINIT-MCHNLS90L11G702W'
  });
});

/**
 * GET /mock-cie/.well-known/openid-configuration
 * Endpoint di discovery OIDC
 */
router.get('/.well-known/openid-configuration', checkMockEnabled, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/auth/mock-cie`;

  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    scopes_supported: ['openid', 'profile'],
    id_token_signing_alg_values_supported: ['HS256'],
    subject_types_supported: ['public']
  });
});

module.exports = router;

