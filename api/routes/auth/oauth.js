/**
 * OAuth login: Google e Apple
 * Riceve id_token dal client, verifica con il provider, crea/collega utente e restituisce JWT Demos.
 */
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getPool } = require('../../config/database');
const { generateTokenPair, generateOAuthPendingToken, verifyOAuthPendingToken } = require('../../utils/jwt');
const { authLimiter } = require('../../middleware/rateLimiting');
const { encrypt: encryptEmail } = require('../../utils/emailCrypto');
const { compressUserLocation } = require('../../utils/locationUtils');
const { recordIssuedSession } = require('../../services/sessionService');

const router = express.Router();
const pool = getPool();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || ''; // Service ID (bundle ID per app native)

/**
 * Verifica id_token Google e restituisce payload (sub, email, name).
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
    name: payload.name || null,
    given_name: payload.given_name || null,
    family_name: payload.family_name || null,
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
    name: null,
    given_name: null,
    family_name: null,
  };
}

/**
 * Trova utente per il provider (solo SELECT). Non crea la riga in users.
 * Restituisce { found: true, id, ruolo } oppure { found: false, profile }.
 * Se non trovato, la riga in users viene creata solo al completamento del wizard (complete-registration).
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
    console.log('OAuth: utente esistente', provider, u.id, '→ isNew: false (redirect Preferiti)');
    return { found: true, id: u.id, ruolo: u.ruolo, isNew: false };
  }

  console.log('OAuth: primo accesso', provider, '→ isNew: true, nessuna riga in users finché non completa il wizard');
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
      const sid = require('../../utils/jwt').verifyRefreshToken(tokens.refreshToken).sid;
      await recordIssuedSession({ sessionId:sid, userId:result.id, refreshToken:tokens.refreshToken, ipAddress:req.ip||null, userAgent:req.get('User-Agent')||null });
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
      given_name: profile.given_name || null,
      family_name: profile.family_name || null,
      name: profile.name || null,
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
    console.error('OAuth Google error:', err?.message || err);
    const status = err.message?.includes('non configurato') ? 503 : 401;
    res.status(status).json({
      success: false,
      error: err.message || 'Accesso con Google non riuscito',
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
      const sid = require('../../utils/jwt').verifyRefreshToken(tokens.refreshToken).sid;
      await recordIssuedSession({ sessionId:sid, userId:result.id, refreshToken:tokens.refreshToken, ipAddress:req.ip||null, userAgent:req.get('User-Agent')||null });
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
      given_name: profile.given_name || null,
      family_name: profile.family_name || null,
      name: profile.name || null,
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
    console.error('OAuth Apple error:', err?.message || err);
    const status = err.message?.includes('non configurato') ? 503 : 401;
    res.status(status).json({
      success: false,
      error: err.message || 'Accesso con Apple non riuscito',
    });
  }
});

/**
 * POST /api/auth/oauth/complete-registration
 * Completa la registrazione OAuth: crea la riga in users e restituisce i token definitivi.
 * Richiede Authorization: Bearer <token_pending> (emesso da /oauth/google o /oauth/apple per isNew: true).
 * Body: residenza e consensi (paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
 *       privacy_policy_consent, terms_of_service_consent, political_opinions_consent).
 */
