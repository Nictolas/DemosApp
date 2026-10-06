const {getActiveEscrowKey,getEscrowKeyByVersion}=require('./identityRevocationEscrowKeyProvider');
const {storeRevocationEscrow,readRevocationEscrow,replaceRevocationEscrowIfVersion}=require('./identityRevocationEscrowStore');

const loadEnvelopeModule=()=>import('./identityRevocationEscrowEnvelope.js');

const sealAndStoreRevocationCapability=async({client,keyProvider,accountId,capability})=>{
  const {key,keyVersion}=await getActiveEscrowKey(keyProvider);
  const {sealRevocationCapability}=await loadEnvelopeModule();
  const envelope=sealRevocationCapability({capability,accountId,key,keyVersion});
  await storeRevocationEscrow(client,{accountId,envelope});
  return {keyVersion};
};

const recoverRevocationCapability=async({client,keyProvider,accountId})=>{
  const row=await readRevocationEscrow(client,{accountId});
  if(!row||!row.envelope) throw new Error('Revocation escrow not found');
  const envelope=typeof row.envelope==='string'?JSON.parse(row.envelope):row.envelope;
  const key=await getEscrowKeyByVersion(keyProvider,envelope.keyVersion);
  const {openRevocationCapability}=await loadEnvelopeModule();
  return openRevocationCapability({envelope,accountId,key});
};

const rotateRevocationEscrow=async({client,keyProvider,accountId})=>{
  const row=await readRevocationEscrow(client,{accountId});
  if(!row||!row.envelope) throw new Error('Revocation escrow not found');
  const envelope=typeof row.envelope==='string'?JSON.parse(row.envelope):row.envelope;
  const active=await getActiveEscrowKey(keyProvider);
  if(envelope.keyVersion===active.keyVersion) return {rotated:false,keyVersion:active.keyVersion};
  const oldKey=await getEscrowKeyByVersion(keyProvider,envelope.keyVersion);
  const {openRevocationCapability,sealRevocationCapability}=await loadEnvelopeModule();
  const capability=openRevocationCapability({envelope,accountId,key:oldKey});
  try{
    const next=sealRevocationCapability({capability,accountId,key:active.key,keyVersion:active.keyVersion});
    const replaced=await replaceRevocationEscrowIfVersion(client,{accountId,expectedKeyVersion:envelope.keyVersion,envelope:next});
    if(!replaced) throw new Error('Revocation escrow changed concurrently');
    return {rotated:true,keyVersion:active.keyVersion};
  }finally{
    capability.fill(0);
  }
};
module.exports={sealAndStoreRevocationCapability,recoverRevocationCapability,rotateRevocationEscrow};
