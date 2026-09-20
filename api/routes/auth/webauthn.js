const express = require('express');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../../config/database');
const { generateTokenPair } = require('../../utils/jwt');
const {
  setRegistrationChallenge,
  consumeRegistrationChallenge,
  setLoginChallenge,
  consumeLoginChallenge,
} = require('../../services/webauthnChallengeStore');
const {
  getPublicWebAuthnRegistrationRole,
} = require('../../services/webauthnRegistrationPolicy');
const {
  WEBAUTHN_USER_VERIFICATION,
  WEBAUTHN_REQUIRE_USER_VERIFICATION,
} = require('../../services/webauthnSecurityPolicy');
const {
  getPublicWebAuthnError,
} = require('../../services/webauthnPublicErrorService');
const {
  normalizeWebAuthnClientInstanceId,
} = require('../../services/webauthnClientInstancePolicy');
const {
  createWebAuthnLoginSessionKey,
  normalizeWebAuthnLoginSessionKey,
} = require('../../services/webauthnLoginSessionPolicy');

const router = express.Router();
const pool = getPool();

// Configurazione Relying Party per Demos
const rpID = process.env.WEBAUTHN_RP_ID || 'demos.community';
const rpName = process.env.WEBAUTHN_RP_NAME || 'Demos';
// Consenti sia dominio con www che senza. expectedOrigin può essere stringa o array (simplewebauthn accetta entrambi).
const expectedOrigin = process.env.WEBAUTHN_EXPECTED_ORIGIN
  ? process.env.WEBAUTHN_EXPECTED_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : ['https://demos.community', 'https://www.demos.community'];
const expectedOriginFinal = expectedOrigin.length === 1 ? expectedOrigin[0] : expectedOrigin;

function challengeStoreUnavailable(res, error) {
  if (error?.code !== 'WEBAUTHN_CHALLENGE_STORE_UNAVAILABLE') return false;
  res.status(503).json({
    success: false,
    error: 'Servizio passkey temporaneamente non disponibile',
    message: 'Riprova tra poco.',
  });
  return true;
}

function invalidClientInstanceId(res, error) {
  if (error?.code !== 'INVALID_WEBAUTHN_CLIENT_INSTANCE_ID') return false;
  res.status(400).json({
    success: false,
    error: 'Identificatore browser non valido',
    code: 'INVALID_CLIENT_INSTANCE_ID',
  });
  return true;
}

function invalidLoginSession(res, error) {
  if (error?.code !== 'INVALID_WEBAUTHN_LOGIN_SESSION') return false;
  res.status(400).json({
    success: false,
    error: 'Sessione login passkey non valida',
    code: 'INVALID_PASSKEY_LOGIN_SESSION',
  });
  return true;
}

/**
 * POST /api/auth/webauthn/device/status
 * Indica se questa installazione/browser ha già un account passkey lato server.
 * deviceId è solo un identificatore UX persistito in localStorage: non identifica
 * in modo affidabile un dispositivo fisico e non è un controllo anti-multiaccount.
 */
router.post('/webauthn/device/status', async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    const clientInstanceId = normalizeWebAuthnClientInstanceId(deviceId, { required: true });
    const result = await pool.query(
      `SELECT 1
       FROM users
       WHERE webauthn_device_id = $1
         AND webauthn_credential_id IS NOT NULL
         AND webauthn_credential_id <> ''
       LIMIT 1`,
      [clientInstanceId],
    );
    return res.json({ success: true, hasAccount: result.rows.length > 0 });
  } catch (error) {
    console.error('❌ Errore in /webauthn/device/status:', error);
    if (invalidClientInstanceId(res, error)) return;
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero stato dispositivo',
    });
  }
});

/**
 * POST /api/auth/webauthn/register/options
 * Genera le options per la creazione di una nuova passkey
 */
