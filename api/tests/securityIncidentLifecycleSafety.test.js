const test=require('node:test');const assert=require('node:assert/strict');
const {IncidentManager}=require('../security-agent/incidentManager');
const rank={info:0,low:1,medium:2,high:3,critical:4};
const at=n=>new Date(`2026-10-05T12:00:0${n}.000Z`);
const finding=(extra={})=>({findingId:'DET-LIFE:stable',ruleId:'DET-LIFE',title:'Lifecycle finding',severity:'high',count:2,firstSeen:at(0).toISOString(),lastSeen:at(0).toISOString(),eventIds:['e1'],...extra});

test('open duplicate keeps one incident and count never decreases',()=>{
 const m=new IncidentManager();const [first]=m.ingest([finding({count:5})],at(0));const [next]=m.ingest([finding({count:2,lastSeen:at(1).toISOString()})],at(1));
 assert.equal(next.incidentId,first.incidentId);assert.equal(next.count,5);assert.equal(m.list().length,1);
});

test('duplicate incident severity can escalate but never de-escalate',()=>{
 const m=new IncidentManager();const [first]=m.ingest([finding({severity:'high'})],at(0));
 const [critical]=m.ingest([finding({severity:'critical',count:3,lastSeen:at(1).toISOString()})],at(1));
 assert.equal(critical.incidentId,first.incidentId);assert.equal(critical.severity,'critical');
 const [lower]=m.ingest([finding({severity:'medium',count:4,lastSeen:at(2).toISOString()})],at(2));
 assert.equal(lower.severity,'critical');assert.ok(rank[lower.severity]>=rank[first.severity]);
});

test('acknowledged duplicate stays acknowledged and does not reopen implicitly',()=>{
 const m=new IncidentManager();const [first]=m.ingest([finding()],at(0));m.acknowledge(first.incidentId,at(1));
 const [next]=m.ingest([finding({count:4,lastSeen:at(2).toISOString()})],at(2));assert.equal(next.incidentId,first.incidentId);assert.equal(next.status,'acknowledged');
});

test('resolved incident is not mutated; a later same finding creates a new open incident',()=>{
 const m=new IncidentManager();const [first]=m.ingest([finding()],at(0));m.resolve(first.incidentId,at(1));
 const [next]=m.ingest([finding({count:6,lastSeen:at(2).toISOString()})],at(2));assert.notEqual(next.incidentId,first.incidentId);assert.equal(next.status,'open');
 const all=m.list();assert.equal(all.length,2);assert.equal(all.find(x=>x.incidentId===first.incidentId).status,'resolved');
});

test('unknown incident transitions are inert',()=>{const m=new IncidentManager();assert.equal(m.acknowledge('missing'),null);assert.equal(m.resolve('missing'),null);assert.deepEqual(m.list(),[]);});
