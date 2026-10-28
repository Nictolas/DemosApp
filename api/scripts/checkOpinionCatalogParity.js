'use strict';
// Read-only pre-release comparison; NEVER called from application traffic.
// DATABASE_URL=<read-only connection> node api/scripts/checkOpinionCatalogParity.js
const { Pool } = require('pg');
const { getAllOpinions } = require('../services/opinionCatalog');
const normalize = items => items.map(({id,text,gradi_opinione,approfondimento})=>({
  id, text, approfondimento, gradi_opinione:[...gradi_opinione].sort()
})).sort((a,b)=>a.id.localeCompare(b.id));
async function main() {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL read-only required');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  try {
    const res=await pool.query('SELECT id, text, gradi_opinione, approfondimento FROM public.opinioni_domande ORDER BY id');
    const db=normalize(res.rows), src=normalize(getAllOpinions());
    const map=new Map(db.map(op=>[op.id,JSON.stringify(op)]));
    const conflicts=[];
    for(const op of src){if(map.get(op.id)!==JSON.stringify(op))conflicts.push(op.id);map.delete(op.id)}
    for(const id of map.keys())conflicts.push(id);
    if(conflicts.length) throw new Error('Catalog drift IDs: '+[...new Set(conflicts)].sort().join(','));
    console.log('Catalog parity confirmed for '+src.length+' published questions');
  } finally { await pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