router.post('/webauthn/register/options', async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    const clientInstanceId = normalizeWebAuthnClientInstanceId(deviceId);

    // Solo UX/consistenza per questa installazione del browser. Non è un controllo
    // di sicurezza anti-multiaccount perché localStorage può essere cancellato.
    if (clientInstanceId) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE webauthn_device_id = $1 LIMIT 1',
        [clientInstanceId],
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Questo browser ha già un account',
          code: 'DEVICE_ALREADY_REGISTERED',
          message: 'In questo browser risulta già creato un account con passkey. Accedi con la passkey esistente invece di registrarti di nuovo.',
        });
      }
    }

    // La registrazione pubblica WebAuthn non accetta ruoli dal client.
    // Eventuali ruoli privilegiati vengono assegnati solo da flussi server-side dedicati.
    const userRole = getPublicWebAuthnRegistrationRole();

    const userId = uuidv4();
    const userHandleBuffer = Buffer.from(userId, 'utf8');

    // SimpleWebAuthn richiede userID come Buffer/Uint8Array (non stringa); generateRegistrationOptions è async
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: userHandleBuffer,
      userName: `user-${userId}`,
      userDisplayName: 'Demos user',
      authenticatorSelection: {
        residentKey: 'preferred',
        // Per DEMOS una passkey deve essere protetta da verifica locale dell'utente
        // (Face ID, impronta, PIN o metodo equivalente dell'autenticatore).
        userVerification: WEBAUTHN_USER_VERIFICATION,
        // Passkey sul dispositivo (iPhone = Face ID, Android = impronta, ecc.)
        authenticatorAttachment: 'platform',
      },
      attestationType: 'none',
    });

    await setRegistrationChallenge(userId, {
      challenge: options.challenge,
      userHandle: userHandleBuffer.toString('base64url'),
      ruolo: userRole,
      deviceId: clientInstanceId,
    });

    // Options già serializzabili (challenge e user.id sono stringhe base64url)
    res.json({
      success: true,
      userId,
      publicKey: options,
    });
  } catch (error) {
    console.error('❌ Errore in /webauthn/register/options:', error?.message || error, error?.stack);
    if (invalidClientInstanceId(res, error)) return;
    if (challengeStoreUnavailable(res, error)) return;
    res.status(500).json({
      success: false,
      error: 'Errore nella generazione delle options WebAuthn',
    });
  }
});

/**
 * POST /api/auth/webauthn/register/verify
 * Verifica la risposta di registrazione e crea l'utente
 */
