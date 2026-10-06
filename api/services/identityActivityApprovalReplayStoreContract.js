const crypto=require('crypto');
const digestApprovalNonce=(nonce)=>crypto.createHash('sha256').update('demos:identity-activity-approval-nonce:v2\0'+String(nonce),'utf8').digest('hex');
const createApprovalReplayStore=({consumeDigestOnce})=>{
 if(typeof consumeDigestOnce!=='function')throw new Error('Atomic replay store operation required');
 return Object.freeze({consumeOnce:async(nonce,{ttlSeconds}={})=>{
  if(typeof nonce!=='string'||nonce.length<16)throw new Error('Valid approval nonce required');
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600)throw new Error('Valid replay TTL required');
  const result=await consumeDigestOnce({digest:digestApprovalNonce(nonce),ttlSeconds});
  if(result!==true&&result!==false)throw new Error('Invalid replay store result');
  return result;
 }});
};
module.exports={digestApprovalNonce,createApprovalReplayStore};
