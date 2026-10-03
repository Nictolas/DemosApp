const createSqlApprovalReplayStore=({client,now=()=>new Date()})=>{
 if(!client||typeof client.query!=='function')throw new Error('Replay SQL client required');
 return Object.freeze({consumeDigestOnce:async({digest,ttlSeconds})=>{
  if(!/^[0-9a-f]{64}$/.test(String(digest)))throw new Error('Opaque replay digest required');
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600)throw new Error('Valid replay TTL required');
  const at=new Date(now());if(!Number.isFinite(at.getTime()))throw new Error('Valid replay clock required');
  const expires=new Date(at.getTime()+ttlSeconds*1000);
  const result=await client.query('SELECT identity.consume_cutover_approval_replay($1,$2,$3) AS consumed',[String(digest),expires,at]);
  const consumed=result?.rows?.[0]?.consumed;
  if(consumed!==true&&consumed!==false)throw new Error('Invalid replay store result');
  return consumed;
 }});
};
module.exports={createSqlApprovalReplayStore};
