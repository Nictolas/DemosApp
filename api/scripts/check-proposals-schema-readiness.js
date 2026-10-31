'use strict';
// Read-only DEMOS staging preflight. System catalog metadata only: no user rows.
const REQUIRED_COLUMNS = Object.freeze({
  users: ['id','ruolo','is_admin','status'],
  subject_proposals: ['id','proposer_user_id','category','title','details','source_url','status','created_at','reviewed_at','reviewed_by','published_ref','review_note','withdrawn_at','withdrawn_by','withdraw_note'],
  capo_stato_soggetti_approvati: ['id','nome','active','source_proposal_id'],
  richieste_grazia: ['id','utente_id','nome','url_prova','status','data_creazione'],
  grazia_carcerati: ['id','nome','attivo'],
  voti_grazia: ['id','userid','nome','timestamp'],
  voti_capo_stato: ['id','userid','nome','timestamp'],
  voti_amnistia: ['id','userid','legge','amnistia_id'],
  notifiche_demos: ['id','id_utente','titolo','testo','data_creazione','data'],
  amnistia: ['id','legge','articolo','descrizione','fonte_url','attiva']
});
const CATEGORIES = Object.freeze(['capo_stato','amnistia','attivisti','organizzazioni']);
const PRIVATE_TABLES = ['subject_proposals','capo_stato_soggetti_approvati'];
const CLIENT_ROLES = ['anon','authenticated'];

