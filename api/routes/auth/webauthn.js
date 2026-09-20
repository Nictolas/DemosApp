const express = require('express');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
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
  WEBAUTHN_RESIDENT_KEY,
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
const {
  createWebAuthnRegistrationSessionKey,
  normalizeWebAuthnRegistrationSessionKey,
} = require('../../services/webauthnRegistrationSessionPolicy');
const {
  normalizeWebAuthnCredentialId,
  webAuthnCredentialIdLookupVariants,
} = require('../../services/webauthnCredentialIdPolicy');
const {
  advanceWebAuthnSignCounter,
} = require('../../services/webauthnSignCounterService');
const {
  webAuthnUserHandleMatches,
} = require('../../services/webauthnUserHandleService');
const {
  ensureWebAuthnCredentialAvailable,
} = require('../../services/webauthnCredentialRegistrationService');
const {
  webauthnStatusLimiter,
  webauthnChallengeLimiter,
  webauthnVerifyLimiter,
} = require('../../middleware/webauthnRateLimiting');

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

function invalidRegistrationSession(res, error) {
  if (error?.code !== 'INVALID_WEBAUTHN_REGISTRATION_SESSION') return false;
  res.status(400).json({
    success: false,
    error: 'Sessione registrazione passkey non valida',
    code: 'INVALID_PASSKEY_REGISTRATION_SESSION',
  });
  return true;
}

function invalidCredentialId(res, error) {
  if (error?.code !== 'INVALID_WEBAUTHN_CREDENTIAL_ID') return false;
  res.status(400).json({
    success: false,
    error: 'Credenziale passkey non valida',
    code: 'INVALID_PASSKEY_CREDENTIAL_ID',
  });
  return true;
}

/**
 * POST /api/auth/webauthn/device/status
 * Indica se questa installazione/browser ha già un account passkey lato server.
 * deviceId è solo un identificatore UX persistito in localStorage: non identifica
 * in modo affidabile un dispositivo fisico e non è un controllo anti-multiaccount.
 */
router.post('/webauthn/device/status', webauthnStatusLimiter, async (req, res) => {
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
router.post('/webauthn/register/options', webauthnChallengeLimiter, async (req, res) => {
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

    const userId = createWebAuthnRegistrationSessionKey();
    const userHandleBuffer = Buffer.from(userId, 'utf8');

    // SimpleWebAuthn richiede userID come Buffer/Uint8Array (non stringa); generateRegistrationOptions è async
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: userHandleBuffer,
      userName: `user-${userId}`,
      userDisplayName: 'Demos user',
      authenticatorSelection: {
        // Il login è discovery-only (allowCredentials vuoto), quindi la
        // credenziale deve essere discoverable/resident.
        residentKey: WEBAUTHN_RESIDENT_KEY,
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
router.post('/webauthn/register/verify', webauthnVerifyLimiter, async (req, res) => {
  try {
    const { userId, attestation } = req.body || {};

    if (!userId || !attestation) {
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti',
        message: 'userId e attestation sono richiesti',
      });
    }

    const registrationKey = normalizeWebAuthnRegistrationSessionKey(userId);
    const pending = await consumeRegistrationChallenge(registrationKey);
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

    // Salva esclusivamente l'ID prodotto dalla verifica server-side.
    // Non fidarsi di attestation.rawId inviato dal client per la persistenza.
    const credentialIdBase64 = normalizeWebAuthnCredentialId(String(credentialID));
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString(
      'base64url',
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const credentialAvailable = await ensureWebAuthnCredentialAvailable(
        client,
        credentialIdBase64,
      );
      if (!credentialAvailable) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'Passkey già associata a un account',
          code: 'PASSKEY_CREDENTIAL_ALREADY_REGISTERED',
          message: 'Questa passkey risulta già associata a un account. Accedi con la passkey esistente.',
        });
      }

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
        RETURNING id, ruolo
      `;

      const result = await client.query(insertQuery, [
        registrationKey,
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
    if (invalidRegistrationSession(res, error)) return;
    if (invalidClientInstanceId(res, error)) return;
    if (invalidCredentialId(res, error)) return;
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
router.post('/webauthn/login/options', webauthnChallengeLimiter, async (_req, res) => {
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
router.post('/webauthn/login/verify', webauthnVerifyLimiter, async (req, res) => {
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
      const receivedCredentialId = assertion.rawId || assertion.id;
      if (!receivedCredentialId) {
        return res.status(400).json({
          success: false,
          error: 'Credential ID mancante nella risposta',
        });
      }

      const credentialVariants = webAuthnCredentialIdLookupVariants(
        String(receivedCredentialId),
      );
      const q = await pool.query(
        `SELECT id, ruolo, webauthn_user_handle, webauthn_credential_id, webauthn_public_key, webauthn_sign_count
         FROM users
         WHERE webauthn_credential_id = ANY($1::text[])
         LIMIT 2`,
        [credentialVariants],
      );
      const rows = q.rows;

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Nessun utente associato a questa passkey',
          code: 'PASSKEY_NOT_FOUND',
          hint: 'Rimuovi le passkey obsolete: Impostazioni > Password > demos.community. Poi accedi con l\'ultima passkey creata o registrati di nuovo.',
        });
      }

      if (rows.length !== 1) {
        console.error('❌ Credential ID WebAuthn associato a più utenti');
        return res.status(409).json({
          success: false,
          error: 'Credenziale passkey non valida',
          code: 'PASSKEY_CREDENTIAL_CONFLICT',
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

    try {
      const receivedUserHandle = assertion?.response?.userHandle ?? null;
      if (
        !webAuthnUserHandleMatches(
          String(user.id),
          user.webauthn_user_handle,
          receivedUserHandle,
        )
      ) {
        console.error('❌ User handle WebAuthn non coerente con la credenziale');
        return res.status(400).json({
          success: false,
          ...getPublicWebAuthnError('AUTHENTICATION_VERIFICATION_FAILED'),
        });
      }
    } catch (userHandleError) {
      console.error(
        '❌ User handle WebAuthn non valido:',
        userHandleError?.message || userHandleError,
      );
      return res.status(400).json({
        success: false,
        ...getPublicWebAuthnError('AUTHENTICATION_VERIFICATION_FAILED'),
      });
    }

    const { newCounter } = verification.authenticationInfo;

    const counterAdvanced = await advanceWebAuthnSignCounter(
      pool,
      user.id,
      newCounter,
    );
    if (!counterAdvanced) {
      console.error(
        '❌ Sign counter WebAuthn non avanzato: possibile login concorrente, replay o contatore regressivo',
        { userId: user.id },
      );
      return res.status(409).json({
        success: false,
        ...getPublicWebAuthnError('SIGN_COUNTER_CONFLICT'),
      });
    }

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
    if (invalidCredentialId(res, error)) return;
    if (challengeStoreUnavailable(res, error)) return;
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica del login WebAuthn',
    });
  }
});

module.exports = router;
