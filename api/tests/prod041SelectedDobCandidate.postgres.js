'use strict';
// CI ONLY: isolated PostgreSQL 16 ephemeral database, never staging/production.
// Exercise the exact reviewed SQL with synthetic profiles & selections.
// The real proposed production migration remains approval-gated and unapplied.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');

const conn=new URL(process.env.TEST_PARLIAMENT_PG_URL||'postgres://invalid');
if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.TEST_PARLIAMENT_PG_EPHEMERAL!=='true' ||
   !['localhost','127.0.0.1'].includes(conn.hostname) ||
   conn.port!=='55432'||conn.pathname!=='/demos_test'||
   conn.username!=='demos_test')
  throw new Error('REFUSE_NON_EPHEMERAL_DOB_MIGRATION_TEST');

const root=path.join(__dirname,'../..');
const migration=fs.readFileSync(
  path.join(root,'api/database/20261108_selected_public_dob_correction_REQUIRES_GO.sql'),'utf8');
const APPROVED=[
  'BEGIN;',
  "SET LOCAL demos.prod041_dob_approval = 'GO_THREE_PUBLIC_DOBS';",
  "SET LOCAL demos.prod041_backup_restore_proven = 'true';",
  "SET LOCAL demos.prod041_official_registry_rechecked = 'true';"
].join('\n');
assert.equal(migration.match(/^BEGIN;$/gm)?.length,1,'single transaction entry');
assert.equal(migration.match(/^COMMIT;$/gm)?.length,1,'single guarded transaction');
const approvedSql=migration.replace(/^BEGIN;$/m,APPROVED);

