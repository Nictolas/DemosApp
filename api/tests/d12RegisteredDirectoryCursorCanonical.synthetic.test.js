'use strict';
// Synthetic cursor-only regression. No network, database or personal records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decodeRegisteredCursor,pageRegistered,LIMIT}=require('../services/registeredDirectoryPage');
const id='00000000-0000-4000-8000-000000000001';
test('registered directory cursor requires canonical base64url encoding',()=>{
  const canonical=Buffer.from(JSON.stringify([0,id])).toString('base64url');
  assert.deepEqual(decodeRegisteredCursor(canonical),[0,id]);
  assert.equal(decodeRegisteredCursor(canonical+'A'),false,
    'noncanonical trailing bits must not alias the same cursor');
  assert.equal(decodeRegisteredCursor(canonical+'='),false);
  assert.equal(decodeRegisteredCursor(canonical.replace(/.$/,'*')),false);
  assert.equal(decodeRegisteredCursor(''),null);
  assert.equal(decodeRegisteredCursor(null),null);
  // Valid base64url is not sufficient: malformed tuples must fail closed.
  for(const tuple of [[-1,id],[2147483648,id],[1,'not-a-uuid'],['1',id],
    [1,id,'extra'],[1],{},null,[1,null],[1,id.toUpperCase()+'suffix'],
    [1.5,id],[null,id],[true,id]]){
    assert.equal(decodeRegisteredCursor(Buffer.from(JSON.stringify(tuple)).toString('base64url')),false);
  }
});
test('pageRegistered produces a cursor accepted by strict decoder',()=>{
  const rows=Array.from({length:LIMIT+1},(_,i)=>({
    id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
    supporters_count:LIMIT+1-i
  }));
  const page=pageRegistered(rows);
  assert.equal(page.rows.length,LIMIT);
  assert.deepEqual(decodeRegisteredCursor(page.members_next_cursor),
    [rows[LIMIT-1].supporters_count,rows[LIMIT-1].id]);
});