function assessMetadata({columns=[],tables=[],constraints=[],indexes=[],privileges=[]}) {
  const problems = [];
  const add = (code,object,detail) => problems.push({code,object,detail});
  const tableSet = new Map(tables.map(r=>[r.table_name,r]));
  const cols = new Map();
  for(const c of columns){
    if(!cols.has(c.table_name)) cols.set(c.table_name,new Map());
    cols.get(c.table_name).set(c.column_name,c);
  }
  for(const [name,expected] of Object.entries(REQUIRED_COLUMNS)){
    if(!tableSet.has(name)){
      add('MISSING_TABLE',name,'Required by the moderated proposal, listing or voting flow');
      continue;
    }
    for(const column of expected){
      if(!cols.get(name)?.has(column)) add('MISSING_COLUMN',name+'.'+column,'Required by an existing API query');
    }
  }
  const usersId=cols.get('users')?.get('id');
  if(usersId&&usersId.udt_name!=='uuid') add('WRONG_TYPE','users.id','Expected UUID');
  const usersAdmin=cols.get('users')?.get('is_admin');
  if(usersAdmin&&usersAdmin.udt_name!=='bool') add('WRONG_TYPE','users.is_admin','Expected boolean');
  const proposerId=cols.get('subject_proposals')?.get('proposer_user_id');
  if(proposerId&&proposerId.udt_name!=='uuid') add('WRONG_TYPE','subject_proposals.proposer_user_id','Expected UUID');

  if(tableSet.has('subject_proposals')){
    const category=constraints.find(r=>r.table_name==='subject_proposals'&&r.constraint_name==='subject_proposals_category_check');
    const def=category?.definition||'';
    if(!category||CATEGORIES.some(c=>!def.includes("'"+c+"'"))||/'grazia'/i.test(def))
      add('CATEGORY_CHECK_DRIFT','subject_proposals.category','Only four categories; Grazia belongs to richieste_grazia');
    for(const name of ['subject_proposals_one_pending_per_user_category','subject_proposals_no_duplicate_open_titles']){
      const idx=indexes.find(i=>i.table_name==='subject_proposals'&&i.index_name===name);
      if(!idx||!/CREATE UNIQUE INDEX/i.test(idx.definition)||!/pending/i.test(idx.definition))
        add('MISSING_UNIQUE_INDEX','subject_proposals.'+name,'PostgreSQL must enforce uniqueness');
      else if(name==='subject_proposals_no_duplicate_open_titles'){
        if(!/withdrawn/i.test(idx.definition))
          add('WITHDRAWN_TITLE_UNPROTECTED','subject_proposals.'+name,
            'Withdrawn nominations must not be re-submitted before an explicit DPO review');
        if(!/normalize\s*\(/i.test(idx.definition)||!/regexp_replace\s*\(/i.test(idx.definition))
          add('TITLE_NORMALIZATION_UNPROTECTED','subject_proposals.'+name,
            'Canonical Unicode and repeated whitespace must share the same uniqueness key');
      }
    }
    const withdrawalStatus=constraints.find(c=>c.table_name==='subject_proposals'&&c.constraint_name==='subject_proposals_status_check');
    if(!withdrawalStatus||!withdrawalStatus.definition.includes("'withdrawn'"))
      add('STATUS_CHECK_DRIFT','subject_proposals.status','Approved nominations require a withdrawn state');
    const withdrawalFk=constraints.find(c=>c.table_name==='subject_proposals'&&c.constraint_name==='subject_proposals_withdrawn_by_fkey');
    if(!withdrawalFk||!/ON DELETE SET NULL/i.test(withdrawalFk.definition))
      add('WITHDRAWAL_AUDIT_FK','subject_proposals.withdrawn_by','Withdrawal actor deletion must set the audit reference to NULL');
    const fk=constraints.find(c=>c.table_name==='subject_proposals'&&c.constraint_name==='subject_proposals_proposer_user_id_fkey');
    if(!fk||!/ON DELETE CASCADE/i.test(fk.definition))
      add('OWNER_DELETE_FK','subject_proposals.proposer_user_id','Delete must not leave orphaned private proposals');
  }
  if(tableSet.has('capo_stato_soggetti_approvati')){
    const fk=constraints.find(c=>c.table_name==='capo_stato_soggetti_approvati'&&c.constraint_name==='capo_stato_soggetti_approvati_source_proposal_id_fkey');
    if(!fk||!/ON DELETE SET NULL/i.test(fk.definition))
      add('PUBLIC_REFERENCE_FK','capo_stato_soggetti_approvati.source_proposal_id','Public directory must not retain personal ownership link');
    const idx=indexes.find(i=>i.table_name==='capo_stato_soggetti_approvati'&&i.index_name==='capo_stato_soggetti_approvati_name');
    if(!idx||!/CREATE UNIQUE INDEX/i.test(idx.definition))
      add('MISSING_UNIQUE_INDEX','capo_stato_soggetti_approvati.nome','Duplicate-name protection');
  }
  for(const name of PRIVATE_TABLES){
    const meta=tableSet.get(name);
    if(!meta) continue;
    if(meta.rls_enabled!==true) add('RLS_DISABLED',name,'Exposed-schema table must have RLS');
    for(const role of CLIENT_ROLES){
      const p=privileges.find(r=>r.table_name===name&&r.role_name===role);
      if(!p) add('ROLE_NOT_VERIFIED',name+'.'+role,'Cannot establish role grants');
      else if(p.can_select||p.can_insert||p.can_update||p.can_delete)
        add('DIRECT_CLIENT_ACCESS',name+'.'+role,'Only authenticated backend may read or write');
    }
  }
  return {ready:problems.length===0,problems,tableCount:tableSet.size,categoryCount:CATEGORIES.length};
}

async function inspectSchema(db,{schema='public'}={}){
  if(!/^[a-z][a-z0-9_]{0,62}$/i.test(schema)) throw Error('Invalid schema name');
  const names=Object.keys(REQUIRED_COLUMNS);
  const columnSql="SELECT table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[])";
  const tableSql="SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND c.relname=ANY($2::text[])";
  const constraintSql="SELECT t.relname AS table_name,con.conname AS constraint_name,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class t ON t.oid=con.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=ANY($2::text[])";
  const indexSql="SELECT tablename AS table_name,indexname AS index_name,indexdef AS definition FROM pg_indexes WHERE schemaname=$1 AND tablename=ANY($2::text[])";
  const privilegesSql="SELECT c.relname AS table_name,roles.rolname AS role_name,has_table_privilege(roles.oid,c.oid,'SELECT') AS can_select,has_table_privilege(roles.oid,c.oid,'INSERT') AS can_insert,has_table_privilege(roles.oid,c.oid,'UPDATE') AS can_update,has_table_privilege(roles.oid,c.oid,'DELETE') AS can_delete FROM pg_roles roles CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND roles.rolname=ANY($3::text[])";
  const args=[schema,names];
  const [columns,tables,constraints,indexes,privileges]=await Promise.all([
    db.query(columnSql,args),db.query(tableSql,args),db.query(constraintSql,args),
    db.query(indexSql,args),db.query(privilegesSql,[schema,PRIVATE_TABLES,CLIENT_ROLES])
  ]);
  return assessMetadata({columns:columns.rows,tables:tables.rows,constraints:constraints.rows,indexes:indexes.rows,privileges:privileges.rows});
}
module.exports={inspectSchema,assessMetadata,REQUIRED_COLUMNS};

if(require.main===module){
  (async()=>{
    if(process.env.DEMOS_PREFLIGHT_CONFIRM!=='staging-readonly')
      throw Error('Explicit staging-readonly acknowledgement required');
    const raw=process.env.DEMOS_PREFLIGHT_DATABASE_URL;
    if(!raw) throw Error('Missing DEMOS_PREFLIGHT_DATABASE_URL');
    const u=new URL(raw);
    if(!['postgres:','postgresql:'].includes(u.protocol)||
      !['127.0.0.1','db.fkeayjzvtuvzesljhjbc.supabase.co'].includes(u.hostname))
      throw Error('Only isolated local PG or exact DEMOS staging host permitted');
    const {Client}=require('pg');
    const db=new Client({connectionString:raw});
    await db.connect();
    try{
      await db.query('BEGIN READ ONLY');
      const result=await inspectSchema(db);
      await db.query('ROLLBACK');
      process.stdout.write(JSON.stringify(result,null,2)+'\n');
      if(!result.ready) process.exitCode=2;
    }finally{await db.end();}
  })().catch(e=>{
    process.stderr.write('Schema preflight unavailable: '+(e.message||'unknown error').replace(/postgres(?:ql)?:\/\/[^\s]+/ig,'[redacted]')+'\n');
    process.exitCode=1;
  });
}
