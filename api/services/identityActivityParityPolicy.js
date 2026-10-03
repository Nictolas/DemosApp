const checkIdentityActivityParity=async(client)=>{
  if(!client||typeof client.query!=='function') throw new Error('Identity activity parity client required');
  const result=await client.query(
    `WITH legacy AS (
       SELECT user_id::text AS account_id, MAX(last_activity) AS last_activity_at
       FROM active_sessions GROUP BY user_id::text
     )
     SELECT
       (SELECT COUNT(*)::int FROM public.users u LEFT JOIN identity.account_activity a ON a.account_id::text=u.id::text WHERE a.account_id IS NULL) AS missing_accounts,
       (SELECT COUNT(*)::int FROM legacy l JOIN identity.account_activity a ON a.account_id::text=l.account_id WHERE a.last_activity_at < l.last_activity_at) AS lagging_accounts`
  );
  const row=result.rows?.[0]||{};
  const missing=Number(row.missing_accounts),lagging=Number(row.lagging_accounts);
  if(!Number.isSafeInteger(missing)||missing<0||!Number.isSafeInteger(lagging)||lagging<0) throw new Error('Invalid Identity activity parity result');
  return {ready:missing===0&&lagging===0,missingAccounts:missing,laggingAccounts:lagging};
};
module.exports={checkIdentityActivityParity};
