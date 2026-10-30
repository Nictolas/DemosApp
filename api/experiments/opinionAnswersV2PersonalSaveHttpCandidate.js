'use strict';

/**
 * RESEARCH ONLY — inactive Express POST /salva compatibility adapter.
 * Authentication, database client and notification handler are injected.
 * No production route imports this module.
 */
const express=require('express');
const {executeAuthorizedHybridPersonalSave}=
  require('./opinionAnswersV2PersonalWriteCandidate');

function createHybridPersonalSaveHttpResearchRouter(deps){
  const needed=[
    'authenticate','acquireClient','assertRestoreReady',
    'getPublishedIds','recordChangeNotifications'
  ];
  if(!deps||needed.some(key=>typeof deps[key]!=='function')||
    !Array.isArray(deps.immutableLegacyIds)){
    throw new TypeError('Personal HTTP save dependencies missing');
  }
  const router=express.Router();
  router.post('/salva',async(req,res)=>{
    try{
      const principal=await deps.authenticate(req);
      if(!principal||typeof principal.userId!=='string'){
        return res.status(401).json({
          success:false,error:'Autenticazione richiesta'
        });
      }
      let body=req.body;
      if(typeof body==='string'){
        try{body=JSON.parse(body);}
        catch(_e){return res.status(400).json({success:false,error:'JSON non valido'});}
      }
      if(!body||typeof body!=='object'||Array.isArray(body)){
        return res.status(400).json({success:false,error:'Dati mancanti'});
      }
      const opinions=Object.prototype.hasOwnProperty.call(body,'opinioni')
        ? body.opinioni:body;
      const published=deps.getPublishedIds();
      // Validate payload BEFORE acquiring any database connection.
      const {sanitizePublishedDelta}=
        require('./opinionAnswersV2Candidate');
      try{sanitizePublishedDelta(opinions,published);}
      catch(_error){
        return res.status(400).json({
          success:false,error:'Nessuna opinione valida da salvare'
        });
      }
      const acquired=await deps.acquireClient();
      if(!acquired||!acquired.client||
        typeof acquired.client.query!=='function'||
        typeof acquired.release!=='function'){
        throw Error('Invalid research database client');
      }
      let result;
      try{
        result=await executeAuthorizedHybridPersonalSave({
          client:acquired.client,
          userId:principal.userId,
          answerPatch:opinions,
          publishedIds:published,
          historicalIds:deps.immutableLegacyIds,
          assertRestoreReady:deps.assertRestoreReady,
          recordChangeNotifications:deps.recordChangeNotifications
        });
      }finally{
        acquired.release();
      }
      return res.json({
        success:true,message:'Opinioni salvate con successo',
        savedCount:result.savedCount,
        errorCount:0,
        notificationsCreated:result.notificationsCreated,
        timestamp:new Date().toISOString()
      });
    }catch(error){
      const status=error?.code==='RESTORE_NOT_READY'?503:
        error?.code==='POLITICAL_CONSENT_REQUIRED'?403:
        error?.code==='SUBJECT_NOT_FOUND'?404:500;
      return res.status(status).json({
        success:false,
        error:status===503?'Servizio temporaneamente non disponibile':
          status===403?'Consenso richiesto':
          status===404?'Utente non trovato':'Errore interno del server',
        ...(status===403?{consent_required:true}:{})
      });
    }
  });
  return router;
}
module.exports={createHybridPersonalSaveHttpResearchRouter};
