'use strict';
// Static guard: private synthetic staging fixture files must never grant
// access via Supabase Data API roles, write into public, or use DEFINER.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const setup=file('api/staging/op37_sondaggi_private_synthetic.sql');
const benchmark=file('api/staging/op37_compare_staging_sql.sql');

test('staging fixture remains in a private named schema with RLS on every table',()=>{
 assert.match(setup,/^CREATE SCHEMA op37_sondaggi_ci;$/m);
 assert.match(setup,/REVOKE ALL ON SCHEMA op37_sondaggi_ci FROM PUBLIC, anon, authenticated, service_role/);
 assert.match(setup,/REVOKE ALL ON ALL TABLES IN SCHEMA op37_sondaggi_ci FROM PUBLIC, anon, authenticated, service_role/);
 assert.equal([...setup.matchAll(/ENABLE ROW LEVEL SECURITY;/g)].length,4);
 assert.doesNotMatch(setup,/CREATE TABLE (?:public|auth|storage)\./);
 assert.doesNotMatch(setup,/\bGRANT\s+(?:ALL|SELECT|USAGE|EXECUTE)\s+.*\b(?:anon|authenticated|service_role)\b/i);
 assert.match(setup,/generate_series\(1,1200\)/);
 assert.match(setup,/CASE WHEN g BETWEEN 1 AND 10 THEN 'f' ELSE NULL END/);
});
test('staging SQL benchmark is invoker-only and cannot become a public RPC',()=>{
 assert.match(benchmark,/CREATE OR REPLACE FUNCTION op37_sondaggi_ci\.compare_sql_modes_ci/);
 assert.match(benchmark,/SECURITY INVOKER/);
 assert.doesNotMatch(benchmark,/SECURITY DEFINER/);
 assert.match(benchmark,/REVOKE ALL ON FUNCTION op37_sondaggi_ci\.compare_sql_modes_ci\(integer\)/);
 assert.match(benchmark,/sample_runs < 3 OR sample_runs > 12/);
 assert.doesNotMatch(benchmark,/(?:ALTER|DROP|TRUNCATE)\s+TABLE\s+(?:public|auth|storage)\./i);
 assert.doesNotMatch(benchmark,/\bINSERT\s+INTO\s+(?:public|auth|storage)\./i);
});
