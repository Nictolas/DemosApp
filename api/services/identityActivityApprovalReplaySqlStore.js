const createSqlApprovalReplayStore=({client,now=()=>new Date()})=>{
 if(!client||typeof client.query!=='function')throw new Error('Replay SQL client required');
 return Object.freeze({consumeDigestOnce:async({digest,ttlSeconds})=>{
  if(!/^[0-9a-f]{64}$/.test(String(digest)))throw new Error('Opaque replay digest required');
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600)throw new Error('Valid replay TTL required');
  const at=new Date(now());if(!Number.isFinite(at.getTime()))throw new Error('Valid replay clock required');
  const expires=new Date(at.getTime()+ttlSeconds*1000);
  const result=await client.query(`INSERT INTO identity.cutover_approval_replays (nonce_digest,expires_at,created_at)
    VALUES ($1,$2,$3)
    ON CONFLICT (nonce_digest) DO UPDATE
      SET expires_at=EXCLUDED.expires_at, created_at=EXCLUDED.created_at
      WHERE identity.cutover_approval_replays.expires_at <= EXCLUDED.created_at
    RETURNING nonce_digest`,[String(digest),expires,at]);
  return result.rowCount===1;
 }});
};
module.exports={createSqlApprovalReplayStore};
