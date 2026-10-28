'use strict';

/**
 * Il sesso anagrafico canonico deriva SOLO dal claim "gender" in una
 * UserInfo CIE la cui firma, issuer, audience e sub sono stati verificati.
 * Non accetta nomi, foto, payload browser o valori legacy "genere".
 */
function sexFromVerifiedCieGender(gender) {
  if (gender === 'male') return 'M';
  if (gender === 'female') return 'F';
  return null;
}

/** Da chiamare nella stessa transazione della registrazione/verifica CIE. */
async function persistVerifiedCieSex(client, userId, sesso) {
  if (sesso == null) return false;
  if (sesso !== 'M' && sesso !== 'F') {
    throw new Error('Valore sesso CIE non valido');
  }
  const result = await client.query(
    `UPDATE users SET sesso = $1, updated_at = NOW()
     WHERE id = $2
       AND account_type = 'PERSON'
       AND (sesso IS NULL OR sesso = $1)`,
    [sesso, userId]
  );
  if (result.rowCount !== 1) {
    throw new Error('Conflitto sesso anagrafico, account inesistente o non PERSON');
  }
  return true;
}

module.exports = { sexFromVerifiedCieGender, persistVerifiedCieSex };
