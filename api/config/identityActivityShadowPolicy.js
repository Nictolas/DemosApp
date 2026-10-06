const isIdentityActivityShadowEnabled=()=>process.env.IDENTITY_ACTIVITY_SHADOW_DUAL_WRITE==='true';
module.exports={isIdentityActivityShadowEnabled};
