/**
 * OAuth login: Google e Apple
 * Riceve id_token dal client. La registrazione può completarsi senza CIE in modalità progressiva;
 * la CIE resta il livello di identità richiesto dalle azioni civiche sensibili.
 */
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const { getPool } = require('../../config/database');
const { generateTokenPair, generateOAuthPendingToken, verifyOAuthPendingToken } = require('../../utils/jwt');
const { authLimiter } = require('../../middleware/rateLimiting');
const { createAuthorizationRequest } = require('../../services/cieOidcAuthorizationService');
const { saveCieRegistrationTransaction } = require('../../services/cieOidcTransactionStore');
const { consumeRegistrationTicket } = require('../../services/registrationTicketStore');
const { getIdentityVerificationStatus } = require('../../services/identityVerificationStore');
const { getPublicIdentityError } = require('../../services/identityPublicErrorService');
const { completeOAuthRegistrationWithoutCie } = require('../../services/oauthRegistrationService');
const { isCieRequiredForRegistration } = require('../../services/identityRegistrationPolicy');
const { isCieRequiredForCivicActions } = require('../../services/civicIdentityPolicy');

const router = express.Router();
const pool = getPool();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || ''; // Service ID (bundle ID per app native)

/**
 * Verifica id_token Google e trattiene soltanto sub ed email per DEMOS.
 */
async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID non configurato');
  }
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email || null,
  };
}

/**
 * Verifica id_token Apple (JWT) con JWKS.
 */
async function verifyAppleIdToken(identityToken) {
  if (!APPLE_CLIENT_ID) {
    throw new Error('APPLE_CLIENT_ID non configurato');
  }
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || !decoded.header.kid) {
    throw new Error('Token Apple non valido');
  }
  const client = jwksClient({
    jwksUri: 'https://appleid.apple.com/auth/keys',
    cache: true,
  });
  const key = await client.getSigningKey(decoded.header.kid);
  const publicKey = key.getPublicKey();
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: APPLE_CLIENT_ID,
  });
  return {
    sub: payload.sub,
    email: payload.email || null,
    email_verified: payload.email_verified === true || payload.email_verified === 'true',
  };
}

/**
 * Trova utente per il provider (solo SELECT). Non crea la riga in users.
 * Restituisce { found: true, id, ruolo } oppure { found: false, profile }.
 * Se non trovato, non viene creata alcuna riga users fino al completamento del wizard;
 * la policy centrale decide se finalizzare subito o richiedere prima la CIE.
 */
async function findUserByProvider(provider, providerUserId, profile) {
  // Nuovo schema: user_auth_providers
  const providerResult = await pool.query(
    `SELECT u.id, u.ruolo, u.status
     FROM user_auth_providers uap
     INNER JOIN users u ON u.id = uap.user_id
     WHERE uap.provider = $1 AND uap.provider_user_id = $2
     LIMIT 1`,
    [provider, providerUserId]
  );

  // Fallback legacy: colonne su users
  const col = provider === 'google' ? 'google_sub' : 'apple_user_id';
  const legacyResult = providerResult.rows.length > 0
    ? { rows: [] }
    : await pool.query(
      `SELECT id, ruolo, status FROM users WHERE ${col} = $1`,
      [providerUserId]
    );

  const result = providerResult.rows.length > 0 ? providerResult : legacyResult;

  if (result.rows.length > 0) {
    const u = result.rows[0];
    if (u.status !== 'a') {
      throw new Error('Account non attivo');
    }
    return { found: true, id: u.id, ruolo: u.ruolo, isNew: false };
  }

  return { found: false, isNew: true, profile: { provider, provider_sub: providerUserId, ...profile } };
}

/**
 * POST /api/auth/oauth/google
 * Body: { idToken: string }
 */
router.post('/oauth/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'idToken richiesto',
      });
    }

    const profile = await verifyGoogleIdToken(idToken.trim());
    const result = await findUserByProvider('google', profile.sub, profile);

    if (result.found) {
      const tokens = generateTokenPair({
        userId: result.id,
        role: result.ruolo,
      });
      return res.json({
        success: true,
        message: 'Accesso con Google effettuato',
        user: { id: result.id, ruolo: result.ruolo },
        isNew: false,
        ...tokens,
      });
    }

    // Primo accesso: non creare la riga in users; restituire token "pending" (scadenza 1h).
    const pendingToken = generateOAuthPendingToken({
      provider: 'google',
      provider_sub: profile.sub,
      email: profile.email || null,
    });

    res.json({
      success: true,
      message: 'Completa la registrazione',
      user: null,
      isNew: true,
      accessToken: pendingToken,
      expiresIn: 60 * 60,
      tokenType: 'Bearer',
    });
  } catch (err) {
    const status = err.message?.includes('non configurato') ? 503 : 401;
    res.status(status).json({
      success: false,
      error: status === 503 ? 'Accesso con Google temporaneamente non disponibile' : 'Accesso con Google non riuscito',
    });
  }
});

/**
 * POST /api/auth/oauth/apple
 * Body: { id_token: string } oppure { identityToken: string }
 */
