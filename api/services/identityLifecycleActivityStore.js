const recordLifecycleActivity=async(client,{accountId,at=new Date()})=>{
  if(!client||typeof client.query!=='function'||!accountId) throw new Error('Invalid lifecycle activity write');
  const activity=new Date(at);
  if(!Number.isFinite(activity.getTime())) throw new Error('Invalid lifecycle activity timestamp');
  await client.query(
    `INSERT INTO identity.account_activity (account_id,last_activity_at,updated_at)
     VALUES ($1,$2,NOW())
     ON CONFLICT (account_id) DO UPDATE
     SET last_activity_at=GREATEST(identity.account_activity.last_activity_at,EXCLUDED.last_activity_at),
         updated_at=NOW()`,
    [accountId,activity]
  );
};
const getLifecycleLastActivity=async(client,{accountId})=>{
  if(!client||typeof client.query!=='function'||!accountId) throw new Error('Invalid lifecycle activity lookup');
  const result=await client.query('SELECT last_activity_at FROM identity.account_activity WHERE account_id=$1',[accountId]);
  const value=result.rows?.[0]?.last_activity_at;
  if(!value)return null;
  const activity=new Date(value);
  if(!Number.isFinite(activity.getTime()))throw new Error('Invalid lifecycle activity timestamp');
  return activity;
};
module.exports={recordLifecycleActivity,getLifecycleLastActivity};
