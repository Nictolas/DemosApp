const storeRevocationEscrow=async(client,{accountId,envelope})=>{
  if(!client||typeof client.query!=='function') throw new Error('Identity revocation escrow requires PostgreSQL client');
  if(!accountId||!envelope||envelope.version!==1||!Number.isSafeInteger(envelope.keyVersion)||envelope.keyVersion<1) throw new Error('Invalid revocation escrow');
  const stored={version:envelope.version,keyVersion:envelope.keyVersion,iv:envelope.iv,ciphertext:envelope.ciphertext,authTag:envelope.authTag};
  const result=await client.query(
    `INSERT INTO identity.revocation_escrows (account_id, envelope, key_version)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (account_id) DO UPDATE
     SET envelope = EXCLUDED.envelope, key_version = EXCLUDED.key_version, updated_at = NOW()
     RETURNING key_version, updated_at`,
    [accountId,JSON.stringify(stored),envelope.keyVersion]
  );
  return result.rows[0]||null;
};
const readRevocationEscrow=async(client,{accountId})=>{
  if(!client||typeof client.query!=='function'||!accountId) throw new Error('Invalid revocation escrow lookup');
  const result=await client.query(`SELECT envelope, key_version FROM identity.revocation_escrows WHERE account_id = $1`,[accountId]);
  return result.rows[0]||null;
};
module.exports={storeRevocationEscrow,readRevocationEscrow};
