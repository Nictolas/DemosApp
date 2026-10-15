const test=require('node:test');const assert=require('node:assert/strict');const {boundedInt,query,readLimit,readIncidents}=require('../security-agent/securityCenterQueryPolicy');const {createSecurityCenterHandlers}=require('../security-agent/securityCenterApi');
function res(){return {code:200,body:null,status(n){this.code=n;return this},json(x){this.body=x;return this}}}
test('bounded integer accepts safe values',()=>assert.equal(boundedInt('20','limit',{fallback:10}),20));
test('bounded integer rejects negative decimal huge and text',()=>{for(const x of ['-1','1.5','9999','10x'])assert.throws(()=>boundedInt(x,'limit'),/INVALID_QUERY/)});
test('arrays and objects rejected',()=>{assert.throws(()=>boundedInt(['1'],'limit'),/INVALID_QUERY/);assert.throws(()=>boundedInt({x:1},'limit'),/INVALID_QUERY/)});
test('unexpected query keys rejected',()=>assert.throws(()=>query({query:{limit:'1',write:'x'}},['limit']),/UNEXPECTED_QUERY/));
test('health permits no query parameters',()=>assert.deepEqual(query({query:{}},[]),{}));
test('incidents only returns allowlisted fields',()=>assert.deepEqual(readIncidents({query:{status:'open',severity:'high',limit:'2'}}),{status:'open',severity:'high',limit:2}));
test('limit fallback remains deterministic',()=>assert.equal(readLimit({query:{}},'limit',20),20));
test('overview receives numeric bounded recentLimit',async()=>{let got;const h=createSecurityCenterHandlers({getOverview:async x=>(got=x,{}),listIncidents:async()=>[],getHealth:async()=>({})});const r=res();await h.overview({query:{recentLimit:'8'}},r);assert.equal(got.recentLimit,8)});
test('invalid overview query fails generically',async()=>{const h=createSecurityCenterHandlers({getOverview:async()=>({}),listIncidents:async()=>[],getHealth:async()=>({})});const r=res();await h.overview({query:{recentLimit:'9999'}},r);assert.equal(r.code,500);assert.equal(r.body.error,'SECURITY_CENTER_READ_FAILED')});
test('unexpected boundary parameter is rejected',async()=>{const h=createSecurityCenterHandlers({getOverview(){},listIncidents(){},getHealth(){},getBoundaryAudit:async()=>({})});const r=res();await h.boundaryAudit({query:{limit:'2',action:'x'}},r);assert.equal(r.code,500)});
test('health rejects all query input',async()=>{const h=createSecurityCenterHandlers({getOverview(){},listIncidents(){},getHealth:async()=>({})});const r=res();await h.health({query:{debug:'1'}},r);assert.equal(r.code,500)});
test('oversized scalar rejected',()=>assert.throws(()=>readIncidents({query:{status:'x'.repeat(65)}}),/INVALID_QUERY/));