'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeName, memberNameVariants, voteOrder, isRecentFinal, newestByChamber, matchUniqueMember,
  persistLatestForChamber, refreshLatestParliamentVoteNotifications
} = require('../services/parliamentLatestVoteNotificationsService');

const today = new Date().toISOString().slice(0, 10);
const finalVote = (chamber, id, date = today) => ({
  openpolis_id: id, camera: chamber, titolo: 'Votazione finale sintetica',
  data_votazione: date, esito: 'Approvata',
  url_dettaglio: 'https://parlamento19.openpolis.it/votazioni/' + id
});
const members = Array.from({length: 125}, (_, i) =>
  ({ name: 'COMPONENTE PARLAMENTARE ' + i, group: 'GRUPPO', vote: 'Favorevole' }));
members[3] = { name: 'DE LUCA MARIA', group: 'GRUPPO', vote: 'In missione' };
const rep = { id: '00000000-0000-4000-8000-000000000001', nome: 'Maria', cognome: 'De Luca' };

test('one most recent final ballot per chamber; numeric order beats string order on same day', () => {
  const votes = newestByChamber([
    finalVote('Senato', '19-469-3'),
    finalVote('Senato', '19-469-10'),
    finalVote('Camera', 'vs19_730_097'),
    finalVote('Camera', 'vs19_730_096'),
    finalVote('Camera', 'vs19_730_099', '2015-01-01'),
    {...finalVote('Senato','19-469-12'), esito: 'Mozione'}
  ]);
  assert.equal(votes.length, 2);
  assert.equal(votes.find(v => v.camera === 'Senato').openpolis_id, '19-469-10');
  assert.equal(votes.find(v => v.camera === 'Camera').openpolis_id, 'vs19_730_097');
  assert.equal(voteOrder(finalVote('Senato', '19-469-10')), 46900010);
  assert.equal(voteOrder(finalVote('Camera', 'vs19_730_097')), 73000097);
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);
  assert.equal(isRecentFinal(finalVote('Camera', 'vs19_731_001', tomorrow)), false);
});

test('exact, accent-insensitive, order-insensitive name matching only', () => {
  assert.equal(normalizeName('  DÈ LÙCA  '), 'de luca');
  assert.equal(matchUniqueMember(rep, members, [rep]).vote, 'In missione');
  assert.equal(matchUniqueMember({ ...rep, nome:'Mari' }, members, [{ ...rep,nome:'Mari' }]), null);
  assert.equal(matchUniqueMember(rep, members, [rep,{...rep,id:'duplicate'}]), null);
  assert.equal(matchUniqueMember(rep, [...members, {name:'MARIA DE LUCA',group:'GRUPPO',vote:'Contrario'}], [rep]), null);
  assert.equal(matchUniqueMember(rep, [{name:'DE LUCA MARIA',group:'GRUPPO',vote:'Ignoto'}], [rep]), null);
});

test('Peppe De Cristofaro (DEMOS) matches Giuseppe De Cristofaro (Senate) only by explicit vetted alias', () => {
  const peppe={id:'00000000-0000-4000-8000-000000000021',nome:'Peppe',cognome:'De Cristofaro'};
  const other={id:'00000000-0000-4000-8000-000000000022',nome:'Franco',cognome:'Alberti'};
  assert.ok(memberNameVariants(peppe).has('de cristofaro giuseppe'));
  assert.equal(matchUniqueMember(peppe,[
    {name:'De Cristofaro Giuseppe',group:'Misto',vote:'Contrario'}
  ],[peppe,other])?.vote,'Contrario');
  assert.equal(matchUniqueMember(peppe,[
    {name:'De Cristofaro Giuseppe',group:'Misto',vote:'Assente'}
  ],[peppe])?.vote,'Assente');
  assert.equal(matchUniqueMember(peppe,[
    {name:'De Cristofaro Giuseppe',group:'Misto',vote:'Contrario'},
    {name:'Giuseppe De Cristofaro',group:'Misto',vote:'Favorevole'}
  ],[peppe]),null,'duplicates are ambiguous');
  assert.equal(matchUniqueMember(peppe,[
    {name:'De Cristofaro Giuseppe',group:'Misto',vote:'Contrario'}
  ],[peppe,{...peppe,id:'duplicate',nome:'Giuseppe'}]),null,'competing selected representative is ambiguous');
  assert.equal(matchUniqueMember({...peppe,nome:'Peppo'},[
    {name:'De Cristofaro Giuseppe',group:'Misto',vote:'Contrario'}
  ],[{...peppe,nome:'Peppo'}]),null,'not a general nickname approximation');
});