router.post('/oauth/apple', authLimiter, async (req, res) => {
  try {
    const token = (req.body?.id_token || req.body?.identityToken || '').trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'id_token o identityToken richiesto',
      });
    }

    const profile = await verifyAppleIdToken(token);
    const result = await findUserByProvider('apple', profile.sub, profile);

    if (result.found) {
      const tokens = generateTokenPair({
        userId: result.id,
        role: result.ruolo,
      });
      return res.json({
        success: true,
        message: 'Accesso con Apple effettuato',
        user: { id: result.id, ruolo: result.ruolo },
        isNew: false,
        ...tokens,
      });
    }

    const pendingToken = generateOAuthPendingToken({
      provider: 'apple',
      provider_sub: profile.sub,
      email: profile.email || null,
    });

    res.json({
      success: true,
      message: 'Completa la registrazione',
      user: null,
      isNew: true,
      accessToken: pendingToken,
      expiresIn: 60 * 60,
      tokenType: 'Bearer',
    });
  } catch (err) {
    const status = err.message?.includes('non configurato') ? 503 : 401;
    res.status(status).json({
      success: false,
      error: status === 503 ? 'Accesso con Apple temporaneamente non disponibile' : 'Accesso con Apple non riuscito',
    });
  }
});

/**
 * POST /api/auth/oauth/complete-registration
 * Completa la registrazione secondo la policy identità corrente.
 * In modalità progressiva crea l'account senza CIE; in modalità cie_required
 * conserva il comportamento pre-account e avvia il flusso CIE.
 */
router.post('/oauth/complete-registration', authLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token richiesto' });
    }

    let payload;
    try {
      payload = verifyOAuthPendingToken(authHeader.substring(7));
    } catch (_error) {
      return res.status(401).json({
        success: false,
        error: 'Token non valido o scaduto. Riprova ad accedere con Google/Apple.',
      });
    }

    const provider = String(payload.provider || '').toLowerCase();
    const providerSub = String(payload.provider_sub || '').trim();
    if (!['google', 'apple'].includes(provider) || !providerSub) {
      return res.status(400).json({ success: false, error: 'Provider OAuth non valido' });
    }

    const {
      paese_residenza,
      regione_residenza,
      provincia_residenza,
      comune_residenza,
      privacy_policy_consent,
      terms_of_service_consent,
      political_opinions_consent,
    } = req.body || {};

    if (privacy_policy_consent !== true || terms_of_service_consent !== true) {
      return res.status(400).json({
        success: false,
        error: 'Privacy Policy e Termini devono essere accettati prima della registrazione',
      });
    }

    const registration = {
      provider,
      providerSub,
      email: payload.email || null,
      location: {
        paese_residenza: paese_residenza || null,
        regione_residenza: regione_residenza || null,
        provincia_residenza: provincia_residenza || null,
        comune_residenza: comune_residenza || null,
      },
      privacyPolicyConsent: true,
      termsOfServiceConsent: true,
      politicalOpinionsConsent: political_opinions_consent === true,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
    };

    if (!isCieRequiredForRegistration()) {
      const completed = await completeOAuthRegistrationWithoutCie({ registration });
      const tokens = generateTokenPair({ userId: completed.userId, role: completed.role });
      return res.json({
        success: true,
        requiresCie: false,
        identityVerified: false,
        message: isCieRequiredForCivicActions()
          ? 'Registrazione completata. Per le azioni civiche è richiesta la verifica CIE.'
          : 'Registrazione completata. Puoi utilizzare le funzioni civiche senza CIE nella fase iniziale.',
        user: { id: completed.userId, ruolo: completed.role },
        hasPasskey: false,
        ...tokens,
      });
    }

    const { authorizationUrl, transaction } = createAuthorizationRequest();
    const registrationKey = `${provider}:${providerSub}`;
    await saveCieRegistrationTransaction(registrationKey, registration, transaction);

    return res.json({
      success: true,
      requiresCie: true,
      authorizationUrl,
      message: 'Verifica la tua identita con CIE per completare la registrazione',
    });
  } catch (error) {
    const publicError = getPublicIdentityError(error, {
      status: 503,
      error: 'Registrazione temporaneamente non disponibile',
    });
    return res.status(publicError.status).json({
      success: false,
      ...(publicError.code ? { code: publicError.code } : {}),
      error: publicError.error,
    });
  }
});

/**
 * POST /api/auth/oauth/registration/exchange
 * Scambia il ticket one-time ricevuto nel fragment dopo la callback CIE con i JWT DEMOS.
 * Il ticket non contiene dati CIE e viene consumato una sola volta.
 */
router.post('/oauth/registration/exchange', authLimiter, async (req, res) => {
  try {
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket.trim() : '';
    if (!ticket) {
      return res.status(400).json({ success: false, error: 'Ticket registrazione richiesto' });
    }

    const { userId } = await consumeRegistrationTicket(ticket);
    const identity = await getIdentityVerificationStatus(userId);
    if (!identity.verified) {
      return res.status(401).json({ success: false, error: 'Identita non verificata' });
    }

    const result = await pool.query(
      'SELECT id, ruolo, status, webauthn_credential_id FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0 || result.rows[0].status !== 'a') {
      return res.status(401).json({ success: false, error: 'Account non attivo' });
    }

    const user = result.rows[0];
    const tokens = generateTokenPair({ userId: user.id, role: user.ruolo });
    return res.json({
      success: true,
      message: 'Registrazione completata con CIE',
      user: { id: user.id, ruolo: user.ruolo },
      hasPasskey: Boolean(user.webauthn_credential_id),
      ...tokens,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Ticket registrazione non valido, scaduto o gia utilizzato',
    });
  }
});

module.exports = router;