const reps=[
 ['2808589f-a913-4a54-aee8-56040d98c5db','Marco','Grimaldi','1980-10-22','1980-11-08','C','it.camera'],
 ['e35587f2-0b72-464f-a011-f0576631b410','Carlo','Calenda','1973-09-04','1973-04-09','S','it.senato'],
 ['fc1d0743-0d61-4eed-9daf-9147e399e307','Matteo','Salvini','1973-09-03','1973-03-09','S','it.senato']
];
const follower='00000000-0000-4000-8000-000000000098';
const unrelated='00000000-0000-4000-8000-000000000099';
const admin=new Client({connectionString:conn.href,connectionTimeoutMillis:6000});
const temporaryName='demos_prod041_dob_ci';
let testClient;
async function snapshot(){
  const result=await testClient.query(
    "SELECT u.nome,u.cognome,u.data_nascita::text AS udate,p.data_nascita::text AS pdate "+
    "FROM public.users u LEFT JOIN public.user_profile p ON p.user_id=u.id "+
    "WHERE u.id = ANY($1::uuid[]) ORDER BY u.cognome",
    [reps.map(row=>row[0])]);
  return result.rows;
}
async function runReject(sql,expected){
  await assert.rejects(testClient.query(sql),e=>
    e.code==='P0001' && String(e.message).includes(expected),
    expected);
  await testClient.query('ROLLBACK');
}
async function main(){
  await admin.connect();
  try{
    await admin.query('CREATE DATABASE '+temporaryName);
    const ephemeralUrl=new URL(conn.href);
    ephemeralUrl.pathname='/'+temporaryName;
    testClient=new Client({connectionString:ephemeralUrl.href,connectionTimeoutMillis:6000});
    await testClient.connect();
    try{
      await testClient.query([
        'CREATE TABLE public.users (id uuid PRIMARY KEY,nome text NOT NULL,cognome text NOT NULL,data_nascita date,status text NOT NULL,updated_at timestamptz);',
        'CREATE TABLE public.user_profile (user_id uuid PRIMARY KEY REFERENCES public.users(id),data_nascita date,updated_at timestamptz);',
        'CREATE TABLE public.political_mandates (id bigserial PRIMARY KEY,user_id uuid REFERENCES public.users(id),office_code text,status text,starts_at timestamptz,ends_at timestamptz);',
        'CREATE TABLE public.political_selections (id bigserial PRIMARY KEY,user_id uuid REFERENCES public.users(id),selected_user_id uuid REFERENCES public.users(id),selection_kind text,political_office_id text);'
      ].join('\n'));
      await testClient.query("INSERT INTO public.users(id,nome,cognome,data_nascita,status) VALUES($1,'Synthetic','Follower',NULL,'a')",[follower]);
      await testClient.query("INSERT INTO public.users(id,nome,cognome,data_nascita,status) VALUES($1,'Unrelated','Person','1972-02-02','a')",[unrelated]);
      await testClient.query("INSERT INTO public.user_profile(user_id,data_nascita) VALUES($1,'1972-02-02')",[unrelated]);
      for(const [id,first,last,old,_future,office,slot] of reps){
        await testClient.query("INSERT INTO public.users(id,nome,cognome,data_nascita,status) VALUES($1,$2,$3,$4,'a')",
          [id,first,last,old]);
        await testClient.query("INSERT INTO public.user_profile(user_id,data_nascita) VALUES($1,$2)",[id,old]);
        await testClient.query("INSERT INTO public.political_mandates(user_id,status,office_code,starts_at) VALUES($1,'ACTIVE',$2,now()-interval '1 day')",[id,office]);
        await testClient.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,political_office_id) VALUES($1,$2,'representative',$3)",[follower,id,slot]);
      }
      const before=await snapshot();
      assert.equal(before.length,3);
      assert.ok(before.every(row=>row.udate===row.pdate));

      // Plain file is safe by default: no production-review settings.
      await runReject(migration,'PROD041_DOB_EXPLICIT_GO_AND_BACKUP_REQUIRED');
      assert.deepEqual(await snapshot(),before,'gate failure leaves all three unchanged');

      // Fail in THIRD profile after first two would have been updated.
      // PostgreSQL must roll back whole transaction, not half-correct it.
      await testClient.query(
        "UPDATE public.user_profile SET data_nascita='1900-01-01' WHERE user_id=$1",
        [reps[2][0]]);
      await runReject(approvedSql,'PROD041_DOB_PROFILE_OR_ACCOUNT_DRIFT');
      const afterReject=await snapshot();
      assert.deepEqual(afterReject.slice(0,2),before.slice(0,2),
        'first two must roll back on third-person conflict');
      assert.equal(afterReject[2].pdate,'1900-01-01','external drift was not overwritten');

      await testClient.query("UPDATE public.user_profile SET data_nascita=$2 WHERE user_id=$1",[reps[2][0],reps[2][3]]);
      await testClient.query(approvedSql);
      const corrected=await snapshot();
      for(const row of corrected){
        const expected=reps.find(p=>p[2]===row.cognome);
        assert.equal(row.udate,expected[4]);
        assert.equal(row.pdate,expected[4]);
      }
      await testClient.query(approvedSql);
      assert.deepEqual(await snapshot(),corrected,'repeat is idempotent, no alternate account');
      const outside=(await testClient.query(
        'SELECT data_nascita::text dob FROM public.users WHERE id=$1',[unrelated])).rows[0];
      assert.equal(outside.dob,'1972-02-02','unrelated profile never changed');
      const followed=(await testClient.query(
        'SELECT count(*)::integer AS n FROM public.political_selections')).rows[0];
      assert.equal(followed.n,3,'all original choices preserved');
      console.log('DOB CANDIDATE SYNTHETIC PG16 PASS: missing GO rejected; multi-row rollback; both DOB tables corrected atomically; idempotent; unrelated accounts and selections preserved');
    }finally{
      await testClient.end();
      testClient=null;
    }
  }finally{
    try{await admin.query('DROP DATABASE IF EXISTS '+temporaryName+' WITH (FORCE)');}
    finally{await admin.end();}
  }
}
main().catch(error=>{console.error(error?.message||'DOB_CANDIDATE_TEST_FAILED');process.exitCode=1});
