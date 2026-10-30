'use strict';

/**
 * Experimental response-shape adapter only. NOT wired to HTTP routes.
 * The caller MUST authenticate the subject, confirm active account, consent
 * and GDPR restore-readiness BEFORE reading or passing political answers.
 *
 * Existing GET /api/opinioni-list and /api/opinioni/opinioni-list return:
 * {success:true,data:[{id,text,grado,userAnswer}],grado,total}.
 * No catalog database query is needed because the published array is in code.
 */
const VALID=new Set(['f','c','i']);
const ID=/^[a-z][a-z0-9_]{0,62}$/;
function projectAnswers(published,stored) {
  if(!Array.isArray(published)|| !stored || typeof stored!=='object' ||
     Array.isArray(stored)) throw new TypeError('Invalid opinion projection input');
  const seen=new Set();
  return published.map(op=>{
    if(!op || typeof op.id!=='string' || !ID.test(op.id) ||
       typeof op.text!=='string' || !op.text.trim() ||
       !Array.isArray(op.gradi_opinione) || seen.has(op.id)){
      throw new TypeError('Invalid or duplicate published opinion');
    }
    seen.add(op.id);
    const raw=Object.prototype.hasOwnProperty.call(stored,op.id)?stored[op.id]:null;
    if(raw!==null && !VALID.has(raw))throw new TypeError('Malformed stored answer');
    return {id:op.id,text:op.text,grado:op.gradi_opinione.slice(),userAnswer:raw};
  });
}
function formatOpinioniList(published,stored,grade) {
  if(typeof grade!=='string'||!grade.trim())throw new TypeError('Grade required');
  const data=projectAnswers(published,stored);
  return {success:true,data,grado:grade,total:data.length};
}
module.exports={projectAnswers,formatOpinioniList};
