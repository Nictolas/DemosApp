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
  // Una verifica CIE firmata prevale sempre sull'eventuale valore storico.
  // La chiamata avviene nella transazione di verifica identita', lato server.
  const result = await client.query(
    `UPDATE users SET sesso = $1, updated_at = NOW()
     WHERE id = $2
       AND account_type = 'PERSON'`,
    [sesso, userId]
  );
  if (result.rowCount !== 1) {
    throw new Error('Account inesistente o non PERSON');
  }
  return true;
}

module.exports = { sexFromVerifiedCieGender, persistVerifiedCieSex };
