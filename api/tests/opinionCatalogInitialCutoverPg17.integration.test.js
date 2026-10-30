'use strict';
// PostgreSQL 17 end-to-end cutover contract. Writes SYNTHETIC, PUBLIC question
// metadata exclusively to the GitHub Actions ephemeral postgres service.
// Never uses Supabase, Render, credentials, accounts or private answers.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {getAllOpinions}=require('../services/opinionCatalog');
const {checkOpinionCatalogParity}=require('../scripts/checkOpinionCatalogParity');

const url=process.env.OPINION_TEST_DATABASE_URL;
const enabled=Boolean(url && process.env.GITHUB_ACTIONS==='true');
if(enabled){
  const u=new URL(url);
  if(u.protocol!=='postgres:'||u.hostname!=='127.0.0.1'||
     u.port!=='5432'||u.pathname!=='/demos_opinion_ci'||
     u.username!=='demos_ci'||u.password!=='synthetic_only'){
    throw new Error('Refusing initial-cutover test outside isolated GitHub Actions PostgreSQL 17');
  }
}

test('ephemeral PostgreSQL 17: initial 94-question parity, duplicate fail-close and repeatable-read snapshot', {
  skip:!enabled,timeout:30000
},async()=>{
  const db=new Pool({connectionString:url,max:4,connectionTimeoutMillis:5000});
  const opinions=getAllOpinions();
  const first=opinions[0];
  try{
    const identity=await db.query('SELECT current_database() AS name, current_user AS usr, current_setting(\'server_version_num\')::int AS version');
    assert.equal(identity.rows[0].name,'demos_opinion_ci');
    assert.equal(identity.rows[0].usr,'demos_ci');
    assert.equal(Math.floor(identity.rows[0].version/10000),17);
    assert.equal(opinions.length,94);
    // The preceding isolated Android/PG17 contract already uses these 94
    // answer columns; IF NOT EXISTS keeps this regression self-contained.
    await db.query('CREATE TABLE IF NOT EXISTS public.opinioni_risposte ('+
      'user_id text PRIMARY KEY, fonti_opinioni jsonb,'+
      opinions.map(op=>'"'+op.id+'" TEXT').join(',')+')');
    await db.query('CREATE TABLE public.opinioni_domande ('+
      'id TEXT NOT NULL, text TEXT NOT NULL, gradi_opinione TEXT[] NOT NULL,'+
      'approfondimento TEXT NOT NULL)');
    await db.query(
      'INSERT INTO public.opinioni_domande(id,text,gradi_opinione,approfondimento) '+
      'SELECT id,text,gradi_opinione,approfondimento FROM jsonb_to_recordset($1::jsonb) '+
      'AS rows(id TEXT,text TEXT,gradi_opinione TEXT[],approfondimento TEXT)',
      [JSON.stringify(opinions)]
    );
    assert.deepEqual(await checkOpinionCatalogParity(db),
      {published:94,checkedColumns:94,mode:'initial-cutover'});

    // Same ID and same content: the old Map-based comparison would have
    // overwritten this duplicate and falsely reported parity.
    await db.query('INSERT INTO public.opinioni_domande '+
      '(id,text,gradi_opinione,approfondimento) VALUES($1,$2,$3,$4)',
      [first.id,first.text,first.gradi_opinione,first.approfondimento]);
    await assert.rejects(checkOpinionCatalogParity(db),
      /Legacy catalog contains duplicate opinion IDs/);
    await db.query('DELETE FROM public.opinioni_domande WHERE ctid=('+
      'SELECT max(ctid) FROM public.opinioni_domande WHERE id=$1)',[first.id]);
    assert.equal((await checkOpinionCatalogParity(db)).mode,'initial-cutover');

    // A second connection commits a new legacy text after the verifier's
    // first metadata SELECT. Both verifier reads must still use the FIRST
    // repeatable-read snapshot, never mix old schema and new question rows.
    let changed=false;
    const snapshotPool={async connect(){
      const client=await db.connect();
      return {
        async query(sql,...args){
          const result=await client.query(sql,...args);
          if(!changed && String(sql).includes('FROM information_schema.columns')){
            changed=true;
            await db.query('UPDATE public.opinioni_domande SET text=text||$1 WHERE id=$2',
              [' synthetic concurrent update',first.id]);
          }
          return result;
        },
        release:damaged=>client.release(damaged)
      };
    }};
    assert.equal((await checkOpinionCatalogParity(snapshotPool)).mode,'initial-cutover');
    assert.equal(changed,true,'test must actually mutate from an independent PG connection');
    // A NEW PostgreSQL snapshot now detects the committed drift.
    await assert.rejects(checkOpinionCatalogParity(db),/Catalog drift IDs:/);
    await db.query('UPDATE public.opinioni_domande SET text=$1 WHERE id=$2',
      [first.text,first.id]);
    assert.equal((await checkOpinionCatalogParity(db)).mode,'initial-cutover');
    assert.equal((await checkOpinionCatalogParity(db,{schemaOnly:true})).mode,'schema-only');
  }finally{
    // Never drop an existing real object; CI discards the isolated container.
    await db.end();
  }
});
