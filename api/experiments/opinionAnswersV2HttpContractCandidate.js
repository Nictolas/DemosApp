'use strict';

/**
 * RESEARCH-ONLY in-process HTTP contract. Never imported by runtime server.
 * All injected operations are fake in CI. This layer must not issue SQL
 * directly, skip Art.9 consent, or open access during a GDPR/B2 restore.
 *
 * Integration requires: verifyToken/subject ownership, atomic authorized
 * read after consent check, external restore-readiness, static catalog.
 */
const express=require('express');
const {isHybridReadWithGate}=require('./opinionAnswersV2AuthorizedReadCandidate');
const {
  formatHybridLegacyGradePayload
}=require('./opinionAnswersV2HybridCandidate');
const {
  publishHybridSurveyStats
}=require('./opinionAnswersV2AggregateCandidate');
const {
  publishHybridDemographicBreakdown
}=require('./opinionAnswersV2DemographicsCandidate');
const {MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE:MINIMUM}=
  require('../utils/politicalAggregatePrivacy');

function createHybridHttpResearchRouter(deps){
  const needed=[
    'getGradeOpinions','getPublishedOpinion','resolveGrade',
    'authenticate','assertRestoreReady','loadOwnAuthorizedRow',
    'querySingleAggregate','queryDemographic'
  ];
  if(!deps || needed.some(key=>typeof deps[key]!=='function') ||
      !Array.isArray(deps.immutableLegacyIds)){
    throw new TypeError('Required research HTTP dependencies missing');
  }
  // Personal reads must be created by the consent-gated reader factory
  // with exactly the SAME external restore gate used by public stats.
  // This prevents a future integration from injecting an unguarded loader.
  if(!isHybridReadWithGate(deps.loadOwnAuthorizedRow,deps.assertRestoreReady)){
    throw new TypeError('Personal reader must enforce shared external GDPR gate');
  }
  // Pin trusted dependencies at router creation. Never dereference a
  // mutable deps object's reader/gate at request time after validation.
  const personalReader=deps.loadOwnAuthorizedRow;
  const externalRestoreGate=deps.assertRestoreReady;
  const router=express.Router();
  function handle(callback){
    return (req,res)=>{
      Promise.resolve().then(()=>callback(req,res)).catch(error=>{
        // Never reflect SQL or political values into public HTTP error body.
        if(res.headersSent)return;
        const status=error?.code==='RESTORE_NOT_READY'?503:500;
        res.status(status).json({
          success:false,
          error:status===503?'Servizio temporaneamente non disponibile':'Errore interno del server'
        });
      });
    };
  }
  router.get('/opinioni-list',handle(async(req,res)=>{
    // No user-data query, ever, until authentication and GDPR gate.
    const principal=await deps.authenticate(req);
    if(!principal || typeof principal.userId!=='string' || !principal.userId){
      return res.status(401).json({success:false,error:'Autenticazione richiesta'});
    }
    if(typeof req.query.grado!=='string'||!req.query.grado.trim()){
      return res.status(400).json({
        success:false,error:'Grado richiesto',
        message:'Il parametro grado è obbligatorio'
      });
    }
    const grade=deps.resolveGrade(req.query.grado);
    if(typeof grade!=='string'||!grade)return res.status(400).json({
      success:false,error:'Grado non valido'
    });
    const published=deps.getGradeOpinions(grade);
    if(!Array.isArray(published))throw Error('Invalid versioned catalog');
    if(!published.length)return res.json({
      success:true,data:[],
      message:'Nessuna opinione trovata per il grado: '+req.query.grado
    });
    // The trusted personal reader checks the SAME restore gate internally.
    // Calling it again here would duplicate the external attestation read.
    // Must be one authorized subject-specific read, with consent checked
    // by the injected service in the SAME DB snapshot/transaction.
    const result=await personalReader(principal.userId);
    if(!result || !['ok','forbidden','missing'].includes(result.status)){
      throw Error('Invalid consent/subject result');
    }
    if(result.status==='forbidden'){
      return res.status(403).json({success:false,error:'Consenso richiesto'});
    }
    if(result.status==='missing'){
      return res.status(404).json({success:false,error:'Utente non trovato'});
    }
    const row=result.row||null;
    if(row && row.user_id!==principal.userId){
      // Fail closed against broken subject binding / accidental IDOR.
      throw Error('Authorized answer row belongs to a different subject');
    }
    return res.json(formatHybridLegacyGradePayload(
      row,published,deps.immutableLegacyIds,req.query.grado
    ));
  }));

  router.get('/stats/:opinionId',handle(async(req,res)=>{
    const op=deps.getPublishedOpinion(req.params.opinionId);
    if(!op || op.id!==req.params.opinionId){
      return res.status(404).json({
        success:false,error:'Opinione non trovata',
        message:'L\'opinione richiesta non è supportata'
      });
    }
    await externalRestoreGate();
    // The injected query MUST filter political consent and account type.
    // Never load personal rows for public aggregation.
    const rows=await deps.querySingleAggregate(op.id);
    const released=publishHybridSurveyStats(rows,new Set([op.id]));
    const counts=released[op.id];
    if(!counts){
      return res.json({
        success:true,data:{suppressed:true,minimumCellSize:MINIMUM,questionText:op.text}
      });
    }
    return res.json({
      success:true,data:{
        suppressed:false,minimumCellSize:MINIMUM,
        stats:counts,questionText:op.text,
        totaleUtenti:counts.favorevole+counts.contrario+counts.indeciso
      }
    });
  }));

  for(const [suffix,dimension] of [['eta','eta'],['genere','sesso']]){
    router.get('/stats/:opinionId/'+suffix,handle(async(req,res)=>{
      const op=deps.getPublishedOpinion(req.params.opinionId);
      if(!op || op.id!==req.params.opinionId){
        return res.status(404).json({success:false,error:'Opinione non trovata'});
      }
      await externalRestoreGate();
      const rows=await deps.queryDemographic(op.id,dimension);
      const released=publishHybridDemographicBreakdown(rows,dimension);
      const data=dimension==='sesso'
        ? released.data.map(({sesso,...rest})=>({
            genere:sesso==='M'?'Uomo':'Donna',...rest
          }))
        : released.data;
      // Legacy API returns minimumCellSize and data array, not a new
      // response envelope that could break existing Android consumers.
      return res.json({success:true,minimumCellSize:MINIMUM,data});
    }));
  }
  return router;
}
module.exports={createHybridHttpResearchRouter};
