const MAX_INACTIVITY_DAYS=365;
const MAX_INACTIVITY_MS=MAX_INACTIVITY_DAYS*24*60*60*1000;

const authorizeRevocation=({reason,selfDeletionConfirmed=false,lastAccountActivityAt,deceasedVerified=false,now=new Date()})=>{
  if(reason==='self-delete') return selfDeletionConfirmed===true;
  if(reason==='deceased') return deceasedVerified===true;
  if(reason==='inactive'){
    const activity=new Date(lastAccountActivityAt),current=new Date(now);
    if(!Number.isFinite(activity.getTime())||!Number.isFinite(current.getTime())||activity.getTime()>current.getTime()) return false;
    return current.getTime()-activity.getTime()>=MAX_INACTIVITY_MS;
  }
  return false;
};
const authorizeRevocationWithIdentityState=async({client,accountId,reason,selfDeletionConfirmed=false,deceasedVerified=false,now=new Date()})=>{
  if(reason!=='inactive') return authorizeRevocation({reason,selfDeletionConfirmed,deceasedVerified,now});
  const {getAuthoritativeLastAccountActivity}=require('./identityAccountActivityStore');
  const lastAccountActivityAt=await getAuthoritativeLastAccountActivity(client,{accountId});
  if(!lastAccountActivityAt) return false;
  return authorizeRevocation({reason,lastAccountActivityAt,now});
};
module.exports={MAX_INACTIVITY_DAYS,authorizeRevocation,authorizeRevocationWithIdentityState};
