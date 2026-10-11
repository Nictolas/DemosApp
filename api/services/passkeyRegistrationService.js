const { getPool } = require('../config/database');
const { compressUserLocation } = require('../utils/locationUtils');
const { registerVerifiedIdentity } = require('./identityVerificationStore');
const { ensureWebAuthnCredentialAvailable } = require('./webauthnCredentialRegistrationService');
const { IDENTITY_PROVIDERS } = require('../constants/identityVerification');

function normalizePasskeyRegistration(registration) {
  if (!registration || registration.authMethod !== 'passkey' || !registration.passkey) {
    throw new Error('Registrazione passkey mancante');
  }
  if (registration.privacyPolicyConsent !== true || registration.termsOfServiceConsent !== true) {
    const error = new Error('Privacy Policy e Termini devono essere accettati');
    error.code = 'REGISTRATION_CONSENT_REQUIRED';
    throw error;
  }

  const passkey = registration.passkey;
  const normalized = {
    registrationKey: String(passkey.registrationKey || '').trim(),
    userHandle: String(passkey.userHandle || '').trim(),
    credentialId: String(passkey.credentialId || '').trim(),
    publicKey: String(passkey.publicKey || '').trim(),
    counter: Number(passkey.counter),
    deviceId: passkey.deviceId || null,
  };
  if (
    !normalized.registrationKey || !normalized.userHandle || !normalized.credentialId ||
    !normalized.publicKey || !Number.isSafeInteger(normalized.counter) || normalized.counter < 0
  ) {
    throw new Error('Dati passkey verificati mancanti o non validi');
  }

  return {
    passkey: normalized,
    location: registration.location || {},
    privacyPolicyConsent: true,
    termsOfServiceConsent: true,
    politicalOpinionsConsent: registration.politicalOpinionsConsent === true,
    ipAddress: registration.ipAddress || null,
    userAgent: registration.userAgent || null,
  };
}

async function completePasskeyRegistrationAfterCie(
  { registration, fiscalNumber },
  pool = getPool()
) {
  const normalized = normalizePasskeyRegistration(registration);
  if (typeof fiscalNumber !== 'string' || !fiscalNumber.trim()) {
    throw new Error('Claim fiscal_number CIE mancante');
  }

  const location = compressUserLocation({
    paese_residenza: normalized.location.paese_residenza || null,
    regione_residenza: normalized.location.regione_residenza || null,
    provincia_residenza: normalized.location.provincia_residenza || null,
    comune_residenza: normalized.location.comune_residenza || null,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const p = normalized.passkey;

    const existingId = await client.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [p.registrationKey]);
    if (existingId.rows.length > 0) {
      const error = new Error('Registrazione passkey gia completata');
      error.code = 'PASSKEY_REGISTRATION_ALREADY_COMPLETED';
      throw error;
    }

    const credentialAvailable = await ensureWebAuthnCredentialAvailable(client, p.credentialId);
    if (!credentialAvailable) {
      const error = new Error('Passkey gia associata a un account');
      error.code = 'PASSKEY_CREDENTIAL_ALREADY_REGISTERED';
      throw error;
    }

    if (p.deviceId) {
      const device = await client.query(
        'SELECT id FROM users WHERE webauthn_device_id = $1 LIMIT 1',
        [p.deviceId]
      );
      if (device.rows.length > 0) {
        const error = new Error('Questo browser ha gia un account');
        error.code = 'DEVICE_ALREADY_REGISTERED';
        throw error;
      }
    }

    await client.query(
      `INSERT INTO users (
        id, ruolo, webauthn_user_handle, webauthn_credential_id, webauthn_public_key,
        webauthn_sign_count, webauthn_device_id, status,
        paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
        privacy_policy_consent, terms_of_service_consent, consent_timestamp,
        created_at, updated_at
      ) VALUES (
        $1, 'E', $2, $3, $4, $5, $6, 'a',
        $7, $8, $9, $10, true, true, NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        p.registrationKey, p.userHandle, p.credentialId, p.publicKey, p.counter, p.deviceId,
        location.paese_residenza ?? null, location.regione_residenza ?? null,
        location.provincia_residenza ?? null, location.comune_residenza ?? null,
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
        p.registrationKey, location.paese_residenza ?? null, location.regione_residenza ?? null,
        location.provincia_residenza ?? null, location.comune_residenza ?? null,
      ]
    );

    const consentTimestamp = new Date().toISOString();
    await client.query(
      `INSERT INTO user_consents (
        user_id, privacy_policy_consent, terms_of_service_consent, consent_timestamp,
        political_opinions_consent, political_opinions_consent_timestamp,
        political_opinions_consent_ip_address, political_opinions_consent_user_agent
      ) VALUES ($1, true, true, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        privacy_policy_consent = true, terms_of_service_consent = true,
        consent_timestamp = EXCLUDED.consent_timestamp,
        political_opinions_consent = EXCLUDED.political_opinions_consent,
        political_opinions_consent_timestamp = EXCLUDED.political_opinions_consent_timestamp,
        political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
        political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
        updated_at = NOW()`,
      [
        p.registrationKey,
        consentTimestamp,
        normalized.politicalOpinionsConsent,
        normalized.politicalOpinionsConsent ? consentTimestamp : null,
        normalized.politicalOpinionsConsent ? normalized.ipAddress : null,
        normalized.politicalOpinionsConsent ? normalized.userAgent : null,
      ]
    );

    if (normalized.politicalOpinionsConsent) {
      await client.query(
        `UPDATE users SET political_opinions_consent = true,
          political_opinions_consent_timestamp = NOW(),
          political_opinions_consent_ip_address = $1,
          political_opinions_consent_user_agent = $2, updated_at = NOW()
         WHERE id = $3`,
        [normalized.ipAddress, normalized.userAgent, p.registrationKey]
      );
    }

    await registerVerifiedIdentity(
      { userId: p.registrationKey, fiscalNumber, provider: IDENTITY_PROVIDERS.CIE },
      client
    );

    await client.query('COMMIT');
    return { userId: p.registrationKey, role: 'E', created: true, hasPasskey: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  normalizePasskeyRegistration,
  completePasskeyRegistrationAfterCie,
};
