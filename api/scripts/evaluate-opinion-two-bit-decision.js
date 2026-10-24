'use strict';

/**
 * DOC-054: repeatable pre-decision economics / storage evidence gate.
 *
 * Compares real PG17 allocation of *synthetic* 824-account tables built
 * by benchmark-opinion-mixed-sources.js; catalog table was created by
 * benchmark-opinion-mixed-performance.js in the same disposable CI DB.
 *
 * A GO decision requires observed production-sized/staging evidence,
 * complete integration/security/Android verification and an approved
 * economic threshold; this script cannot authorize a migration.
 */
const assert=require('node:assert/strict');
const {Client}=require('pg');
const DB='opinion_bitset_ci';
const ROWS=824;
const MIXES=[
  {id:0,name:'no_sources',fraction:0},
  {id:1,name:'rare_sources',fraction:0.10},
  {id:2,name:'moderate_sources',fraction:0.35},
  {id:3,name:'common_sources',fraction:0.75},
  {id:4,name:'all_sources',fraction:1}
];
const FORMATS=['text','fixed','trimmed','sparse','sparse_versioned','sparse_envelope'];
const SCALE=[824,10000,100000,1000000];
const round=(x,d=2)=>Number(x.toFixed(d));
const fmtName=(mix,format)=>'ci_mixed_'+mix.id+'_'+format;
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
      e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
      e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
      e.PGPASSWORD!=='synthetic-only'){
    throw Error('Refusing decision gate outside synthetic PG17 GitHub CI');
  }
}
async function measure(db,table){
  assert.match(table,/^ci_mixed_[0-4]_(?:text|fixed|trimmed|sparse|sparse_versioned|sparse_envelope)$/);
  const q=await db.query(
    'SELECT pg_total_relation_size($1::regclass)::bigint AS bytes,'+
    ' pg_relation_size($1::regclass)::bigint AS heap,'+
    ' pg_indexes_size($1::regclass)::bigint AS indexes',[table]);
  assert.equal(q.rowCount,1);
  const count=(await db.query('SELECT count(*)::integer AS n,'+
    'count(fonti_opinioni)::integer AS source_rows FROM '+table)).rows[0];
  assert.equal(count.n,ROWS);
  const row=q.rows[0],bytes=Number(row.bytes),
    heap=Number(row.heap),indexes=Number(row.indexes);
  assert.ok(Number.isSafeInteger(bytes)&&bytes>=heap+indexes);
  return {bytes,heap,indexes,toastAndMeta:bytes-heap-indexes,
    sourceRows:count.source_rows};
}
function project(legacy,candidate,sharedBytes){
  const perUser=(legacy-candidate)/ROWS;
  return SCALE.map(n=>({
    projectedAccounts:n,
    projectedTableDeltaBytesBeforeShared:round(perUser*n,0),
    projectedNetSavingsBytesWithShared:round(perUser*n-sharedBytes,0),
    projectedNetSavingsMiBWithShared:round((perUser*n-sharedBytes)/1048576,3)
  }));
}
async function main(){
  guard();
  const db=new Client({host:'127.0.0.1',port:5432,database:DB,
    user:'postgres',password:'synthetic-only',application_name:'doc054_cost_gate',
    statement_timeout:16000});
  await db.connect();
  try{
    const info=(await db.query(
      "SELECT current_database() db,current_user actor,current_setting('server_version_num')::int version")).rows[0];
    assert.equal(info.db,DB);assert.equal(info.actor,'postgres');
    assert.equal(Math.floor(info.version/10000),17);

    // The separate catalog allocation is already present from the latency
    // benchmark and must not be omitted in net versioned-encoding estimates.
    const catalogRow=(await db.query(
      "SELECT pg_total_relation_size('ci_mixed_catalog_bench'::regclass)::bigint AS bytes")).rows[0];
    const catalogBytes=Number(catalogRow.bytes);
    assert.ok(catalogBytes>0&&Number.isSafeInteger(catalogBytes));

    const scenario=[];
    for(const mix of MIXES){
      const sizes={};
      for(const format of FORMATS){
        sizes[format]=await measure(db,fmtName(mix,format));
        if(format!=='text'){
          assert.equal(sizes[format].sourceRows,sizes.text.sourceRows);
        }
      }
      const textBytes=sizes.text.bytes;
      const candidates=FORMATS.filter(format=>format!=='text').map(format=>{
        const cost=sizes[format];
        // Only two formats need the catalog lookup in this prototype.
        // In real deployments more formats may need it too.
        const sharedCatalogBytes=['sparse_versioned','sparse_envelope'].includes(format)
          ?catalogBytes:0;
        const saved=textBytes-cost.bytes;
        return {
          format,
          measuredBytes:cost.bytes,
          measuredBytesPerAccount:round(cost.bytes/ROWS),
          savedVsTextBytes:saved,
          savedVsTextPercent:round(100*saved/textBytes),
          incrementalSharedCatalogBytes:sharedCatalogBytes,
          netSavedAt824AccountsBytes:saved-sharedCatalogBytes,
          projectedProportionalTableOnly:project(textBytes,cost.bytes,sharedCatalogBytes)
        };
      });
      const versioned=candidates.find(x=>x.format==='sparse_versioned');
      const envelope=candidates.find(x=>x.format==='sparse_envelope');
      scenario.push({
        mix:mix.name,
        hypotheticalSourceFraction:mix.fraction,
        syntheticSourceRows:sizes.text.sourceRows,
        physicalTextBytes:textBytes,
        physicalTextPerAccountBytes:round(textBytes/ROWS),
        versioned,
        fullEnvelope:envelope,
        alternativeOptions:candidates.filter(x=>
          !['sparse_versioned','sparse_envelope'].includes(x.format))
          .map(x=>({format:x.format,
            savedVsTextPercent:x.savedVsTextPercent,
            measuredBytesPerAccount:x.measuredBytesPerAccount}))
      });
    }
    const central=scenario.find(x=>x.mix==='moderate_sources');
    assert.equal(central.syntheticSourceRows,288);
    assert.equal(central.physicalTextBytes,385024);
    assert.equal(central.versioned.measuredBytes,368640);
    assert.equal(central.fullEnvelope.measuredBytes,425984);
    assert.equal(catalogBytes,32768);
    assert.equal(central.versioned.netSavedAt824AccountsBytes,-16384);
    assert.ok(central.versioned.savedVsTextPercent>0&&
      central.versioned.savedVsTextPercent<5);
    assert.ok(central.fullEnvelope.savedVsTextPercent<0);
    // This is an evidence gate, not a user-approved migration threshold.
    // The real system still needs authentication/RLS, Android, staging
    // migration/rollback, steady-state cost and full database measurement.
    const recommendation={
      status:'DO_NOT_MIGRATE_FROM_CURRENT_EVIDENCE',
      kind:'provisional',notAnImplementationApproval:true,
      reasons:[
        'Metadata choices change savings to losses on the central fabricated source scenario.',
        'At 824 synthetic accounts, catalog table allocation exceeds the sparse-versioned table savings.',
        'Projected high-user counts are arithmetic sensitivity only, not verified server cost or free-tier capacity.',
        'Real route integration, RLS, consent, backup and older Android compatibility remain incomplete.',
        'A stable, current-production physical read-only baseline for the entire app is not yet proven.',
        'Any migration still requires approved rollout, rollback and demonstrable net benefit.'
      ],
      nextAction:'Prioritize low-risk SQL TEXT improvements; collect full-size read-only app baseline and a staging cost/risk comparison before requesting a schema migration decision.'
    };
    console.log('OPINION_2BIT_ECONOMIC_GATE_PASS');
    console.log('OPINION_2BIT_ECONOMIC_GATE_RESULT_JSON='+JSON.stringify({
      postgres:17,synthetic:true,subjects:ROWS,opinionSlots:94,
      sourceFrequenciesAreHypothetical:true,
      sourcePositionsAndLengthsAreInvented:true,
      measuredPhysicalSizes:'heap+indexes+TOAST for each fabricated table',
      catalogTableBytes:catalogBytes,
      scenarios:scenario,recommendation,
      limitations:[
        'Linear scaling of observed 824-row relation sizes ignores 8KiB pages, index growth, vacuum, WAL, TOAST, replication, concurrency and object-storage billing.',
        'No actual per-user dataset or aggregate source distribution is retrieved from Supabase.',
        'The 32 KiB catalog allocation is a separate synthetic table and might be shared or different in a real application.',
        'No production table swap, deploy, policy change, user data or Android release is performed.'
      ],
      noSupabaseWrites:true,
      noDeploy:true
    }));
  }finally{await db.end();}
}
main().catch(err=>{
  console.error('CI economic sensitivity failed:',err);
  process.exitCode=1;
});
