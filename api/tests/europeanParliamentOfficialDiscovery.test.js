'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  parsePastPlenarySittings,parseItalianCurrentMepIds,exactPersonId,
  fetchCurrentItalianMepIds,fetchPastPlenarySittingDates,
  collectRecentVerifiedItalianVotes
}=require('../services/europeanParliamentOfficialDiscovery');
const ISO='2026-08-10T12:00:00Z';
function roster(){
 return Array.from({length:620},(_,i)=>({
  id:'person/'+(100001+i),
  'api:country-of-representation':i<60?'IT':'FR',
  'api:political-group':'IGNORED',label:{en:'IGNORED NAME'}
 }));
}
function meeting(day){return {activity_id:'MTG-PL-'+day,had_activity_type:'def/ep-activities/PLENARY_SITTING'};}
const meetings={data:[meeting('2026-08-09'),meeting('2026-08-08'),meeting('2026-10-22'),
  meeting('2026-11-26'),{activity_id:'MTG-PL-2026-02-30'},
  {activity_id:'MTG-PL-2026-08-09-VOT-ITEM'}]};

test('filter future meetings and malformed dates; sort past sittings by exact date',()=>{
 assert.deepEqual(parsePastPlenarySittings(meetings,ISO),['2026-08-09','2026-08-08']);
 assert.throws(()=>parsePastPlenarySittings({data:[]},ISO),/INCOMPLETE/);
 assert.equal(exactPersonId('person/123456'),'123456');
 assert.equal(exactPersonId('person/1234567attack'),null);
});
test('Italy IDs only, rejects duplicate or partial rosters, never use party/names',()=>{
 const ids=parseItalianCurrentMepIds(roster());
 assert.equal(ids.size,60);
 assert.equal(ids.has('100001'),true);
 assert.equal(ids.has('100061'),false);
 assert.throws(()=>parseItalianCurrentMepIds(roster().slice(0,200)),/INCOMPLETE/);
 const dup=roster();dup[100].id=dup[0].id;
 assert.throws(()=>parseItalianCurrentMepIds(dup),/AMBIGUOUS/);
});
test('paginates official current MEPs and accepts only institutional IT country',async()=>{
 let count=0;
 const source=roster();
 const client={get:async url=>{
   count++;assert.match(url,/\/meps\/show-current\?/);
   const offset=Number(new URL(url).searchParams.get('offset'));
   const limit=Number(new URL(url).searchParams.get('limit'));
   assert.equal(limit,500);
   return {status:200,data:{data:source.slice(offset,offset+limit)}};
 }};
 const ids=await fetchCurrentItalianMepIds(client);
 assert.equal(ids.size,60);
 assert.equal(count,2);
});
test('collects last verified final votes with official order, one per Italian ID and no DB',async()=>{
 const data=roster();
 const client={get:async url=>{
   if(url.includes('/meetings?')) return {status:200,data:meetings};
   if(url.includes('/meps/show-current?')){
     const offset=Number(new URL(url).searchParams.get('offset'));
     return {status:200,data:{data:data.slice(offset,offset+500)}};
   }
   throw new Error('unexpected URL');
 }};
 const dates=await fetchPastPlenarySittingDates(ISO,client);
 assert.deepEqual(dates,['2026-08-09','2026-08-08']);
 let calls=0;
 const get=async date=>{
   calls++;assert.equal(date,'2026-08-09');
   const ballots=new Map(data.slice(0,60).map(x=>[x.id.slice(7),'Favorevole']));
   return [{voteId:'MTG-PL-2026-08-09-DEC-200001',date,ballots,
     final:true,verified:true,officialOrder:33,
     subject:'Voto sul testo nel suo insieme',outcome:'Approvato',
     sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-08-09/decisions'}];
 };
 const out=await collectRecentVerifiedItalianVotes({now:ISO,client,maxSittings:1,fetchDecisions:get});
 assert.equal(calls,1);assert.equal(out.covered,60);
 assert.equal(out.totalItalianMepIds,60);assert.equal(out.incomplete,false);
 assert.deepEqual(out.checkedSittings,['2026-08-09']);
 assert.ok(!JSON.stringify([...out.current.values()]).includes('IGNORED'));
});
test('API outage never substitutes older ballots as latest verified',async()=>{
 const client={get:async url=>{
   if(url.includes('/meetings?')) return {status:200,data:meetings};
   if(url.includes('/meps/show-current?')) return {status:200,data:{data:roster().slice(
     Number(new URL(url).searchParams.get('offset')),
     Number(new URL(url).searchParams.get('offset'))+500
   )}};
   throw new Error('unexpected URL');
 }};
 await assert.rejects(
   collectRecentVerifiedItalianVotes({now:ISO,client,maxSittings:2,
     fetchDecisions:async()=>{throw new Error('OFFICIAL_SOURCE_DOWN') }}),
   /OFFICIAL_SOURCE_DOWN/);
});


test('recovers missing MEPs from earlier final sittings but never replaces recent votes with older ones',async()=>{
  const italian=roster().slice(0,60);
  const client={get:async url=>{
    if(url.includes('/meetings?'))return {status:200,data:meetings};
    if(url.includes('/meps/show-current?')){
      const start=Number(new URL(url).searchParams.get('offset'));
      return {status:200,data:{data:roster().slice(start,start+500)}};
    }
    throw new Error('unexpected API endpoint');
  }};
  const visited=[];
  const get=async date=>{
    visited.push(date);
    const voters=date==='2026-08-09'?italian.slice(0,40):italian;
    return [{
      voteId:'MTG-PL-'+date+'-DEC-200001',date,
      ballots:new Map(voters.map(p=>[p.id.replace('person/',''),date==='2026-08-09'?'Contrario':'Favorevole'])),
      final:true,verified:true,officialOrder:33,
      subject:'Verified official final text',
      outcome:'Approvato',sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+date+'/decisions'
    }];
  };
  const out=await collectRecentVerifiedItalianVotes({now:ISO,client,maxSittings:4,fetchDecisions:get});
  assert.equal(out.covered,60);
  assert.equal(out.incomplete,false);
  assert.deepEqual(visited,['2026-08-09','2026-08-08']);
  assert.equal(out.current.get('100001').vote,'Contrario');
  assert.equal(out.current.get('100001').date,'2026-08-09');
  assert.equal(out.current.get('100060').vote,'Favorevole');
  assert.equal(out.current.get('100060').date,'2026-08-08');
});
