const getAuthoritativeLastAccountActivity=async(client,{accountId})=>{
  if(!client||typeof client.query!=='function'||!accountId) throw new Error('Invalid Identity activity lookup');
  const result=await client.query(
    `SELECT MAX(last_activity) AS last_account_activity_at
     FROM active_sessions
     WHERE user_id = $1`,
    [String(accountId)]
  );
  const value=result.rows?.[0]?.last_account_activity_at;
  if(!value) return null;
  const activity=new Date(value);
  if(!Number.isFinite(activity.getTime())) throw new Error('Invalid authoritative account activity');
  return activity;
};
module.exports={getAuthoritativeLastAccountActivity};
