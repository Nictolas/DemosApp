'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {
  resolveRegionSlug,createHybridRegionalHttpResearchRouter
}=require('../experiments/opinionAnswersV2RegionalHttpCandidate');

const opinions=[
  {id:'opinione_0',text:'Domanda storica',gradi_opinione:['N']},
  {id:'opinione_94',text:'Nuova domanda',gradi_opinione:['N']}
];

test('region slugs come from code registry, not user SQL strings',()=>{
  assert.deepEqual(resolveRegionSlug('toscana'),{code:'TO',name:'Toscana'});
  assert.deepEqual(resolveRegionSlug('emilia-romagna'),{code:'ER',name:'Emilia-Romagna'});
  assert.deepEqual(resolveRegionSlug('friuli-venezia-giulia'),{
    code:'FG',name:'Friuli-Venezia Giulia'
  });
  assert.deepEqual(resolveRegionSlug('valle-d-aosta'),{code:'VA',name:"Valle d'Aosta"});
  assert.equal(resolveRegionSlug("toscana' OR TRUE --"),null);
  assert.equal(resolveRegionSlug('../toscana'),null);
  assert.equal(resolveRegionSlug('TO'),null);
  assert.equal(resolveRegionSlug('does-not-exist'),null);
});

test('regional Express HTTP routes use synthetic aggregates with GDPR gate',
  async t=>{
    const state={
      ready:true,answers:10,sexSmall:false,queryCalls:[],demographicCalls:[],
      gates:0,spoof:false
    };
    const deps={
      getPublishedOpinion:id=>opinions.find(op=>op.id===id)||null,
      assertRestoreReady:async()=>{
        state.gates++;
        if(!state.ready){
          const e=Error('external GDPR replay is incomplete');
          e.code='RESTORE_NOT_READY';throw e;
        }
      },
      querySingleRegionalAggregate:async(id,code)=>{
        state.queryCalls.push([id,code]);
        return [{
          opinion_id:state.spoof?'opinione_archived':id,
          favorevole:state.answers===10?10:9,
          contrario:10,indeciso:10
        }];
      },
      queryRegionalDemographic:async(id,dimension,code)=>{
        state.demographicCalls.push([id,dimension,code]);
        if(dimension==='eta')return [
          {fascia_eta:'18-25',favorevole:10,contrario:10,indeciso:10},
          {fascia_eta:'26-35',favorevole:10,contrario:10,indeciso:10}
        ];
        return [
          {sesso:'F',favorevole:state.sexSmall?9:10,contrario:10,indeciso:10},
          {sesso:'M',favorevole:10,contrario:10,indeciso:10}
        ];
      }
    };
    const app=express();
    app.disable('x-powered-by');
    app.use('/api/opinioni',createHybridRegionalHttpResearchRouter(deps));
    const server=await new Promise((resolve,reject)=>{
      const s=app.listen(0,'127.0.0.1',()=>resolve(s));
      s.once('error',reject);
    });
    const base='http://127.0.0.1:'+server.address().port;
    async function request(path){
      const response=await fetch(base+'/api/opinioni'+path);
      return {status:response.status,json:await response.json()};
    }
    try{
      await t.test('future opinion /regione/toscana preserves exact public JSON',async()=>{
        const response=await request('/stats/opinione_94/regione/toscana');
        assert.equal(response.status,200);
        assert.deepEqual(response.json,{
          success:true,data:{
            suppressed:false,minimumCellSize:10,
            questionText:'Nuova domanda',regione:'Toscana',
            stats:{favorevole:10,contrario:10,indeciso:10},
            totaleUtenti:30
          }
        });
        assert.deepEqual(state.queryCalls.at(-1),['opinione_94','TO']);
      });
      await t.test('old opinion keeps same query/response shape',async()=>{
        const response=await request('/stats/opinione_0/regione/emilia-romagna');
        assert.equal(response.status,200);
        assert.equal(response.json.data.regione,'Emilia-Romagna');
        assert.equal(response.json.data.totaleUtenti,30);
        assert.deepEqual(state.queryCalls.at(-1),['opinione_0','ER']);
      });
      await t.test('minority answer category under ten is suppressed despite a region total of 29',async()=>{
        state.answers=9;
        const hidden=await request('/stats/opinione_94/regione/toscana');
        assert.deepEqual(hidden.json,{
          success:true,data:{
            suppressed:true,minimumCellSize:10,
            questionText:'Nuova domanda',regione:'Toscana'
          }
        });
        assert.doesNotMatch(JSON.stringify(hidden.json),/totaleUtenti|favorevole/);
        state.answers=10;
      });
      await t.test('regional /eta and /genere preserve legacy gender codes',async()=>{
        const age=await request('/stats/opinione_94/eta/regione/toscana');
        assert.deepEqual(age.json,{
          success:true,minimumCellSize:10,
          data:[
            {fascia_eta:'18-25',favorevole:10,contrario:10,indeciso:10},
            {fascia_eta:'26-35',favorevole:10,contrario:10,indeciso:10}
          ]
        });
        const sex=await request('/stats/opinione_94/genere/regione/toscana');
        assert.deepEqual(sex.json,{
          success:true,minimumCellSize:10,
          data:[
            {genere:'d',favorevole:10,contrario:10,indeciso:10},
            {genere:'u',favorevole:10,contrario:10,indeciso:10}
          ]
        });
        assert.deepEqual(state.demographicCalls.at(-1),['opinione_94','sesso','TO']);
      });
      await t.test('a demographic category of 9 hides entire group even when group has 29',async()=>{
        state.sexSmall=true;
        const sex=await request('/stats/opinione_94/genere/regione/toscana');
        assert.deepEqual(sex.json,{success:true,minimumCellSize:10,data:[]});
        assert.doesNotMatch(JSON.stringify(sex.json),/9|Uomo|Donna|genere/);
        state.sexSmall=false;
      });
      await t.test('invalid region 400 and archived opinion 404 before query',async()=>{
        const before=state.queryCalls.length;
        const invalid=await request('/stats/opinione_94/regione/not-a-real-region');
        assert.equal(invalid.status,400);
        assert.equal(invalid.json.error,'Regione non valida');
        const stale=await request('/stats/opinione_archived/regione/toscana');
        assert.equal(stale.status,404);
        assert.equal(state.queryCalls.length,before);
      });
      await t.test('restore gate blocks public regional reads and demographic reads',async()=>{
        state.ready=false;
        const reads=state.queryCalls.length;
        const demographics=state.demographicCalls.length;
        const a=await request('/stats/opinione_94/regione/toscana');
        const b=await request('/stats/opinione_94/eta/regione/toscana');
        assert.equal(a.status,503);
        assert.equal(b.status,503);
        assert.equal(state.queryCalls.length,reads);
        assert.equal(state.demographicCalls.length,demographics);
        state.ready=true;
      });
      await t.test('invalid consent-filtered aggregate ID fails closed without data',async()=>{
        state.spoof=true;
        const response=await request('/stats/opinione_94/regione/toscana');
        assert.equal(response.status,500);
        assert.equal(response.json.error,'Errore interno del server');
        assert.doesNotMatch(JSON.stringify(response.json),/opinione_archived|favorevole/);
        state.spoof=false;
      });
    }finally{
      await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    }
  }
);
