'use strict';
// Real PostgreSQL 16/17 integration on ephemeral CI loopback database ONLY.
// Never uses the real Demos-Staging, Render, Supabase, production or FCM.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {syncOnce}=require('../staging/ministeroStagingSyncOnce');

const DSN='postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';
const ROLE='demos_staging_runtime';

function source(id,signatures=12,until='2027-05-01'){
  return {
    id:'ministero_'+id,id_ministero:String(id),titolo:'Official synthetic '+id,
    tipo:'Legge di iniziativa popolare',stato:'in_corso',
    data_inizio_raw:'2026-11-01',data_fine_raw:until,
    firme_raccolte:signatures,categoria_notifica:'iniziative_popolari',
    target_path:'/iniziative-popolari',
    sito_web:'https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/'+id,
  };
}

test('staging source-only sync uses real restricted PG16/17 writes, never DELETE or FCM',
  {timeout:40000},async()=>{
  if(process.env.CIVIC_TEST_DATABASE_URL!==DSN||
     !['16','17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR)||
     process.env.DATABASE_URL)
    throw new Error('REFUSE_NON_LOOPBACK_MINISTERO_CI_DB');

  const admin=new Pool({connectionString:DSN,max:2});
  try{
    await admin.query([
      'CREATE TABLE public.iniziative_ministero (',
      'id varchar PRIMARY KEY,id_ministero varchar,titolo text NOT NULL,',
      'tipo varchar,stato varchar,esito varchar,data_inizio date,data_fine date,',
      'firme_raccolte integer,quorum_raggiunto boolean,sito_web text,',
      'data_ultimo_aggiornamento timestamptz,updated_at timestamptz)',
    ].join(' '));
    await admin.query([
      'CREATE TABLE public.civic_new_initiative_notifications (',
      'id bigserial PRIMARY KEY,category text NOT NULL,official_id text NOT NULL,',
      'title text NOT NULL,target_path text NOT NULL,status text NOT NULL,',
      'UNIQUE(category,official_id))',
    ].join(' '));
    for(const table of ['iniziative_ministero','civic_new_initiative_notifications']){
      await admin.query('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY');
      await admin.query('CREATE POLICY stage_ci_policy ON public.'+table+
        ' FOR ALL TO '+ROLE+' USING (true) WITH CHECK (true)');
      await admin.query('GRANT SELECT,INSERT,UPDATE ON public.'+table+' TO '+ROLE);
    }
    await admin.query(
      'GRANT USAGE ON SEQUENCE public.civic_new_initiative_notifications_id_seq TO '+ROLE);
    await admin.query(
      'GRANT SELECT,UPDATE ON public.civic_push_delivery_guard TO '+ROLE);
    await admin.query(
      'CREATE POLICY stage_ci_guard ON public.civic_push_delivery_guard'+
      ' FOR ALL TO '+ROLE+' USING (true) WITH CHECK (true)');
    await admin.query([
      'INSERT INTO public.iniziative_ministero',
      '(id,id_ministero,titolo,tipo,stato)',
      "VALUES('ministero_217','217','Synthetic old','Legge di iniziativa popolare','in_corso'),",
      "('ministero_218','218','Synthetic old','Legge di iniziativa popolare','in_corso')",
    ].join(' '));
    await admin.query([
      'INSERT INTO public.civic_new_initiative_notifications',
      '(category,official_id,title,target_path,status)',
      "VALUES('iniziative_popolari','217','Historical old',",
      "'/iniziative-popolari','suppressed')",
    ].join(' '));
    const granted=await admin.query(
      "SELECT has_table_privilege($1,'public.iniziative_ministero','DELETE') AS del,"+
      "has_table_privilege($1,'public.iniziative_ministero','UPDATE') AS upd",
      [ROLE]);
    assert.equal(granted.rows[0].del,false);
    assert.equal(granted.rows[0].upd,true);

    function makePool(){
      // A new wrapper per run simulates the exact CI least-privilege role.
      const local=new Pool({connectionString:DSN,max:1});
      return {
        async connect(){
          const c=await local.connect();
          await c.query('SET ROLE '+ROLE);
          return {
            async query(sql,args){
              if(sql.includes('SELECT current_user::text')){
                const actual=await c.query('SELECT current_user::text role_name');
                assert.equal(actual.rows[0].role_name,ROLE);
                return {rows:[{
                  role_name:ROLE,database_name:'postgres',
                  identity_hash:'0cbb6ace68a9f11956904e2a37898ec8',
                }]};
              }
              return c.query(sql,args);
            },
            release(){c.release(true);},
          };
        },
        end:()=>local.end(),
      };
    }
    async function run(rows){
      // Test-only override bypasses external target verification because CI's
      // database name/hash are synthetic; real CLI never provides overrides.
      return syncOnce({},{
        validateEnv:()=>DSN,makePool:()=>makePool(),
        verifyIdentity:async()=>true,readSource:async()=>rows,
      });
    }
    const first=await run([source(217,44),source(218,55)]);
    assert.equal(first.updated,2);
    assert.equal(first.newlySuppressed,1);
    const second=await run([source(217,66),source(218,77)]);
    assert.equal(second.updated,2);
    assert.equal(second.newlySuppressed,0);
    const result=await admin.query([
      'SELECT id,stato,firme_raccolte FROM public.iniziative_ministero ORDER BY id',
    ].join(''));
    assert.deepEqual(result.rows.map(x=>[x.id,x.stato,x.firme_raccolte]),[
      ['ministero_217','in_corso',66],['ministero_218','in_corso',77],
    ]);
    const outbox=await admin.query([
      'SELECT official_id,status FROM public.civic_new_initiative_notifications',
      'ORDER BY official_id',
    ].join(' '));
    assert.deepEqual(outbox.rows.map(x=>[x.official_id,x.status]),[
      ['217','suppressed'],['218','suppressed'],
    ]);
    // Unexpectedly depleted source must abort, not mark history as closed.
    await assert.rejects(run([source(217,100)]),/MINISTERO_SOURCE_SYNC_ABORTED/);
    await admin.query('UPDATE public.civic_push_delivery_guard SET blocked=false WHERE id=1');
    await assert.rejects(run([source(217),source(218)]),
      /MINISTERO_SOURCE_SYNC_ABORTED/);
    await admin.query('UPDATE public.civic_push_delivery_guard SET blocked=true WHERE id=1');
    const after=await admin.query(
      'SELECT count(*)::integer AS n FROM public.civic_new_initiative_notifications '+
      "WHERE status <> 'suppressed'");
    assert.equal(after.rows[0].n,0);
  }finally{
    // Ephemeral CI database. Preserve other seeded P1-P5 tables.
    await admin.query('DROP TABLE IF EXISTS public.civic_new_initiative_notifications CASCADE');
    await admin.query('DROP TABLE IF EXISTS public.iniziative_ministero CASCADE');
    await admin.end();
  }
});
