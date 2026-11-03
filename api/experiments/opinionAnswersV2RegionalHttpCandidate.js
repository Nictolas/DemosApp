'use strict';

/**
 * RESEARCH ONLY. Inactive Express compatibility adapter for three real
 * /stats/:opinionId/.../regione/:regione routes. All data is supplied by
 * injected, consent-filtered aggregate services; no personal-row query.
 */
const express=require('express');
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {publishHybridSurveyStats}=require('./opinionAnswersV2AggregateCandidate');
const {publishHybridDemographicBreakdown}=require('./opinionAnswersV2DemographicsCandidate');
const {MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE:MINIMUM}=
  require('../utils/politicalAggregatePrivacy');

function toSlug(name){
  return name.toLocaleLowerCase('it').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
const CODES=new Map(Object.entries(REGIONI_DB_TO_FRONTEND)
  .map(([code,name])=>[toSlug(name),Object.freeze({code,name})]));

function resolveRegionSlug(raw){
  if(typeof raw!=='string'||raw.length>96||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)){
    return null;
  }
  return CODES.get(raw)||null;
}

function createHybridRegionalHttpResearchRouter(deps){
  const required=[
    'getPublishedOpinion','assertRestoreReady',
    'querySingleRegionalAggregate','queryRegionalDemographic'
  ];
  if(!deps||required.some(name=>typeof deps[name]!=='function')){
    throw new TypeError('Missing regional HTTP research dependencies');
  }
  const router=express.Router();
  const run=callback=>(req,res)=>{
    Promise.resolve().then(()=>callback(req,res)).catch(error=>{
      if(res.headersSent)return;
      const unavailable=error?.code==='RESTORE_NOT_READY';
      res.status(unavailable?503:500).json({
        success:false,
        error:unavailable
          ? 'Servizio temporaneamente non disponibile'
          : 'Errore interno del server'
      });
    });
  };
  function check(req,res){
    const region=resolveRegionSlug(req.params.regione);
    if(!region){
      res.status(400).json({success:false,error:'Regione non valida'});
      return null;
    }
    const op=deps.getPublishedOpinion(req.params.opinionId);
    if(!op||op.id!==req.params.opinionId){
      res.status(404).json({
        success:false,error:'Opinione non trovata',
        message:'L\'opinione richiesta non è supportata'
      });
      return null;
    }
    return {region,op};
  }
  router.get('/stats/:opinionId/regione/:regione',run(async(req,res)=>{
    const info=check(req,res);
    if(!info)return;
    await deps.assertRestoreReady();
    // Must be an aggregate query filtering active Art9 consent and persons,
    // with the region code as a PostgreSQL bind parameter, NOT text SQL.
    const rows=await deps.querySingleRegionalAggregate(
      info.op.id,info.region.code
    );
    const released=publishHybridSurveyStats(rows,new Set([info.op.id]));
    const counts=released[info.op.id];
    const base={
      suppressed:!counts,minimumCellSize:MINIMUM,
      questionText:info.op.text,regione:info.region.name
    };
    return res.json({success:true,data:counts?{
      ...base,stats:counts,
      totaleUtenti:counts.favorevole+counts.contrario+counts.indeciso
    }:base});
  }));

  for(const [suffix,dimension] of [['eta','eta'],['genere','sesso']]){
    router.get('/stats/:opinionId/'+suffix+'/regione/:regione',run(async(req,res)=>{
      const info=check(req,res);
      if(!info)return;
      await deps.assertRestoreReady();
      const rows=await deps.queryRegionalDemographic(
        info.op.id,dimension,info.region.code
      );
      const released=publishHybridDemographicBreakdown(rows,dimension);
      // The *current regional* legacy endpoint exposes compressed
      // 'u'/'d' codes; national endpoint exposes Uomo/Donna. Preserve
      // this difference until mobile clients are explicitly migrated.
      const data=dimension==='sesso'
        ? released.data.map(({sesso,...rest})=>({
            genere:sesso==='M'?'u':'d',...rest
          }))
        : released.data;
      return res.json({success:true,minimumCellSize:MINIMUM,data});
    }));
  }
  return router;
}
module.exports={resolveRegionSlug,createHybridRegionalHttpResearchRouter};
