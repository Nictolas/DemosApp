'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {readGdprPersonalDatasets}=require('../services/gdprPersonalExportDatasets');
const DB='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_legacy_rights_ci';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const names=['opinioni_risposte','voti_capo_stato','voti_referendum_abrogativi','voti_iniziative_popolari','voti_ice','notifiche_demos','notifiche_avvistamenti','notifiche_comunali','notifiche_voti_comuni','notifiche_voti_parlamento','political_opinion_notifications','notifiche_preferenze'];
test('canonical export SQL runs on synthetic PG17 and cannot include a different subject',async()=>{
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.GDPR_LEGACY_PG_CI!=='isolated'||e.TEST_DATABASE_URL!==DB||
     e.DATABASE_URL||e.SUPABASE_URL||e.SUPABASE_DB_URL||e.RENDER||e.RENDER_SERVICE_ID) {
    throw Error('GDPR_EXPORT_PG17_REQUIRES_LOCAL_SYNTHETIC_DATABASE');
  }
  const p=new Pool({connectionString:DB,ssl:false,max:2});
  try{
    await p.query('CREATE TABLE public.opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text,extra_opinione text)');
    for(const n of names.slice(1,4))await p.query('CREATE TABLE public.'+n+'(userid uuid)');
    await p.query('CREATE TABLE public.voti_ice(utente_id varchar(255))');
    await p.query('CREATE TABLE public.notifiche_demos(id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,data_creazione timestamptz,data date)');
    await p.query('CREATE TABLE public.notifiche_avvistamenti(id uuid DEFAULT gen_random_uuid(),id_utente uuid,tipo_avvistamento text,metadata jsonb,comune_residenza text,data_creazione timestamptz)');
    await p.query('CREATE TABLE public.notifiche_comunali(id uuid DEFAULT gen_random_uuid(),id_utente uuid,tipologia text,dove text,dal_giorno date,al_giorno date,zona text,data_creazione timestamptz)');
    await p.query('CREATE TABLE public.notifiche_voti_comuni(id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,politico text,voto text,comune_residenza text,data_creazione timestamptz)');
    await p.query('CREATE TABLE public.notifiche_voti_parlamento(id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,politico text,camera text,voto text,votazione_hash text,data_creazione timestamp)');
    await p.query('CREATE TABLE public.political_opinion_notifications(id uuid DEFAULT gen_random_uuid(),recipient_user_id uuid,subject_user_id uuid,opinion_id text,opinion_text text,previous_value text,new_value text,created_at timestamptz)');
    await p.query('CREATE TABLE public.notifiche_preferenze(user_id uuid PRIMARY KEY,demos boolean)');
    await p.query('INSERT INTO public.opinioni_risposte VALUES($1,$2,$3),($4,$5,$6)',
      [A,'synthetic-yes','synthetic-extra',B,'private-other','private-other']);
    for(const n of names.slice(1,4))await p.query('INSERT INTO public.'+n+' VALUES($1),($2)',[A,B]);
    await p.query('INSERT INTO public.voti_ice VALUES($1),($2)',[A,B]);
    for(const n of names.slice(5,10))await p.query('INSERT INTO public.'+n+'(id_utente) VALUES($1),($2)',[A,B]);
    await p.query('INSERT INTO public.political_opinion_notifications(recipient_user_id,subject_user_id,opinion_text) VALUES($1,$2,$3),($2,$1,$4)',
      [A,B,'visible-to-A','private-to-B']);
    await p.query('INSERT INTO public.notifiche_preferenze VALUES($1,true),($2,false)',[A,B]);
    const own=await readGdprPersonalDatasets(p,A);
    assert.equal(own.opinions.energia_nucleare,'synthetic-yes');
    assert.equal(own.opinions.extra_opinione,'synthetic-extra');
    assert.equal(Object.hasOwn(own.opinions,'user_id'),false);
    assert.deepEqual(Object.fromEntries(own.votes.map(v=>[v.vote_type,v.vote_count])),{
      capo_stato:1,referendum:1,iniziative:1,ice:1
    });
    assert.equal(own.notifications.length,6);
    assert.deepEqual(own.notifications.map(v=>v.source).sort(),
      ['avvistamenti','comunali','demos','opinioni','voti_comuni','voti_parlamento']);
    assert.equal(own.notificationPreferences.demos,true);
    assert.doesNotMatch(JSON.stringify(own),/private-other|private-to-B|22222222-2222/);
    await p.query('DROP TABLE public.notifiche_demos');
    await assert.rejects(readGdprPersonalDatasets(p,A),/notifiche_demos/);
  }finally{
    for(const n of names.slice().reverse())await p.query('DROP TABLE IF EXISTS public.'+n).catch(()=>{});
    await p.end();
  }
});
