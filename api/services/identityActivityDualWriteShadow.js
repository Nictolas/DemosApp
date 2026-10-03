const {recordLifecycleActivity}=require('./identityLifecycleActivityStore');

const mirrorLifecycleActivity=async({client,accountId,at=new Date(),onFailure=()=>{}})=>{
  try{
    await recordLifecycleActivity(client,{accountId,at});
    return {mirrored:true};
  }catch(error){
    await onFailure({code:'IDENTITY_ACTIVITY_MIRROR_FAILED'});
    return {mirrored:false};
  }
};
module.exports={mirrorLifecycleActivity};
