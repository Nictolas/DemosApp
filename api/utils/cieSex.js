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
  // Una verifica CIE firmata prevale sul valore storico. La provenienza CIE
  // e il nuovo M/F sono salvati atomicamente nella stessa transazione della
  // verifica d'identita'. I valori storici rimangono con provenienza NULL.
  // Nessun input del browser puo' impostare sesso_fonte.
  const result = await client.query(
    `UPDATE users SET sesso = $1, sesso_fonte = 'C', updated_at = NOW()
     WHERE id = $2
       AND account_type = 'PERSON'
       AND EXISTS (
         SELECT 1 FROM identity_verifications iv
         WHERE iv.user_id = users.id
           AND iv.provider = 'CIE'
           AND iv.status = 'verified'
           AND iv.detached_at IS NULL
       )`,
    [sesso, userId]
  );
  if (result.rowCount !== 1) {
    throw new Error('Conflitto: Account inesistente o non PERSON oppure verifica CIE assente');
  }
  return true;
}


/**
 * Attestazione corrente, non semplice etichetta di origine: un M/F e' CIE
 * verificato solo se esistono sia il metadato C sia una identita' CIE attiva.
 * Se l'identita' viene staccata, la query torna false senza backfill o cleanup
 * nascosti. Non interpreta retention_until come scadenza dell'identita'.
 */
async function isCurrentlyVerifiedCieSex(client, userId) {
  if (!userId) return false;
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM users u
       JOIN identity_verifications iv ON iv.user_id = u.id
       WHERE u.id = $1
         AND u.account_type = 'PERSON'
         AND u.sesso IN ('M','F')
         AND u.sesso_fonte = 'C'
         AND iv.provider = 'CIE'
         AND iv.status = 'verified'
         AND iv.detached_at IS NULL
     ) AS verified_cie_sex`,
    [userId]
  );
  return result.rows?.[0]?.verified_cie_sex === true;
}

module.exports = { sexFromVerifiedCieGender, persistVerifiedCieSex, isCurrentlyVerifiedCieSex };
