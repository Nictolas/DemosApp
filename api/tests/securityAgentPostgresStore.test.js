const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PostgresSecurityStore } = require('../security-agent/postgresSecurityStore');

function makePool() {
  const calls = [];
  const pool = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/INSERT INTO security_agent\.incidents/.test(sql)) return { rows: [{incident_id:params[0],finding_id:params[1],rule_id:params[2],severity:params[3],status:params[4],event_count:params[5],first_seen:params[6],last_seen:params[7],created_at:params[8],updated_at:params[9]}] };
      if (/FROM security_agent\.incidents/.test(sql) && /ORDER BY/.test(sql)) return { rows: [{incident_id:'inc-1',finding_id:'find-1',rule_id:'DET-X',severity:'high',status:'open',event_count:'3',first_seen:'2026-10-03T10:00:00Z',last_seen:'2026-10-03T10:01:00Z',created_at:'2026-10-03T10:00:00Z',updated_at:'2026-10-03T10:01:00Z'}] };
      if (/INSERT INTO security_agent\.source_state/.test(sql)) return { rows: [{source_name:params[0],enabled:params[1],watermark:params[2],last_poll_started_at:params[3],last_success_at:params[4],last_failure_at:params[5],consecutive_failures:params[6],total_polls:params[7],total_fetched:params[8],total_accepted:params[9],total_duplicates:params[10],stored_at:params[11]}] };
      if (/FROM security_agent\.source_state/.test(sql) && /WHERE source_name/.test(sql)) return { rows: [] };
      if (/DELETE FROM security_agent\.incidents/.test(sql)) return { rowCount: 2, rows: [] };
      if (/incident_count/.test(sql)) return { rows: [{ incident_count: '4' }] };
      if (/source_count/.test(sql)) return { rows: [{ source_count: '1' }] };
      if (/GROUP BY severity/.test(sql)) return { rows: [{ severity:'high',count:'2'},{severity:'critical',count:'1'}] };
      if (/GROUP BY status/.test(sql)) return { rows: [{ status:'open',count:'3'},{status:'resolved',count:'1'}] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() { return { async query(sql, params=[]) { if (['BEGIN','COMMIT','ROLLBACK'].includes(sql)) { calls.push({sql,params}); return {rows:[]}; } return pool.query(sql, params); }, release() {} }; }
  };
  return pool;
}
function incident(overrides={}) { return {incidentId:'inc-1',findingId:'find-1',ruleId:'DET-X',severity:'high',status:'open',count:3,firstSeen:'2026-10-03T10:00:00Z',lastSeen:'2026-10-03T10:01:00Z',createdAt:'2026-10-03T10:00:00Z',updatedAt:'2026-10-03T10:01:00Z',title:'must not persist',userId:'user-secret',ip:'203.0.113.10',payload:{opinion:'secret'},...overrides}; }

test('durable store persists only allowlisted incident fields', async () => { const pool=makePool(); const store=new PostgresSecurityStore({pool}); await store.upsertIncidents([incident()]); const call=pool.calls.find(x=>/INSERT INTO security_agent\.incidents/.test(x.sql)); assert.doesNotMatch(JSON.stringify(call),/must not persist|user-secret|203\.0\.113\.10|opinion|payload/); });
test('incident filters are parameterized and bounded', async () => { const pool=makePool(); const store=new PostgresSecurityStore({pool}); await store.listIncidents({status:'open',severity:'high',limit:25}); const call=pool.calls.find(x=>/FROM security_agent\.incidents/.test(x.sql)&&/ORDER BY/.test(x.sql)); assert.deepEqual(call.params,['open','high',25]); await assert.rejects(()=>store.listIncidents({status:'DROP TABLE'}),/invalid status/); });
test('source state contains counters and timestamps only', async () => { const pool=makePool(); const store=new PostgresSecurityStore({pool}); await store.saveSourceState('axiom-security',{enabled:true,totals:{polls:2,fetched:9,accepted:8,duplicates:1},token:'secret'},new Date('2026-10-03T10:01:00Z')); assert.doesNotMatch(JSON.stringify(pool.calls),/token|secret/); });
test('runtime store cannot prune without a maintenance pool', async () => { const pool=makePool(); const store=new PostgresSecurityStore({pool,retentionMs:24*60*60*1000}); assert.equal(await store.prune({now:new Date('2026-10-03T12:00:00Z')}),0); assert.equal(pool.calls.some(x=>/DELETE FROM security_agent\.incidents/.test(x.sql)),false); });
test('prune uses only the dedicated maintenance pool', async () => { const pool=makePool(); const maintenancePool=makePool(); const store=new PostgresSecurityStore({pool,maintenancePool,retentionMs:24*60*60*1000}); const removed=await store.prune({now:new Date('2026-10-03T12:00:00Z')}); assert.equal(removed,2); assert.equal(pool.calls.some(x=>/DELETE FROM/.test(x.sql)),false); const call=maintenancePool.calls.find(x=>/DELETE FROM security_agent\.incidents/.test(x.sql)); assert.deepEqual(call.params,['2026-10-02T12:00:00.000Z']); });
test('stats are aggregated server-side', async () => { const pool=makePool(); const store=new PostgresSecurityStore({pool}); const stats=await store.stats(); assert.deepEqual(stats,{incidentCount:4,sourceCount:1,bySeverity:{high:2,critical:1},byStatus:{open:3,resolved:1}}); });
test('migration draft has isolated schema and no foreign keys to app domains', () => { const sql=fs.readFileSync(path.join(__dirname,'../security-agent/migrations/001_security_store.sql'),'utf8'); const executable=sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n'); assert.match(executable,/CREATE SCHEMA IF NOT EXISTS security_agent/i); assert.doesNotMatch(executable,/\bREFERENCES\b/i); assert.doesNotMatch(executable,/\b(user_id|account_id|participant_id|email|ip_address|codice_fiscale)\b/i); });
test('migration separates writer reader and maintenance roles', () => { const sql=fs.readFileSync(path.join(__dirname,'../security-agent/migrations/001_security_store.sql'),'utf8'); assert.match(sql,/demos_security_agent_writer NOLOGIN[^;]*NOBYPASSRLS/i); assert.match(sql,/demos_security_center_reader NOLOGIN[^;]*NOBYPASSRLS/i); assert.match(sql,/demos_security_agent_maintenance NOLOGIN[^;]*NOBYPASSRLS/i); assert.match(sql,/GRANT SELECT, INSERT, UPDATE ON security_agent\.incidents TO demos_security_agent_writer/i); assert.doesNotMatch(sql,/GRANT[^;]*DELETE[^;]*TO demos_security_agent_writer/i); assert.match(sql,/GRANT DELETE ON security_agent\.incidents TO demos_security_agent_maintenance/i); });
test('migration is fail-closed for Supabase API roles and forces RLS', () => { const sql=fs.readFileSync(path.join(__dirname,'../security-agent/migrations/001_security_store.sql'),'utf8'); assert.match(sql,/service_role/i); assert.match(sql,/authenticator/i); assert.match(sql,/FORCE ROW LEVEL SECURITY/i); assert.match(sql,/ALTER DEFAULT PRIVILEGES IN SCHEMA security_agent REVOKE/i); });
