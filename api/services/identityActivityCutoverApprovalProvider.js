const createApprovalVerifier=({verify})=>{if(typeof verify!=='function')throw new Error('Approval verifier required');return Object.freeze({verify:async(input)=>verify(input)});};
module.exports={createApprovalVerifier};
