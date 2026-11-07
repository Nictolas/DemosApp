'use strict';
// Only synthetic data in the disposable local PG17 CI service.
// No access to production, staging or personal records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('PG17 registered directories paginate 105 equal-timestamp profiles',async(t)=>{
  if(process.env.CIVIC_TEST_MODE!=='isolated-synthetic' ||
    process.env.CIVIC_TEST_DATABASE_URL!=='postgres://demos_ci:synthetic_only@127.0.0.1:5432/demos_civic_ci')
    return t.skip('isolated synthetic PG17 required');
  const {Client}=require('pg');
  const express=require('express');
  const db=new Client({connectionString:process.env.CIVIC_TEST_DATABASE_URL});
  await db.connect();
  const schema='d12_regdir_'+process.pid;
  let server;
  let count=0;
  try{
    await db.query('CREATE SCHEMA '+schema);
    await db.query('SET search_path TO '+schema+',public');
    await db.query([
      'CREATE TABLE users(id uuid primary key,nome text,cognome text,ruolo text,',
      'account_type text,is_activist boolean,status text NOT NULL DEFAULT \'a\',avatar_config text,regione_residenza text,',
      'facebook_url text,twitter_url text,instagram_url text,linkedin_url text,',
      'telegram_url text,website_url text,twitch_url text,youtube_url text,',
      'tipologie_attivismo jsonb,created_at timestamptz,attivisti uuid,organizzazioni uuid)'
    ].join(' '));
    await db.query([
      'INSERT INTO users',
      '(id,nome,cognome,ruolo,account_type,is_activist,avatar_config,regione_residenza,tipologie_attivismo,created_at)',
      "SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,",
      "'Persona sintetica '||n,'Esempio',",
      "CASE WHEN n<=105 THEN 'A' ELSE 'O' END,",
      "CASE WHEN n<=105 THEN 'PERSON' ELSE 'ORGANIZATION' END,",
      "n<=105,'{}','TO','[{\"tipo\":\"ambiente\",\"emoji\":\"A\",\"nome\":\"Ambiente\",\"private_email\":\"synthetic-secret@example.invalid\",\"review_metadata\":{\"token\":\"private\"}}]'::jsonb,",
      "'2026-11-05 13:14:15.123456+00'::timestamptz FROM generate_series(1,210) n"
    ].join(' '));
    // Two synthetic suspended profiles rank ahead of active members by recency.
    // Neither legacy full-list clients nor new pages may disclose these members.
    await db.query(`
      INSERT INTO users(id,nome,cognome,ruolo,account_type,is_activist,status,
                        avatar_config,regione_residenza,tipologie_attivismo,created_at)
      VALUES
        ('00000000-0000-4000-8000-000000000211','Suspended activist','Fixture',
         'A','PERSON',TRUE,'x','{}','TO','[{"tipo":"ambiente"}]'::jsonb,
         '2026-11-06 13:14:15+00'::timestamptz),
        ('00000000-0000-4000-8000-000000000212','Suspended organization','Fixture',
         'O','ORGANIZATION',FALSE,'x','{}','TO','[{"tipo":"ambiente"}]'::jsonb,
         '2026-11-06 13:14:15+00'::timestamptz)
    `);
    const pool={query:(sql,args)=>{
      count++;
      if(!String(sql).trim().toUpperCase().startsWith('SELECT'))
        throw Error('DIR_QA_READ_ONLY_SQL_REQUIRED');
      return db.query(sql,args);
    }};
    function mount(name){
      const file=path.resolve(__dirname,'../routes',name+'.js');
      const stubs={
        express,dotenv:{config:()=>{}},
        '../config/database':{getPool:()=>pool},
        '../utils/locationUtils':{compressRegione:s=>s,decompressRegione:s=>s},
        '../services/accountCapabilitiesService':{
          queryWithAccountModelFallback:(_db,modern,legacy,params)=>pool.query(modern,params)
        },
        '../services/publicApprovedSubjectPage':{readApprovedPage:async()=>({data:[],next_cursor:null})},
        '../services/publicDirectoryMemberProjection':require('../services/publicDirectoryMemberProjection'),
        '../services/registeredDirectoryPage':require('../services/registeredDirectoryPage')
      };
      const mod={exports:{}};
      vm.runInNewContext(fs.readFileSync(file,'utf8'),{
        module:mod,require:key=>{
          if(!(key in stubs))throw Error('Unexpected require '+key);
          return stubs[key];
        },process:{env:{}},Buffer,URL,Set,console
      },{filename:name+'.js'});
      return mod.exports;
    }
    const app=express();
    app.use('/api/attivisti',mount('attivisti'));
    app.use('/api/organizzazioni',mount('organizzazioni'));
    server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
    for(const [url,start,end] of [
      ['/api/attivisti',105,1],['/api/organizzazioni',210,106],
      ['/api/attivisti/tipologia/ambiente',105,1]
    ]){
      // Older published mobile bundles have no Load more control.
      const legacy=await fetch(origin+url);
      assert.equal(legacy.status,200,url);
      const legacyJson=await legacy.json();
      assert.equal(legacyJson.data.length,105,'old clients must retain all registered profiles');
      assert.equal(legacyJson.members_next_cursor,null);
      assert.deepEqual(Object.keys(legacyJson.data[0].tipologie_attivismo[0]).sort(),
        ['emoji','nome','tipo'],'legacy API must not expose extra JSONB properties');
      assert.doesNotMatch(JSON.stringify(legacyJson.data),/synthetic-secret|private_email|review_metadata/);

      assert.equal(new Set(legacyJson.data.map(row=>row.id)).size,105);
      assert.equal(legacyJson.data.some(row=>[id(211),id(212)].includes(row.id)),false,
        'inactive registered accounts must not remain publicly discoverable');
      const firstResponse=await fetch(origin+url+'?members_paged=1');
      assert.equal(firstResponse.status,200,url);
      const a=await firstResponse.json();
      assert.equal(a.data.length,100,url);
      assert.deepEqual(Object.keys(a.data[0].tipologie_attivismo[0]).sort(),
        ['emoji','nome','tipo'],'paged response must project nested public keys only');
      assert.doesNotMatch(JSON.stringify(a.data),/synthetic-secret|private_email|review_metadata/);

      assert.equal(typeof a.members_next_cursor,'string');
      assert.equal(a.data[0].id,id(start));
      assert.equal(a.data.some(row=>[id(211),id(212)].includes(row.id)),false,
        'inactive member must not appear on paged public first page');
      assert.equal('cursor_epoch' in a.data[0],false);
      const next=await fetch(origin+url+'?members_paged=1&members_cursor='+encodeURIComponent(a.members_next_cursor));
      assert.equal(next.status,200,url);
      const b=await next.json();
      assert.equal(b.data.length,5,url);
      assert.doesNotMatch(JSON.stringify(b.data),/synthetic-secret|private_email|review_metadata/);

      assert.equal(b.data.at(-1).id,id(end));
      assert.equal(b.members_next_cursor,null);
      assert.equal(new Set([...a.data,...b.data].map(x=>x.id)).size,105);
      assert.equal([...a.data,...b.data].some(row=>[id(211),id(212)].includes(row.id)),false,
        'inactive members must never appear on either public page');
      const before=count;
      assert.equal((await fetch(origin+url+'?members_cursor=%2A')).status,400);
      assert.equal(count,before,'bad cursor rejected before SQL');
      // Canonicalization must also be enforced by the actual HTTP routes,
      // before a database read, not only by the isolated decoder unit test.
      const canonicalCursor=a.members_next_cursor;
      const malformedAliases=[canonicalCursor+'=',canonicalCursor+'*'];
      for(const alias of malformedAliases){
        const prior=count;
        const rejected=await fetch(origin+url+'?members_paged=1&members_cursor='+encodeURIComponent(alias));
        assert.equal(rejected.status,400,'noncanonical cursor must be rejected: '+url);
        assert.equal(count,prior,'invalid cursor must not trigger SQL: '+url);
      }
    }
    console.log('PG17_REGISTERED_DIRECTORY_KEYSET_PASS: categories 3 x 105 profiles; legacy 105 + modern 100/5');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
    await db.end();
  }
});