router.post('/oauth/complete-registration', authLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token richiesto',
      });
    }

    let payload;
    try {
      payload = verifyOAuthPendingToken(authHeader.substring(7));
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: 'Token non valido o scaduto. Riprova ad accedere con Google/Apple.',
      });
    }

    const provider = payload.provider;
    const provider_sub = payload.provider_sub;
    const col = provider === 'google' ? 'google_sub' : 'apple_user_id';

    const {
      paese_residenza,
      regione_residenza,
      provincia_residenza,
      comune_residenza,
      privacy_policy_consent,
      terms_of_service_consent,
      political_opinions_consent,
    } = req.body || {};

    const nome = payload.given_name || payload.name || 'Utente';
    const cognome = payload.family_name || '';
    const emailPlain = payload.email || `oauth-${provider}-${String(provider_sub).replace(/[^a-zA-Z0-9._-]/g, '_')}@demos.oauth`;
    const email = encryptEmail(emailPlain) ?? emailPlain;

    const compressed = compressUserLocation({
      paese_residenza: paese_residenza || null,
      regione_residenza: regione_residenza || null,
      provincia_residenza: provincia_residenza || null,
      comune_residenza: comune_residenza || null,
    });

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('User-Agent') || null;
    const consentTs = (privacy_policy_consent === true || terms_of_service_consent === true);

    // Se esiste già un utente con questo google_sub/apple_user_id (es. creato dal vecchio flusso o doppio invio),
    // aggiorniamo residenza/consensi e restituiamo i token senza fare INSERT (evita "duplicate key").
    const existingByProvider = await pool.query(
      `SELECT u.id, u.ruolo
       FROM user_auth_providers uap
       INNER JOIN users u ON u.id = uap.user_id
       WHERE uap.provider = $1 AND uap.provider_user_id = $2
       LIMIT 1`,
      [provider, provider_sub]
    );

    const existingByLegacy = existingByProvider.rows.length > 0
      ? { rows: [] }
      : await pool.query(
        `SELECT id, ruolo FROM users WHERE ${col} = $1`,
        [provider_sub]
      );

    const existing = existingByProvider.rows.length > 0 ? existingByProvider : existingByLegacy;

    let userId;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE users SET
            paese_residenza = $1, regione_residenza = $2, provincia_residenza = $3, comune_residenza = $4,
            privacy_policy_consent = $5, terms_of_service_consent = $6
            ${consentTs ? ', consent_timestamp = NOW()' : ''},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7`,
          [
            compressed.paese_residenza ?? null,
            compressed.regione_residenza ?? null,
            compressed.provincia_residenza ?? null,
            compressed.comune_residenza ?? null,
            privacy_policy_consent === true,
            terms_of_service_consent === true,
            userId,
          ]
        );

        await client.query(
          `INSERT INTO user_profile (
            user_id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO UPDATE SET
            paese_residenza = EXCLUDED.paese_residenza,
            regione_residenza = EXCLUDED.regione_residenza,
            provincia_residenza = EXCLUDED.provincia_residenza,
            comune_residenza = EXCLUDED.comune_residenza,
            updated_at = NOW()`,
          [
            userId,
            compressed.paese_residenza ?? null,
            compressed.regione_residenza ?? null,
            compressed.provincia_residenza ?? null,
            compressed.comune_residenza ?? null,
          ]
        );

        await client.query(
          `INSERT INTO user_consents (
            user_id, privacy_policy_consent, terms_of_service_consent, consent_timestamp,
            political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id) DO UPDATE SET
            privacy_policy_consent = EXCLUDED.privacy_policy_consent,
            terms_of_service_consent = EXCLUDED.terms_of_service_consent,
            consent_timestamp = EXCLUDED.consent_timestamp,
            political_opinions_consent = EXCLUDED.political_opinions_consent,
            political_opinions_consent_timestamp = EXCLUDED.political_opinions_consent_timestamp,
            political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
            political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
            updated_at = NOW()`,
          [
            userId,
            privacy_policy_consent === true,
            terms_of_service_consent === true,
            consentTs ? new Date().toISOString() : null,
            political_opinions_consent === true,
            political_opinions_consent === true ? new Date().toISOString() : null,
            political_opinions_consent === true ? ipAddress : null,
            political_opinions_consent === true ? userAgent : null,
          ]
        );

        await client.query(
          `INSERT INTO user_auth_providers (
            user_id, provider, provider_user_id, provider_metadata
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT (provider, provider_user_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            provider_metadata = EXCLUDED.provider_metadata,
            updated_at = NOW()`,
          [
            userId,
            provider,
            provider_sub,
            JSON.stringify({
              email: payload.email || null,
              given_name: payload.given_name || null,
              family_name: payload.family_name || null,
              name: payload.name || null
            })
          ]
        );
        if (political_opinions_consent === true) {
          await client.query(
            `UPDATE users SET
              political_opinions_consent = true,
              political_opinions_consent_timestamp = NOW(),
              political_opinions_consent_ip_address = $1,
              political_opinions_consent_user_agent = $2,
              updated_at = NOW()
            WHERE id = $3`,
            [ipAddress, userAgent, userId]
          );
        }
        await client.query('COMMIT');
        console.log('OAuth: complete-registration su utente esistente (aggiornato)', provider, userId);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      userId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO users (
            id, ruolo, status, nome, cognome, email, ${col},
            paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
            privacy_policy_consent, terms_of_service_consent
            ${consentTs ? ', consent_timestamp' : ''},
            created_at, updated_at
          ) VALUES (
            $1, $2, 'a', $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12
            ${consentTs ? ', NOW()' : ''},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            userId, 'E', nome, cognome || 'OAuth', email, provider_sub,
            compressed.paese_residenza ?? null,
            compressed.regione_residenza ?? null,
            compressed.provincia_residenza ?? null,
            compressed.comune_residenza ?? null,
            privacy_policy_consent === true,
            terms_of_service_consent === true,
          ]
        );

        await client.query(
          `INSERT INTO user_profile (
            user_id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO UPDATE SET
            paese_residenza = EXCLUDED.paese_residenza,
            regione_residenza = EXCLUDED.regione_residenza,
            provincia_residenza = EXCLUDED.provincia_residenza,
            comune_residenza = EXCLUDED.comune_residenza,
            updated_at = NOW()`,
          [
            userId,
            compressed.paese_residenza ?? null,
            compressed.regione_residenza ?? null,
            compressed.provincia_residenza ?? null,
            compressed.comune_residenza ?? null,
          ]
        );

        await client.query(
          `INSERT INTO user_consents (
            user_id, privacy_policy_consent, terms_of_service_consent, consent_timestamp,
            political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id) DO UPDATE SET
            privacy_policy_consent = EXCLUDED.privacy_policy_consent,
            terms_of_service_consent = EXCLUDED.terms_of_service_consent,
            consent_timestamp = EXCLUDED.consent_timestamp,
            political_opinions_consent = EXCLUDED.political_opinions_consent,
            political_opinions_consent_timestamp = EXCLUDED.political_opinions_consent_timestamp,
            political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
            political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
            updated_at = NOW()`,
          [
            userId,
            privacy_policy_consent === true,
            terms_of_service_consent === true,
            consentTs ? new Date().toISOString() : null,
            political_opinions_consent === true,
            political_opinions_consent === true ? new Date().toISOString() : null,
            political_opinions_consent === true ? ipAddress : null,
            political_opinions_consent === true ? userAgent : null,
          ]
        );

        await client.query(
          `INSERT INTO user_auth_providers (
            user_id, provider, provider_user_id, provider_metadata
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT (provider, provider_user_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            provider_metadata = EXCLUDED.provider_metadata,
            updated_at = NOW()`,
          [
            userId,
            provider,
            provider_sub,
            JSON.stringify({
              email: payload.email || null,
              given_name: payload.given_name || null,
              family_name: payload.family_name || null,
              name: payload.name || null
            })
          ]
        );

        if (political_opinions_consent === true) {
          await client.query(
            `UPDATE users SET
              political_opinions_consent = true,
              political_opinions_consent_timestamp = NOW(),
              political_opinions_consent_ip_address = $1,
              political_opinions_consent_user_agent = $2,
              updated_at = NOW()
            WHERE id = $3`,
            [ipAddress, userAgent, userId]
          );
        }

        await client.query('COMMIT');
        console.log('OAuth: registrazione completata', provider, userId);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const ruolo = existing.rows.length > 0 ? existing.rows[0].ruolo : 'E';
    const tokens = generateTokenPair({
      userId,
      role: ruolo,
    });
    const sid = require('../../utils/jwt').verifyRefreshToken(tokens.refreshToken).sid;
    await recordIssuedSession({ sessionId:sid, userId, refreshToken:tokens.refreshToken, ipAddress:req.ip||null, userAgent:req.get('User-Agent')||null });

    res.json({
      success: true,
      message: 'Registrazione completata',
      user: { id: userId, ruolo },
      ...tokens,
    });
  } catch (err) {
    console.error('OAuth complete-registration error:', err?.message || err);
    res.status(500).json({
      success: false,
      error: err.message || 'Completamento registrazione non riuscito',
    });
  }
});

module.exports = router;
