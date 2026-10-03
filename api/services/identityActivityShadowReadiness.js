let schemaReady=false;
const markIdentityActivitySchemaReadyForProcess=()=>{schemaReady=true;};
const resetIdentityActivitySchemaReadyForTests=()=>{schemaReady=false;};
const isIdentityActivitySchemaReady=()=>schemaReady;
const attestIdentityActivitySchema=async(client)=>{
  if(!client||typeof client.query!=='function')return false;
  try{
    const r=await client.query("SELECT to_regclass('identity.account_activity') AS relation");
    if(r.rows?.[0]?.relation==='identity.account_activity'){schemaReady=true;return true;}
  }catch(_error){}
  return false;
};
module.exports={attestIdentityActivitySchema,isIdentityActivitySchemaReady,markIdentityActivitySchemaReadyForProcess,resetIdentityActivitySchemaReadyForTests};
