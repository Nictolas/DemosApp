'use strict';
// DEMOS12 DPO contract: public approved third-party titles must stay offline
// until the existing explicit nomination opt-in. All rows/IDs are synthetic;
// no real PostgreSQL, API, credentials, mail or user records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readApprovedPage}=require('../services/publicApprovedSubjectPage');
const FLAG='DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED';
async function withFlag(value, fn) {
  const previous=process.env[FLAG];
  if(value==null)delete process.env[FLAG];else process.env[FLAG]=value;
  try{return await fn();}
  finally{if(previous==null)delete process.env[FLAG];else process.env[FLAG]=previous;}
}

test('all public approved categories are empty without explicit publication opt-in, without querying SQL',async()=>{
  for(const flag of [null,'false','TRUE','1','yes']){
    await withFlag(flag,async()=>{
      let reads=0;
      const pool={query(){reads++;throw Error('SYNTHETIC_SQL_MUST_NOT_RUN')}};
      for(const category of ['attivisti','organizzazioni']){
        assert.deepEqual(await readApprovedPage(pool,category),
          {data:[],next_cursor:null},'public names must remain hidden with flag '+flag);
      }
      assert.equal(reads,0,'public approved reader must not touch database while disabled');
    });
  }
});

test('an already issued public cursor cannot bypass a later publication shutdown',async()=>{
  await withFlag('true',async()=>{
    const fake={query:async()=>({rows:[{
      id:'11111111-1111-4111-8111-111111111111',
      title:'Nomina sintetica',cursor_epoch:'1794000000.123456',
      details:'PRIVATE_TEST_DETAILS',source_url:'https://example.org/private',
      proposer_user_id:'22222222-2222-4222-8222-222222222222'
    }]})};
    const visible=await readApprovedPage(fake,'attivisti');
    assert.deepEqual(visible,{data:[{
      id:'11111111-1111-4111-8111-111111111111',
      title:'Nomina sintetica'
    }],next_cursor:null},'approved reader projects only public id and title');
  });
  const previouslyIssuedCursor=Buffer.from(JSON.stringify([
    '1794000000.123456','11111111-1111-4111-8111-111111111111'
  ])).toString('base64url');
  await withFlag(null,async()=>{
    let reads=0;
    const offline={query(){reads++;throw Error('SYNTHETIC_SQL_MUST_NOT_RUN')}};
    const hidden=await readApprovedPage(offline,'organizzazioni',previouslyIssuedCursor);
    assert.deepEqual(hidden,{data:[],next_cursor:null});
    assert.equal(reads,0,'cached pagination cursor cannot restore unpublished titles');
    assert.equal(await readApprovedPage(offline,'attivisti','bad*!'),null,
      'malformed cursors remain rejected before database access');
  });
});

test('exact true opt-in preserves normal public pagination and minimal projection',async()=>{
  await withFlag('true',async()=>{
    let reads=0;
    const rows=Array.from({length:101},(_,n)=>({
      id:'11111111-1111-4111-8111-'+String(n).padStart(12,'0'),
      title:'Synthetic public subject '+n,cursor_epoch:'1794000000.123456',
      details:'NEVER_PUBLIC',source_url:'https://example.org/private'
    }));
    const pool={query:async(sql,params)=>{
      reads++;
      assert.match(sql,/WHERE category=\$1 AND status='approved'/);
      assert.equal(params[0],'attivisti');
      return {rows};
    }};
    const page=await readApprovedPage(pool,'attivisti');
    assert.equal(reads,1);
    assert.equal(page.data.length,100);
    assert.ok(page.next_cursor,'pagination still operates with explicit opt-in');
    assert.ok(page.data.every(row=>Object.keys(row).sort().join(',')==='id,title'),
      'never expose private nomination narrative or evidence URL');
  });
});