test('verified identity, date, chamber and roster required before any write', async () => {
  let touched = false;
  const fake = { connect: () => { touched = true; throw new Error('unexpected database write'); } };
  const vote = finalVote('Camera', 'vs19_730_097');
  const verified = {voteId:vote.openpolis_id,chamber:'Senato',date:today,
    source:{url:'https://example.org'},members};
  await assert.rejects(persistLatestForChamber(fake,vote,verified,[rep]), /LATEST_VOTE_SOURCE_MISMATCH/);
  assert.equal(touched,false);
});

test('one-row UPSERT resets reactions only when new vote really replaced the old', async () => {
  const queries = [];
  let resultRows = [{ id:'new-note' }];
  const client = {
    query: async (sql, args) => {
      queries.push({sql,args});
      if (sql.includes('INSERT INTO notifiche_voti_parlamento')) return { rows: resultRows };
      return { rows: [] };
    },
    release: () => queries.push({sql:'RELEASE'})
  };
  const vote = finalVote('Camera', 'vs19_730_097');
  const verified = { voteId:vote.openpolis_id,chamber:vote.camera,date:today,
    source:{url:'https://documenti.camera.it/verified'},members };
  let outcome = await persistLatestForChamber({connect:async()=>client}, vote, verified, [rep]);
  assert.equal(outcome.changed,1);
  const upsert = queries.find(q=>q.sql.includes('INSERT INTO'));
  assert.match(upsert.sql,/ON CONFLICT \(id_utente, camera\) DO UPDATE/);
  assert.match(upsert.sql,/vote_order/);
  assert.match(upsert.sql,/COALESCE\(notifiche_voti_parlamento.vote_order, -1\) < EXCLUDED.vote_order/);
  assert.equal(upsert.args[5],'In missione');
  assert.equal(upsert.args[8],vote.openpolis_id);
  assert.equal(queries.filter(q=>q.sql.startsWith('DELETE FROM reazioni')).length,1);
  resultRows = [];
  outcome = await persistLatestForChamber({connect:async()=>client},vote,verified,[rep]);
  assert.equal(outcome.changed,0);
  assert.equal(queries.filter(q=>q.sql.startsWith('DELETE FROM reazioni')).length,1);
});

test('feature remains disabled by default: no reads, writes, network or push', async () => {
  const before=process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
  delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
  try {
    const result = await refreshLatestParliamentVoteNotifications({
      query:()=>{throw Error('unwanted DB read');},connect:()=>{throw Error('unwanted DB write');}
    },{ getVerifiedFinalBallots:()=>{throw Error('unwanted fetch');} });
    assert.deepEqual(result,{enabled:false,checked:0,changed:0});
  } finally {
    if(before===undefined) delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
    else process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=before;
  }
});

test('enabled orchestration uses only selected active representatives and one verified latest source', async () => {
  const before=process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
  process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED='true';
  const queries = [];
  let fetches=0;
  // PostgreSQL DATE is parsed as a JS Date by pg; the validator must get ISO.
  const vote={...finalVote('Camera','vs19_730_097'), data_votazione:new Date(today+'T00:00:00Z')};
  const pool={
    query: async sql=>{
      queries.push(sql);
      if(sql.includes('SELECT openpolis_id')) return {rows:[vote]};
      if(sql.includes('SELECT DISTINCT p.id')) return {rows:[rep]};
      throw Error('unexpected SQL');
    },
    connect:async()=>({
      query:async sql=>({rows:sql.includes('INSERT INTO')?[{id:'new-note'}]:[]}),
      release:()=>{}
    })
  };
  try{
    const outcome=await refreshLatestParliamentVoteNotifications(pool,{
      getVerifiedFinalBallots:async sourceVote=>{
        fetches++;
        assert.equal(sourceVote.data_votazione,today);
        return {voteId:vote.openpolis_id,chamber:vote.camera,date:today,
          source:{url:'https://documenti.camera.it/record'},members};
      }
    });
    assert.equal(fetches,1);
    assert.deepEqual(outcome,{enabled:true,checked:1,changed:1,unavailable:0});
    assert.ok(queries.some(sql=>sql.includes('political_mandates')));
    assert.ok(queries.some(sql=>sql.includes('political_selections ps')));
    assert.ok(queries.some(sql=>sql.includes('ps.selection_kind')));
    assert.ok(queries.some(sql=>sql.includes('follower.status')));
  } finally {
    if(before===undefined) delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
    else process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=before;
  }
});

