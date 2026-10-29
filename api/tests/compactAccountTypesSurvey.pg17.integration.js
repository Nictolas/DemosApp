'use strict';
// Real survey SQL vs isolated CI PostgreSQL 17: NO production data or service.
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {getNationalSurveyStats,getTerritorialSurveyStats}=require('../utils/sondaggiTextBulk');
async function run(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.PGHOST!=='localhost'||
    process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||
    process.env.PGDATABASE!=='postgres')throw Error('Isolated PG17 CI only');
  const mode=process.argv[2];assert.ok(['short','long'].includes(mode));
  const personType=mode==='short'?'P':'PERSON';
  const orgType=mode==='short'?'O':'ORGANIZATION';
  const pool=new Pool({connectionTimeoutMillis:2000,statement_timeout:7000});
  try{
    await pool.query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS political_opinions_consent boolean NOT NULL DEFAULT false");
    await pool.query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS regione_residenza text");
    await pool.query("CREATE TABLE public.user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean)");
    await pool.query("CREATE TABLE public.opinioni_risposte(user_id uuid PRIMARY KEY,q01 text,q02 text)");
    await pool.query(
      "INSERT INTO public.users(id,ruolo,status,account_type,political_opinions_consent,regione_residenza) SELECT md5('compact-person-'||g)::uuid,'E','a',$1,true,CASE WHEN g<=10 THEN 'Toscana' ELSE 'Lazio' END FROM generate_series(1,12) g",
      [personType]);
    await pool.query(
      "INSERT INTO public.opinioni_risposte(user_id,q01,q02) SELECT md5('compact-person-'||g)::uuid,CASE WHEN g<=7 THEN 'f' WHEN g<=11 THEN 'c' ELSE 'i' END,CASE WHEN g<=9 THEN 'f' ELSE NULL END FROM generate_series(1,12) g");
    // Consent in canonical table overrides the legacy users flag.
    await pool.query("UPDATE public.users SET political_opinions_consent=false WHERE id=md5('compact-person-1')::uuid");
    await pool.query("INSERT INTO public.user_consents(user_id,political_opinions_consent) VALUES (md5('compact-person-1')::uuid,true)");
    // Consent does not turn organizations into eligible individual responses.
    await pool.query(
      "INSERT INTO public.users(id,ruolo,status,account_type,political_opinions_consent,regione_residenza) SELECT md5('compact-org-'||g)::uuid,'O','a',$1,true,'Toscana' FROM generate_series(1,2) g",[orgType]);
    await pool.query(
      "INSERT INTO public.opinioni_risposte(user_id,q01,q02) SELECT md5('compact-org-'||g)::uuid,'f','f' FROM generate_series(1,2) g");
    await pool.query(
      "INSERT INTO public.users(id,ruolo,status,account_type,political_opinions_consent,regione_residenza) VALUES (md5('compact-revoked')::uuid,'E','a',$1,true,'Toscana')",[personType]);
    await pool.query("INSERT INTO public.user_consents(user_id,political_opinions_consent) VALUES (md5('compact-revoked')::uuid,false)");
    await pool.query("INSERT INTO public.opinioni_risposte(user_id,q01,q02) VALUES (md5('compact-revoked')::uuid,'f','f')");
    const questions=[{id:'q01'},{id:'q02'}];
    const national=await getNationalSurveyStats(pool,questions);
    assert.deepEqual(national,{q01:{favorevole:7,contrario:4,indeciso:1}},
      'Counts must exclude organizations and revocations, and suppress cells below 10');
    const region=await getTerritorialSurveyStats(pool,questions,{scope:'regione',params:['Toscana']});
    assert.deepEqual(region,{q01:{favorevole:7,contrario:3,indeciso:0}});
    const small=await getTerritorialSurveyStats(pool,questions,{scope:'regione',params:['Lazio']});
    assert.deepEqual(small,{},'Groups of 2 must not be published');
    console.log('COMPACT_ACCOUNT_TYPES_SURVEY_PG17_PASS',JSON.stringify({mode,national,regional:region}));
  }finally{
    // This runner is a disposable GitHub postgres:17 fixture; leave the
    // original migration dataset available to the subsequent rollback tests.
    try{
      await pool.query("DROP TABLE IF EXISTS public.opinioni_risposte,public.user_consents");
      await pool.query("DELETE FROM public.users WHERE id IN (SELECT md5('compact-person-'||g)::uuid FROM generate_series(1,12) g) OR id IN (SELECT md5('compact-org-'||g)::uuid FROM generate_series(1,2) g) OR id=md5('compact-revoked')::uuid");
    }finally{await pool.end()}
  }
}
run().catch(e=>{console.error(e);process.exitCode=1});
