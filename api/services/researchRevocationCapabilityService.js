const crypto=require('crypto');
const digestRevocationCapability=(capability)=>{
  if(!Buffer.isBuffer(capability)||capability.length<32) throw new Error('Invalid revocation capability');
  return crypto.createHash('sha256').update(capability).digest();
};
const revokeWithCapability=async(client,{capability})=>{
  if(!client||typeof client.query!=='function') throw new Error('Research revocation requires PostgreSQL client');
  const digest=digestRevocationCapability(capability);
  const result=await client.query(
    `UPDATE research.participants
     SET status = 'revoked', expires_at = LEAST(expires_at, NOW())
     WHERE revocation_capability_digest = $1
       AND status <> 'revoked'
     RETURNING participant_id`,
    [digest]
  );
  return {revoked:result.rows.length===1};
};
module.exports={digestRevocationCapability,revokeWithCapability};
