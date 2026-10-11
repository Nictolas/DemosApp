const { randomUUID } = require('crypto');
const { getPool } = require('../config/database');
const { encrypt: encryptEmail } = require('../utils/emailCrypto');
const { compressUserLocation } = require('../utils/locationUtils');
const { registerVerifiedIdentity } = require('./identityVerificationStore');
const { IDENTITY_PROVIDERS } = require('../constants/identityVerification');

const SUPPORTED_OAUTH_PROVIDERS = new Set(['google', 'apple']);

function normalizeRegistration(registration) {
  if (!registration || typeof registration !== 'object') {
    throw new Error('Registrazione OAuth mancante');
  }

  const provider = String(registration.provider || '').toLowerCase();
  const providerSub = String(registration.providerSub || '').trim();
  if (!SUPPORTED_OAUTH_PROVIDERS.has(provider) || !providerSub) {
    throw new Error('Provider OAuth non valido');
  }
  if (registration.privacyPolicyConsent !== true || registration.termsOfServiceConsent !== true) {
    const error = new Error('Privacy Policy e Termini devono essere accettati');
    error.code = 'REGISTRATION_CONSENT_REQUIRED';
    throw error;
  }

  return {
    provider,
    providerSub,
    email: registration.email || null,
    givenName: registration.givenName || null,
    familyName: registration.familyName || null,
    name: registration.name || null,
    location: registration.location || {},
    privacyPolicyConsent: true,
    termsOfServiceConsent: true,
    politicalOpinionsConsent: registration.politicalOpinionsConsent === true,
    ipAddress: registration.ipAddress || null,
    userAgent: registration.userAgent || null,
  };
}

async function findExistingAccount(client, provider, providerSub) {
  const providerResult = await client.query(
    `SELECT u.id, u.ruolo, u.status
     FROM user_auth_providers uap
     INNER JOIN users u ON u.id = uap.user_id
     WHERE uap.provider = $1 AND uap.provider_user_id = $2
     LIMIT 1`,
    [provider, providerSub]
  );
  if (providerResult.rows.length > 0) return providerResult.rows[0];

  const legacyColumn = provider === 'google' ? 'google_sub' : 'apple_user_id';
  const legacyResult = await client.query(
    `SELECT id, ruolo, status FROM users WHERE ${legacyColumn} = $1 LIMIT 1`,
    [providerSub]
  );
  return legacyResult.rows[0] || null;
}

async function upsertRegistrationData(client, userId, registration, compressedLocation) {
  const consentTimestamp = new Date().toISOString();
  const politicalTimestamp = registration.politicalOpinionsConsent ? consentTimestamp : null;

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
      compressedLocation.paese_residenza ?? null,
      compressedLocation.regione_residenza ?? null,
      compressedLocation.provincia_residenza ?? null,
      compressedLocation.comune_residenza ?? null,
    ]
  );

  await client.query(
    `INSERT INTO user_consents (
      user_id, privacy_policy_consent, terms_of_service_consent, consent_timestamp,
      political_opinions_consent, political_opinions_consent_timestamp,
      political_opinions_consent_ip_address, political_opinions_consent_user_agent
    ) VALUES ($1, true, true, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id) DO UPDATE SET
      privacy_policy_consent = true,
      terms_of_service_consent = true,
      consent_timestamp = EXCLUDED.consent_timestamp,
      political_opinions_consent = EXCLUDED.political_opinions_consent,
      political_opinions_consent_timestamp = EXCLUDED.political_opinions_consent_timestamp,
      political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
      political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
      updated_at = NOW()`,
    [
      userId,
      consentTimestamp,
      registration.politicalOpinionsConsent,
      politicalTimestamp,
      registration.politicalOpinionsConsent ? registration.ipAddress : null,
      registration.politicalOpinionsConsent ? registration.userAgent : null,
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
      registration.provider,
      registration.providerSub,
      JSON.stringify({
        email: registration.email,
        given_name: registration.givenName,
        family_name: registration.familyName,
        name: registration.name,
      }),
    ]
  );

  if (registration.politicalOpinionsConsent) {
    await client.query(
      `UPDATE users SET
        political_opinions_consent = true,
        political_opinions_consent_timestamp = NOW(),
        political_opinions_consent_ip_address = $1,
        political_opinions_consent_user_agent = $2,
        updated_at = NOW()
       WHERE id = $3`,
      [registration.ipAddress, registration.userAgent, userId]
    );
  }
}

async function completeOAuthRegistrationAfterCie(
  { registration, fiscalNumber },
  pool = getPool()
) {
  const normalized = normalizeRegistration(registration);
  if (typeof fiscalNumber !== 'string' || !fiscalNumber.trim()) {
    throw new Error('Claim fiscal_number CIE mancante');
  }

  const compressedLocation = compressUserLocation({
    paese_residenza: normalized.location.paese_residenza || null,
    regione_residenza: normalized.location.regione_residenza || null,
    provincia_residenza: normalized.location.provincia_residenza || null,
    comune_residenza: normalized.location.comune_residenza || null,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await findExistingAccount(client, normalized.provider, normalized.providerSub);
    let userId;
    let role;

    if (existing) {
      if (existing.status !== 'a') throw new Error('Account non attivo');
      userId = existing.id;
      role = existing.ruolo || 'E';

      await client.query(
        `UPDATE users SET
          paese_residenza = $1, regione_residenza = $2, provincia_residenza = $3, comune_residenza = $4,
          privacy_policy_consent = true, terms_of_service_consent = true,
          consent_timestamp = NOW(), updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          compressedLocation.paese_residenza ?? null,
          compressedLocation.regione_residenza ?? null,
          compressedLocation.provincia_residenza ?? null,
          compressedLocation.comune_residenza ?? null,
          userId,
        ]
      );
    } else {
      userId = randomUUID();
      role = 'E';
      const legacyColumn = normalized.provider === 'google' ? 'google_sub' : 'apple_user_id';
      const displayName = normalized.givenName || normalized.name || 'Utente';
      const familyName = normalized.familyName || 'OAuth';
      const emailPlain = normalized.email || `oauth-${normalized.provider}-${normalized.providerSub.replace(/[^a-zA-Z0-9._-]/g, '_')}@demos.oauth`;
      const email = encryptEmail(emailPlain) ?? emailPlain;

      await client.query(
        `INSERT INTO users (
          id, ruolo, status, nome, cognome, email, ${legacyColumn},
          paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
          privacy_policy_consent, terms_of_service_consent, consent_timestamp,
          created_at, updated_at
        ) VALUES (
          $1, $2, 'a', $3, $4, $5, $6,
          $7, $8, $9, $10,
          true, true, NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        [
          userId,
          role,
          displayName,
          familyName,
          email,
          normalized.providerSub,
          compressedLocation.paese_residenza ?? null,
          compressedLocation.regione_residenza ?? null,
          compressedLocation.provincia_residenza ?? null,
          compressedLocation.comune_residenza ?? null,
        ]
      );
    }

    await upsertRegistrationData(client, userId, normalized, compressedLocation);

    // Critical invariant: the account transaction commits only if CIE uniqueness succeeds.
    await registerVerifiedIdentity(
      { userId, fiscalNumber, provider: IDENTITY_PROVIDERS.CIE },
      client
    );

    await client.query('COMMIT');
    return { userId, role, created: !existing };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  normalizeRegistration,
  completeOAuthRegistrationAfterCie,
};