router.post('/webauthn/register/verify', async (req, res) => {
  try {
    const { userId, attestation } = req.body || {};

    if (!userId || !attestation) {
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti',
        message: 'userId e attestation sono richiesti',
      });
    }

    const pending = await consumeRegistrationChallenge(userId);
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'Registrazione non trovata o scaduta',
      });
    }

    // L'identificatore browser usato al salvataggio è quello già legato alla
    // challenge server-side; un valore eventualmente aggiunto alla verify request
    // dal client non può sostituirlo.
    const regDeviceId = normalizeWebAuthnClientInstanceId(pending.deviceId);
    if (regDeviceId) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE webauthn_device_id = $1 LIMIT 1',
        [regDeviceId],
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Questo browser ha già un account',
          code: 'DEVICE_ALREADY_REGISTERED',
          message: 'In questo browser risulta già creato un account con passkey. Accedi con la passkey esistente.',
        });
      }
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: attestation,
        expectedChallenge: pending.challenge,
        expectedOrigin: expectedOriginFinal,
        expectedRPID: rpID,
        requireUserVerification: WEBAUTHN_REQUIRE_USER_VERIFICATION,
      });
    } catch (verifyErr) {
      console.error('❌ verifyRegistrationResponse fallita:', verifyErr?.message || verifyErr);
      return res.status(400).json({
        success: false,
        ...getPublicWebAuthnError('REGISTRATION_VERIFICATION_FAILED'),
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        error: 'Registrazione WebAuthn non valida',
      });
    }

    const { credential } = verification.registrationInfo;
    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Dati credenziale WebAuthn mancanti',
      });
    }
    const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

    // Usa il credential ID inviato dal client (attestation.rawId) così al login il match è garantito
    const credentialIdBase64 =
      (attestation.rawId && String(attestation.rawId).trim()) ||
      String(credentialID).trim();
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString(
      'base64url',
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO users (
          id,
          ruolo,
          webauthn_user_handle,
          webauthn_credential_id,
          webauthn_public_key,
          webauthn_sign_count,
          webauthn_device_id,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          'a',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          webauthn_user_handle = EXCLUDED.webauthn_user_handle,
          webauthn_credential_id = EXCLUDED.webauthn_credential_id,
          webauthn_public_key = EXCLUDED.webauthn_public_key,
          webauthn_sign_count = EXCLUDED.webauthn_sign_count,
          webauthn_device_id = EXCLUDED.webauthn_device_id,
          ruolo = EXCLUDED.ruolo,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, ruolo
      `;

      const result = await client.query(insertQuery, [
        userId,
        pending.ruolo,
        pending.userHandle,
        credentialIdBase64,
        publicKeyBase64,
        counter,
        regDeviceId,
      ]);

      await client.query('COMMIT');

      const user = result.rows[0];

      const tokenPayload = {
        userId: user.id,
        role: user.ruolo,
      };

      const tokens = generateTokenPair(tokenPayload);

      res.json({
        success: true,
        message: 'Registrazione con passkey completata',
        user: {
          id: user.id,
          ruolo: user.ruolo,
        },
        ...tokens,
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('❌ Errore DB in /webauthn/register/verify:', dbError);

      if (
        dbError?.code === '23505' &&
        dbError?.constraint === 'idx_users_webauthn_device_id'
      ) {
        return res.status(409).json({
          success: false,
          error: 'Questo browser ha già un account',
          code: 'DEVICE_ALREADY_REGISTERED',
          message: 'In questo browser risulta già creato un account con passkey. Accedi con la passkey esistente.',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Errore nel salvataggio dell\'utente WebAuthn',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Errore in /webauthn/register/verify:', error);
    if (invalidClientInstanceId(res, error)) return;
    if (challengeStoreUnavailable(res, error)) return;
    res.status(500).json({
      success: false,
      ...getPublicWebAuthnError('REGISTRATION_FAILED'),
    });
  }
});

/**
 * POST /api/auth/webauthn/login/options
 * Genera le options discovery per il login con passkey.
 * Ogni tentativo usa una sessionKey casuale server-side: nessuna challenge è
 * indicizzata per userId e richieste concorrenti non possono sovrascriversi.
 */
router.post('/webauthn/login/options', async (_req, res) => {
  try {
    const sessionKey = createWebAuthnLoginSessionKey();

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [],
      userVerification: WEBAUTHN_USER_VERIFICATION,
    });

    await setLoginChallenge(sessionKey, {
      challenge: options.challenge,
    });

    res.json({
      success: true,
      publicKey: options,
      sessionKey,
    });
  } catch (error) {
    console.error('❌ Errore in /webauthn/login/options:', error);
    if (challengeStoreUnavailable(res, error)) return;
    res.status(500).json({
      success: false,
      error: 'Errore nella generazione delle options di login WebAuthn',
    });
  }
});

/**
 * POST /api/auth/webauthn/login/verify
 * Verifica la risposta di login discovery e genera i token.
 * La sessionKey è casuale, one-time e indipendente dall'identità dell'utente.
 */
router.post('/webauthn/login/verify', async (req, res) => {
  try {
    const { sessionKey, assertion } = req.body || {};

    if (!assertion) {
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti',
        message: 'assertion e sessionKey sono richiesti',
      });
    }

    const loginKey = normalizeWebAuthnLoginSessionKey(sessionKey);
    const pending = await consumeLoginChallenge(loginKey);
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'Richiesta di login non trovata o scaduta',
      });
    }

    let user;
    {
      const rawId = assertion.rawId ? String(assertion.rawId).trim() : null;
      const id = assertion.id ? String(assertion.id).trim() : null;
      if (!rawId && !id) {
        return res.status(400).json({
          success: false,
          error: 'Credential ID mancante nella risposta',
        });
      }
      const idsToTry = [...new Set([rawId, id].filter(Boolean))];
      let rows = [];
      try {
        const q = await pool.query(
          `SELECT id, ruolo, webauthn_credential_id, webauthn_public_key, webauthn_sign_count
           FROM users
           WHERE webauthn_credential_id = ANY($1::text[])`,
          [idsToTry],
        );
        rows = q.rows;
      } catch (_) {}

      if (rows.length === 0 && (rawId || id)) {
        const first = rawId || id;
        const withoutPadding = first.replace(/=+$/, '');
        const r2 = await pool.query(
          `SELECT id, ruolo, webauthn_credential_id, webauthn_public_key, webauthn_sign_count
           FROM users
           WHERE webauthn_credential_id = $1 OR REPLACE(webauthn_credential_id, '=', '') = $2`,
          [first, withoutPadding],
        );
        rows = r2.rows;
      }
      if (rows.length === 0 && (rawId || id)) {
        try {
          const canonical = Buffer.from(rawId || id, 'base64url').toString('base64url');
          const r3 = await pool.query(
            `SELECT id, ruolo, webauthn_credential_id, webauthn_public_key, webauthn_sign_count
             FROM users WHERE webauthn_credential_id = $1`,
            [canonical],
          );
          rows = r3.rows;
        } catch (_) {}
      }
      if (rows.length === 0 && (rawId || id)) {
        const receivedBuf = Buffer.from(rawId || id, 'base64url');
        const allWithCred = await pool.query(
          `SELECT id, ruolo, webauthn_credential_id, webauthn_public_key, webauthn_sign_count
           FROM users WHERE webauthn_credential_id IS NOT NULL AND webauthn_credential_id != ''`,
        );
        const match = allWithCred.rows.find((row) => {
          try {
            const stored = Buffer.from(row.webauthn_credential_id, 'base64url');
            return stored.length === receivedBuf.length && stored.equals(receivedBuf);
          } catch {
            return false;
          }
        });
        if (match) rows = [match];
      }
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Nessun utente associato a questa passkey',
          code: 'PASSKEY_NOT_FOUND',
          hint: 'Rimuovi le passkey obsolete: Impostazioni > Password > demos.community. Poi accedi con l\'ultima passkey creata o registrati di nuovo.',
        });
      }
      user = rows[0];
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: pending.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: user.webauthn_credential_id,
          publicKey: new Uint8Array(Buffer.from(user.webauthn_public_key, 'base64url')),
          counter: user.webauthn_sign_count || 0,
        },
        requireUserVerification: WEBAUTHN_REQUIRE_USER_VERIFICATION,
      });
    } catch (verifyErr) {
      console.error('❌ verifyAuthenticationResponse fallita:', verifyErr?.message || verifyErr);
      return res.status(400).json({
        success: false,
        ...getPublicWebAuthnError('AUTHENTICATION_VERIFICATION_FAILED'),
      });
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(400).json({
        success: false,
        error: 'Login WebAuthn non valido',
      });
    }

    const { newCounter } = verification.authenticationInfo;

    await pool.query(
      `
        UPDATE users
        SET webauthn_sign_count = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [newCounter, user.id],
    );

    const tokenPayload = {
      userId: user.id,
      role: user.ruolo,
    };

    const tokens = generateTokenPair(tokenPayload);

    res.json({
      success: true,
      message: 'Login con passkey effettuato con successo',
      user: {
        id: user.id,
        ruolo: user.ruolo,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('❌ Errore in /webauthn/login/verify:', error);
    if (invalidLoginSession(res, error)) return;
    if (challengeStoreUnavailable(res, error)) return;
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica del login WebAuthn',
    });
  }
});

module.exports = router;
