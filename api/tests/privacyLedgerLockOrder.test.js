'use strict';

// The ledger replay helper is invoked by maintenance/reconciliation code.
// Its SQL statements must take the users row lock BEFORE deleting opinions,
// matching the ordering of the live POST and PUT /revoke transactions.
// All queries are mocked; no database, real identities or network calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const PrivacyErasureLedgerService = require('../services/privacyErasureLedgerService');

test('ledger replay revokes users then user_consents before deleting responses', async()=>{
  const events=[];
  const client={
    async query(statement,params=[]){
      const sql=String(statement).replace(/\s+/g,' ').trim();
      if(sql.startsWith('SELECT EXISTS')&&sql.includes('information_schema.columns')){
        return {rows:[{exists:true}]};
      }
      if(sql.startsWith('UPDATE users SET')){
        assert.deepEqual(params,['synthetic-user']);
        events.push('UPDATE_USERS');
        return {rowCount:1,rows:[]};
      }
      if(sql.startsWith('UPDATE user_consents SET')){
        assert.deepEqual(params,['synthetic-user']);
        events.push('UPDATE_USER_CONSENTS');
        return {rowCount:1,rows:[]};
      }
      if(sql.startsWith('DELETE FROM "opinioni_risposte"')){
        assert.deepEqual(params,['synthetic-user']);
        events.push('DELETE_OPINIONS');
        return {rowCount:2,rows:[]};
      }
      throw Error('Unexpected synthetic SQL: '+sql);
    }
  };
  const result=await PrivacyErasureLedgerService.enforcePoliticalRevocation(
    client,'synthetic-user'
  );
  assert.deepEqual(events,['UPDATE_USERS','UPDATE_USER_CONSENTS','DELETE_OPINIONS']);
  assert.deepEqual(result,{opinionsDeleted:2});
});

test('ledger replay fails closed if the users consent update errors',async()=>{
  const events=[];
  const client={
    async query(statement){
      const sql=String(statement).replace(/\s+/g,' ').trim();
      if(sql.startsWith('SELECT EXISTS')&&sql.includes('information_schema.columns'))
        return {rows:[{exists:true}]};
      if(sql.startsWith('UPDATE users SET')){
        events.push('UPDATE_USERS_FAILURE');
        throw Error('synthetic users lock failure');
      }
      if(sql.startsWith('DELETE FROM'))events.push('DELETE_WOULD_BE_UNSAFE');
      throw Error('Unexpected synthetic SQL: '+sql);
    }
  };
  await assert.rejects(
    PrivacyErasureLedgerService.enforcePoliticalRevocation(client,'synthetic-user'),
    /synthetic users lock failure/
  );
  assert.deepEqual(events,['UPDATE_USERS_FAILURE']);
});
