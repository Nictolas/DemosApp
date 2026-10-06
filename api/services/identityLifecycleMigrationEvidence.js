const crypto=require('crypto');
const canonicalEvidence=({migrationVersion,schemaReady,backfillReady,missingAccounts,laggingAccounts,observedAt})=>JSON.stringify({migrationVersion:String(migrationVersion),schemaReady:schemaReady===true,backfillReady:backfillReady===true,missingAccounts:Number(missingAccounts),laggingAccounts:Number(laggingAccounts),observedAt:new Date(observedAt).toISOString()});
const digestEvidence=(e)=>crypto.createHash('sha256').update('demos:identity-lifecycle-migration:v1\0'+canonicalEvidence(e),'utf8').digest();
const persistMigrationEvidence=async(client,e)=>{
 if(!client||typeof client.query!=='function')throw new Error('Migration evidence client required');
 const observedAt=new Date(e.observedAt);if(!Number.isFinite(observedAt.getTime()))throw new Error('Invalid migration evidence timestamp');
 for(const n of [e.missingAccounts,e.laggingAccounts])if(!Number.isSafeInteger(Number(n))||Number(n)<0)throw new Error('Invalid migration evidence count');
 const digest=digestEvidence(e),id=crypto.randomUUID();
 await client.query(`INSERT INTO identity.lifecycle_migration_evidence
 (evidence_id,migration_version,schema_ready,backfill_ready,missing_accounts,lagging_accounts,observed_at,evidence_digest)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[id,String(e.migrationVersion),e.schemaReady===true,e.backfillReady===true,Number(e.missingAccounts),Number(e.laggingAccounts),observedAt,digest]);
 return{id,evidenceDigest:digest.toString('hex')};
};
const verifyMigrationEvidence=(e,expectedHex)=>{const actual=digestEvidence(e);const expected=Buffer.from(String(expectedHex),'hex');return expected.length===actual.length&&crypto.timingSafeEqual(actual,expected);};
module.exports={canonicalEvidence,digestEvidence,persistMigrationEvidence,verifyMigrationEvidence};