test('each selected deputy gets their own latest verified final vote, even if missing the chamber latest', async () => {
  const old=process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
  process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED='true';
  const rep2={id:'00000000-0000-4000-8000-000000000010',nome:'Paolo',cognome:'Rossi'};
  const latest=finalVote('Camera','vs19_732_003',today);
  const previous=finalVote('Camera','vs19_731_002',today);
  let fetched=0, committed=0;
  const inserts=[];
  const baseMembers=Array.from({length:125},(_,i)=>({
    name:'UNRELATED NOMINAL MEMBER '+i,group:'GRUPPO',vote:'Favorevole'
  }));
  const rosterA=[...baseMembers,{name:'DE LUCA MARIA',group:'GRUPPO',vote:'Favorevole'}];
  const rosterB=[...baseMembers,{name:'ROSSI PAOLO',group:'GRUPPO',vote:'Contrario'}];
  const pool={
    query:async (sql,params=[])=>{
      if(sql.includes('SELECT openpolis_id'))return {rows:[previous,latest]};
      if(sql.includes('SELECT DISTINCT p.id'))return {rows:params[0]==='it.camera'?[rep,rep2]:[]};
      throw new Error('unexpected query');
    },
    connect:async()=>({
      query:async (sql,params)=>{
        if(sql.includes('INSERT INTO notifiche_voti_parlamento')){
          inserts.push({id:params[0],vote:params[5],source:params[8]});
          return {rows:[{id:'synthetic'}]};
        }
        if(sql==='COMMIT')committed++;
        return {rows:[]};
      },
      release:()=>{}
    })
  };
  try{
    const result=await refreshLatestParliamentVoteNotifications(pool,{
      getVerifiedFinalBallots:async(vote)=>{
        fetched++;
        return {voteId:vote.openpolis_id,chamber:vote.camera,date:today,
          source:{type:'official',url:'https://documenti.camera.it/verified'},
          members:vote.openpolis_id===latest.openpolis_id?rosterA:rosterB};
      }
    });
    assert.equal(fetched,2,'search must continue beyond most recent Chamber roll call');
    assert.equal(committed,2);
    assert.deepEqual(result,{enabled:true,checked:2,changed:2,unavailable:0});
    assert.deepEqual(inserts,[
      {id:rep.id,vote:'Favorevole',source:latest.openpolis_id},
      {id:rep2.id,vote:'Contrario',source:previous.openpolis_id}
    ]);
  } finally {
    if(old===undefined)delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
    else process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=old;
  }
});

test('migration preserves old rows, requires unique representative/chamber, and extends absence statuses', () => {
  const fs=require('node:fs'),path=require('node:path');
  const root=path.join(__dirname,'../..');
  const sql=fs.readFileSync(path.join(root,'api/database/20261103_latest_parliament_votes.sql'),'utf8');
  assert.match(sql,/PARLIAMENT_LATEST_DUPLICATES_REQUIRE_REVIEW/);
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS notifiche_voti_parlamento_latest_rep_camera/);
  assert.match(sql,/'In missione'/);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS openpolis_id/);
  const job=fs.readFileSync(path.join(root,'api/jobs/openpolisVotazioniFinaliJob.js'),'utf8');
  assert.match(job,/refreshLatestParliamentVoteNotifications\(pool\)/);
  const notifications=fs.readFileSync(path.join(root,'api/routes/notifiche.js'),'utf8');
  assert.match(notifications,/latestParliamentEnabled/);
  assert.match(notifications,/openpolis_id: c.openpolis_id/);
  assert.match(notifications,/SELECT DISTINCT selected_user_id::text AS id FROM political_selections/);
  assert.match(notifications,/ps.user_id = \$2::uuid/);
  assert.match(notifications,/ps.political_office_id = 'it.camera' AND nvp.camera = 'Camera'/);
  assert.match(notifications,/ps.political_office_id = 'it.senato' AND nvp.camera = 'Senato'/);
  assert.match(notifications,/latestParliamentEnabled \? \[rappresentantiIds, user_id\] : \[rappresentantiIds\]/);
});
