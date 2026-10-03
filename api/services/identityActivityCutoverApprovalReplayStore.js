const crypto=require('crypto');
const hashNonce=(nonce)=>crypto.createHash('sha256').update('demos:identity-activity-approval-nonce:v1\0'+String(nonce),'utf8').digest('hex');
const createInMemoryApprovalReplayStore=()=>{
 const used=new Set();
 return Object.freeze({consumeOnce:async(nonce)=>{const key=hashNonce(nonce);if(used.has(key))return false;used.add(key);return true;}});
};
module.exports={hashNonce,createInMemoryApprovalReplayStore};
