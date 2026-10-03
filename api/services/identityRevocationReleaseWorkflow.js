const {recoverRevocationCapability}=require('./identityRevocationEscrowService');
const {readRevocationEscrow,deleteRevocationEscrowIfVersion}=require('./identityRevocationEscrowStore');
const {authorizeRevocationWithIdentityState}=require('./identityRevocationAuthorizationPolicy');

const releaseRevocationForRelay=async({client,keyProvider,accountId,authorization,relayAccept})=>{
  if(!await authorizeRevocationWithIdentityState({client,accountId,...(authorization||{})})) throw new Error('Authorized Identity revocation required');
  if(typeof relayAccept!=='function') throw new Error('Revocation relay unavailable');
  const row=await readRevocationEscrow(client,{accountId});
  if(!row||!row.envelope) throw new Error('Revocation escrow not found');
  const envelope=typeof row.envelope==='string'?JSON.parse(row.envelope):row.envelope;
  const capability=await recoverRevocationCapability({client,keyProvider,accountId});
  try{
    const accepted=await relayAccept({capability});
    if(accepted!==true) throw new Error('Revocation relay did not accept capability');
    const deleted=await deleteRevocationEscrowIfVersion(client,{accountId,expectedKeyVersion:envelope.keyVersion});
    if(!deleted) throw new Error('Revocation escrow changed before destruction');
    return {released:true,escrowDestroyed:true};
  }finally{
    capability.fill(0);
  }
};
module.exports={releaseRevocationForRelay};
