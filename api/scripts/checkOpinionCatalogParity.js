'use strict';
// Read-only release preflight. The checker NEVER mutates opinions or users.
// DATABASE_URL=<READ_ONLY_DATABASE_URL> node api/scripts/checkOpinionCatalogParity.js
// For later code-only releases: add --schema-only to skip the frozen legacy table.
const { Pool } = require('pg');
const { getAllOpinions } = require('../services/opinionCatalog');
const normalize = items => items.map(({id,text,gradi_opinione,approfondimento})=>({
  id, text, approfondimento, gradi_opinione:[...gradi_opinione].sort()
})).sort((a,b)=>a.id.localeCompare(b.id));

async function checkOpinionCatalogParity(pool,{schemaOnly=false}={}) {
  const published=getAllOpinions();
  const ids=new Set(published.map(x=>x.id));
  // This query reads schema definitions only, NEVER rows in opinioni_risposte.
  const {rows:columns}=await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='opinioni_risposte'
    ORDER BY column_name
  `);
  const serviceColumns=new Set(['user_id','fonti_opinioni']);
  const actual=new Map(columns.filter(x=>!serviceColumns.has(x.column_name))
    .map(x=>[x.column_name,x.data_type]));
  const missing=[...ids].filter(id=>!actual.has(id));
  const invalidType=[...ids].filter(id=>actual.has(id)&&actual.get(id)!=='text');
  // In subsequent releases, historical answer columns can legitimately remain:
  // removing a published question never implies deletion of personal responses.
  const unexpected=schemaOnly?[]:[...actual.keys()].filter(id=>!ids.has(id));
  if(missing.length||invalidType.length||unexpected.length){
    const summary=[
      missing.length?'Missing answer columns: '+missing.sort().join(','):null,
      invalidType.length?'Non-text answer columns: '+invalidType.sort().join(','):null,
      unexpected.length?'Unexpected answer columns at first cutover: '+unexpected.sort().join(','):null
    ].filter(Boolean).join('; ');
    throw new Error('Opinion answer schema drift: '+summary);
  }
  if(!schemaOnly){
    const {rows:sourceRows}=await pool.query(
      'SELECT id, text, gradi_opinione, approfondimento FROM public.opinioni_domande ORDER BY id'
    );
    const db=normalize(sourceRows), src=normalize(published);
    const old=new Map(db.map(op=>[op.id,JSON.stringify(op)]));
    const conflicts=[];
    for(const op of src){
      if(old.get(op.id)!==JSON.stringify(op))conflicts.push(op.id);
      old.delete(op.id);
    }
    for(const id of old.keys())conflicts.push(id);
    if(conflicts.length)throw new Error('Catalog drift IDs: '+[...new Set(conflicts)].sort().join(','));
  }
  return { published:published.length, checkedColumns:ids.size, mode:schemaOnly?'schema-only':'initial-cutover' };
}

async function main() {
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL with READ-ONLY credentials required');
  if(process.argv.slice(2).some(x=>x!=='--schema-only')){
    throw new Error('Allowed mode: --schema-only or no arguments for initial cutover');
  }
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  try{
    const result=await checkOpinionCatalogParity(pool,{schemaOnly:process.argv.includes('--schema-only')});
    console.log('Opinion parity confirmed: '+result.published+' published questions, '+result.checkedColumns+
      ' text answer columns ('+result.mode+')');
  }finally{await pool.end()}
}
if(require.main===module){
  main().catch(error=>{console.error(error.message);process.exitCode=1});
}
module.exports={checkOpinionCatalogParity};
