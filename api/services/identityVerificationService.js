const crypto = require('crypto');

const FISCAL_NUMBER_PREFIX = 'TINIT-';
const PERSON_KEY_DOMAIN = 'demos-person-v1:';
const MIN_SECRET_BYTES = 32;

/**
 * Normalizza il claim fiscal_number restituito da CIE/SPID OIDC.
 * Le specifiche ammettono il formato TINIT-<CodiceFiscale>.
 *
 * Il codice fiscale normalizzato viene usato solo in memoria per derivare
 * person_key e non deve essere scritto nei log o persistito in chiaro.
 */
function normalizeFiscalNumber(value) {
  if (typeof value !== 'string') {
    throw new TypeError('fiscal_number deve essere una stringa');
  }

  let normalized = value.trim().toUpperCase();
  if (normalized.startsWith(FISCAL_NUMBER_PREFIX)) {
    normalized = normalized.slice(FISCAL_NUMBER_PREFIX.length);
  }

  normalized = normalized.replace(/\s+/g, '');

  // Valida solo la forma alfanumerica di 16 caratteri.
  // Non tenta una validazione anagrafica del codice fiscale.
  if (!/^[A-Z0-9]{16}$/.test(normalized)) {
    throw new Error('fiscal_number non valido');
  }

  return normalized;
}

function getIdentityHmacSecret(explicitSecret) {
  const secret = explicitSecret || process.env.IDENTITY_HMAC_SECRET;

  if (!secret) {
    throw new Error('IDENTITY_HMAC_SECRET non configurato');
  }

  if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(`IDENTITY_HMAC_SECRET deve essere lungo almeno ${MIN_SECRET_BYTES} byte`);
  }

  return secret;
}

/**
 * Deriva un identificatore pseudonimo deterministico della persona.
 *
 * IMPORTANTE:
 * - non usare SHA-256 semplice del codice fiscale;
 * - non salvare il codice fiscale in chiaro;
 * - non loggare fiscal_number o person_key;
 * - la chiave HMAC deve essere conservata separatamente dal database.
 */
function derivePersonKey(fiscalNumber, explicitSecret) {
  const normalized = normalizeFiscalNumber(fiscalNumber);
  const secret = getIdentityHmacSecret(explicitSecret);

  return crypto
    .createHmac('sha256', secret)
    .update(`${PERSON_KEY_DOMAIN}${normalized}`, 'utf8')
    .digest('hex');
}

module.exports = {
  FISCAL_NUMBER_PREFIX,
  PERSON_KEY_DOMAIN,
  MIN_SECRET_BYTES,
  normalizeFiscalNumber,
  derivePersonKey
};
