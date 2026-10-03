const assertKeyProvider=(provider)=>{
  if(!provider||typeof provider.getActiveKey!=='function'||typeof provider.getKeyByVersion!=='function') throw new Error('Revocation escrow key provider is required');
  return provider;
};
const getActiveEscrowKey=async(provider)=>{
  assertKeyProvider(provider);
  const entry=await provider.getActiveKey();
  if(!entry||!Number.isSafeInteger(entry.keyVersion)||entry.keyVersion<1||!Buffer.isBuffer(entry.key)||entry.key.length!==32) throw new Error('Invalid active escrow key');
  return entry;
};
const getEscrowKeyByVersion=async(provider,keyVersion)=>{
  assertKeyProvider(provider);
  if(!Number.isSafeInteger(keyVersion)||keyVersion<1) throw new Error('Invalid escrow key version');
  const key=await provider.getKeyByVersion(keyVersion);
  if(!Buffer.isBuffer(key)||key.length!==32) throw new Error('Escrow key version unavailable');
  return key;
};
module.exports={assertKeyProvider,getActiveEscrowKey,getEscrowKeyByVersion};
