'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const USER = '00000000-0000-4000-8000-000000000601';
const routePath = require.resolve(path.join(__dirname, '..', 'routes', 'fcm-tokens.js'));
const databasePath = require.resolve(path.join(__dirname, '..', 'config', 'database.js'));
const authPath = require.resolve(path.join(__dirname, '..', 'middleware', 'auth.js'));

function makeFakeDatabase({
  legacy = [], canonical = [], legacyColumnMissing = false,
  failOperation = null, userMissing = false, delayFirstWrite = null,
} = {}) {
  const state = {
    legacy: [...legacy],
    devices: canonical.map(item => ({ ...item })),
    queries: [],
    released: 0,
    rolledBack: 0,
    committed: 0,
  };
  const backup = () => ({
    legacy: [...state.legacy], devices: state.devices.map(item => ({ ...item })),
  });
  const restore = (snapshot) => {
    state.legacy = [...snapshot.legacy];
    state.devices = snapshot.devices.map(item => ({ ...item }));
  };
  let waitForLock = Promise.resolve();
  let delayed = false;
  const connect = async () => {
    let initial = null;
    let savepoint = null;
    let releaseRowLock = null;
    let aborted = false;
    let active = false;
    async function close(commit) {
      if (!active) throw Error('No synthetic transaction');
      if (!commit) {
        restore(initial);
        state.rolledBack++;
      } else {
        if (aborted) throw Error('Cannot commit aborted SQL transaction');
        state.committed++;
      }
      active = false;
      if (releaseRowLock) {
        releaseRowLock();
        releaseRowLock = null;
      }
    }
    return {
      async query(sql, params = []) {
        const q = String(sql).replace(/\s+/g, ' ').trim();
        state.queries.push({ sql: q, params });
        if (q === 'BEGIN') {
          active = true;
          return {rows:[]};
        }
        if (q === 'COMMIT') { await close(true);return {rows:[]}; }
        if (q === 'ROLLBACK') { await close(false);return {rows:[]}; }
        if (q === 'SAVEPOINT fcm_legacy_column') {
          savepoint = backup();
          return {rows:[]};
        }
        if (q === 'RELEASE SAVEPOINT fcm_legacy_column') {
          savepoint = null;
          return {rows:[]};
        }
        if (q === 'ROLLBACK TO SAVEPOINT fcm_legacy_column') {
          if (!savepoint) throw Error('No legacy savepoint');
          restore(savepoint);
          aborted = false;
          return {rows:[]};
        }
        if (aborted) throw Object.assign(Error('Synthetic transaction aborted'),{code:'25P02'});
        if (q === 'SELECT id FROM public.users WHERE id = $1 FOR UPDATE') {
          const prior = waitForLock;
          let unlock;
          waitForLock = new Promise(resolve => {unlock=resolve;});
          await prior;
          releaseRowLock = unlock;
          initial = backup();
          return {rows:userMissing ? [] : [{id:params[0]}]};
        }
        if (failOperation && q.includes(failOperation)) {
          aborted = true;
          throw Object.assign(Error('Synthetic injected SQL failure'),{code:'23514'});
        }
        if (q.startsWith('SELECT COALESCE(fcm_tokens') && q.includes('FROM public.users')) {
          if (legacyColumnMissing) {
            aborted = true;
            throw Object.assign(Error('Synthetic legacy column missing'),{code:'42703'});
          }
          return { rows: [{ fcm_tokens: [...state.legacy] }] };
        }
        if (q.startsWith('SELECT 1 FROM public.users')) return { rows: [{ '?column?': 1 }] };
        if (q.startsWith('UPDATE public.users SET fcm_tokens')) {
          if (legacyColumnMissing) {
            aborted = true;
            throw Object.assign(Error('Synthetic legacy column missing'),{code:'42703'});
          }
          if (delayFirstWrite && !delayed) {
            delayed=true;
            await delayFirstWrite();
          }
          state.legacy = [...params[0]];
          return { rowCount: 1, rows: [] };
        }
        if (q.startsWith('INSERT INTO public.user_devices')) {
          const [userId, token] = params;
          const match = state.devices.find(item => item.token === token);
          if (match) {
            match.userId = userId;
            match.active = true;
          } else state.devices.push({ userId, token, active: true });
          return { rowCount: 1, rows: [] };
        }
        if (q.startsWith('UPDATE public.user_devices') && q.includes('fcm_token <> $2')) {
          for (const item of state.devices) {
            if (item.userId === params[0] && item.token !== params[1]) item.active = false;
          }
          return { rowCount: 1, rows: [] };
        }
        if (q.startsWith('UPDATE public.user_devices') && q.includes('btrim(fcm_token) = $2')) {
          for (const item of state.devices) {
            if (item.userId === params[0] && item.token.trim() === params[1]) item.active = false;
          }
          return { rowCount: 1, rows: [] };
        }
        if (q.startsWith('UPDATE public.user_devices') && q.includes('WHERE user_id = $1')) {
          for (const item of state.devices) if (item.userId === params[0]) item.active = false;
          return { rowCount: 1, rows: [] };
        }
        throw Error('Unexpected SQL in FCM synthetic HTTP test: '+q);
      },
      release() {
        if (active) throw Error('Released uncommitted synthetic FCM transaction');
        state.released++;
      }
    };
  };
  return {state, connect};
}

async function withSyntheticFcmRouter(pool, exercise) {
  const modulePaths = [routePath, databasePath, authPath];
  const oldCache = new Map(modulePaths.map(p => [p, require.cache[p]]));
  let server;
  const mock = (modulePath, exports) => {
    require.cache[modulePath] = {
      id: modulePath, filename: modulePath, loaded: true, exports,
    };
  };
  try {
    mock(databasePath, { getPool: () => pool });
    mock(authPath, { verifyToken(req, res, next) {
      req.user = { id: USER };
      next();
    } });
    delete require.cache[routePath];
    const router = require(routePath);
    const app = express();
    app.use(express.json());
    app.use('/api/fcm-tokens', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/fcm-tokens';
    await exercise(base);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [modulePath, previous] of oldCache) {
      if (previous) require.cache[modulePath] = previous;
      else delete require.cache[modulePath];
    }
  }
}

const mobile = { 'user-agent': 'Mozilla/5.0 (Linux; Android 16; Mobile)', 'content-type': 'application/json' };
const rawToken = 'X'.repeat(125);
const oldToken = 'Y'.repeat(125);

test('HTTP POST normalizes a new mobile token before both legacy and canonical persistence', async () => {
  const pool = makeFakeDatabase({
    legacy: [' ' + rawToken + ' ', oldToken],
    canonical: [
      { userId: USER, token: oldToken, active: true },
      { userId: USER, token: '  ' + rawToken + '  ', active: true },
    ],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base, {
      method: 'POST', headers: mobile, body: JSON.stringify({ token: '  ' + rawToken + '\t' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [rawToken]);
    const stored = pool.state.devices.find(d => d.token === rawToken);
    assert.ok(stored && stored.active, 'new token must be saved without outer whitespace');
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, false);
    assert.equal(pool.state.devices.find(d => d.token === '  ' + rawToken + '  ').active,false,
      'older whitespace variant must be deactivated after normalized replacement');
    const insert = pool.state.queries.find(q => q.sql.startsWith('INSERT INTO public.user_devices'));
    assert.deepEqual(insert.params, [USER, rawToken]);
    assert.ok(pool.state.queries.every(q => !/\b(?:FROM|UPDATE|INTO) users\b|\b(?:FROM|UPDATE|INTO) user_devices\b/i.test(q.sql)),
      'route must never resolve shadow tables');
  });
});

test('HTTP POST rejects non-string, short-after-trim and fake web_ tokens before any query', async () => {
  const pool = makeFakeDatabase();
  await withSyntheticFcmRouter(pool, async base => {
    for (const token of [{ value: rawToken }, null, ' '.repeat(25) + 'a'.repeat(98), '   web_' + 'z'.repeat(130)]) {
      const response = await fetch(base, {
        method: 'POST', headers: mobile, body: JSON.stringify({ token }),
      });
      assert.equal(response.status, 400);
    }
    assert.equal(pool.state.queries.length, 0);
  });
});

test('HTTP cleanup normalizes only explicitly selected valid token, without bulk migration', async () => {
  const pool = makeFakeDatabase({
    legacy: [oldToken, '  ' + rawToken + '  '],
    canonical: [{ userId: USER, token: oldToken, active: true }],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base + '/cleanup', { method: 'POST', headers: mobile });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [rawToken]);
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, false);
    assert.equal(pool.state.devices.find(d => d.token === rawToken).active, true);
  });
});

test('HTTP DELETE revokes padded historical canonical and legacy copies of one token', async () => {
  const pool = makeFakeDatabase({
    legacy: [' ' + rawToken + ' ', oldToken],
    canonical: [
      { userId: USER, token: '  ' + rawToken + ' ', active: true },
      { userId: USER, token: oldToken, active: true },
    ],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base + '/' + encodeURIComponent(' ' + rawToken + ' '), {
      method: 'DELETE', headers: mobile,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [oldToken]);
    assert.equal(pool.state.devices.find(d => d.token.trim() === rawToken).active, false);
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, true);
    assert.ok(pool.state.queries.some(q =>
      q.sql.includes('UPDATE public.user_devices') &&
      q.sql.includes('btrim(fcm_token) = $2') && q.params[1] === rawToken
    ));
  });
});

test('HTTP POST retains column-missing legacy fallback without skipping canonical token writes', async () => {
  const pool = makeFakeDatabase({ legacyColumnMissing: true });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base, {
      method: 'POST', headers: mobile, body: JSON.stringify({ token: '   ' + rawToken + ' ' }),
    });
    assert.equal(response.status, 200);
    assert.equal(pool.state.devices.find(d => d.token === rawToken).active, true);
    assert.ok(pool.state.queries.some(q => q.sql.startsWith('SELECT 1 FROM public.users')));
    assert.equal(pool.state.legacy.length, 0);
  });
});

test('HTTP POST failure rolls back both legacy and canonical writes', async () => {
  const pool = makeFakeDatabase({
    legacy: [oldToken],
    canonical: [{userId:USER,token:oldToken,active:true}],
    failOperation:'INSERT INTO public.user_devices',
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base,{
      method:'POST',headers:mobile,body:JSON.stringify({token:rawToken})
    });
    assert.equal(response.status,500);
    assert.equal('details' in await response.json(),false);
  });
  assert.deepEqual(pool.state.legacy,[oldToken]);
  assert.deepEqual(pool.state.devices,[{userId:USER,token:oldToken,active:true}]);
  assert.equal(pool.state.rolledBack,1);
  assert.equal(pool.state.committed,0);
  assert.equal(pool.state.released,1);
});

test('HTTP cleanup failure cannot commit partly deactivated canonical devices', async () => {
  const original=[
    {userId:USER,token:oldToken,active:true},
    {userId:USER,token:rawToken,active:true},
  ];
  const pool=makeFakeDatabase({
    legacy:[oldToken,rawToken],canonical:original,
    failOperation:'UPDATE public.user_devices SET is_active',
  });
  await withSyntheticFcmRouter(pool,async base=>{
    const response=await fetch(base+'/cleanup',{method:'POST',headers:mobile});
    assert.equal(response.status,500);
    assert.equal('details' in await response.json(),false);
  });
  assert.deepEqual(pool.state.legacy,[oldToken,rawToken]);
  assert.deepEqual(pool.state.devices,original);
  assert.equal(pool.state.rolledBack,1);
  assert.equal(pool.state.released,1);
});

test('HTTP DELETE failure rolls back the legacy removal as well', async () => {
  const original={userId:USER,token:rawToken,active:true};
  const pool=makeFakeDatabase({
    legacy:[rawToken,oldToken],canonical:[original],
    failOperation:'AND btrim(fcm_token) = $2',
  });
  await withSyntheticFcmRouter(pool,async base=>{
    const response=await fetch(base+'/'+rawToken,{method:'DELETE',headers:mobile});
    assert.equal(response.status,500);
  });
  assert.deepEqual(pool.state.legacy,[rawToken,oldToken]);
  assert.deepEqual(pool.state.devices,[original]);
  assert.equal(pool.state.rolledBack,1);
  assert.equal(pool.state.released,1);
});

test('all FCM mutation routes return 404 and rollback when the canonical account is absent',async()=>{
  const pool=makeFakeDatabase({userMissing:true});
  await withSyntheticFcmRouter(pool,async base=>{
    const post=await fetch(base,{method:'POST',headers:mobile,body:JSON.stringify({token:rawToken})});
    const cleanup=await fetch(base+'/cleanup',{method:'POST',headers:mobile});
    const remove=await fetch(base+'/'+rawToken,{method:'DELETE',headers:mobile});
    assert.deepEqual([post.status,cleanup.status,remove.status],[404,404,404]);
  });
  assert.equal(pool.state.committed,0);
  assert.equal(pool.state.rolledBack,3);
  assert.equal(pool.state.released,3);
  assert.equal(pool.state.queries.some(x=>/UPDATE public\.|INSERT INTO public\./.test(x.sql)),false);
});

test('legacy SQLSTATE 42703 uses rollback-to-savepoint then commits canonical registration',async()=>{
  const pool=makeFakeDatabase({legacyColumnMissing:true});
  await withSyntheticFcmRouter(pool,async base=>{
    const post=await fetch(base,{method:'POST',headers:mobile,body:JSON.stringify({token:rawToken})});
    assert.equal(post.status,200);
  });
  assert.equal(pool.state.committed,1);
  assert.equal(pool.state.rolledBack,0);
  assert.equal(pool.state.released,1);
  assert.equal(pool.state.queries.filter(q=>q.sql==='ROLLBACK TO SAVEPOINT fcm_legacy_column').length,2);
  assert.deepEqual(pool.state.legacy,[]);
  assert.equal(pool.state.devices.find(x=>x.token===rawToken).active,true);
});

test('same-account concurrent register then revoke serialize: revocation wins after commit',async()=>{
  let entered;
  const firstWrite=new Promise(resolve=>{entered=resolve});
  let resume;
  const hold=new Promise(resolve=>{resume=resolve});
  const pool=makeFakeDatabase({
    delayFirstWrite:async()=>{entered();await hold}
  });
  await withSyntheticFcmRouter(pool,async base=>{
    const register=fetch(base,{
      method:'POST',headers:mobile,body:JSON.stringify({token:rawToken})
    });
    await firstWrite;
    const revoke=fetch(base+'/'+rawToken,{method:'DELETE',headers:mobile});
    try {
      let seen=false;
      for(let i=0;i<80;i++){
        if(pool.state.queries.filter(q=>q.sql==='SELECT id FROM public.users WHERE id = $1 FOR UPDATE').length===2){
          seen=true;break;
        }
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(seen,true,'revocation must contend on canonical public.users row');
      assert.equal(pool.state.committed,0,'registration must still hold its row lock');
    } finally {
      resume();
    }
    const [a,b]=await Promise.all([register,revoke]);
    assert.equal(a.status,200);
    assert.equal(b.status,200);
  });
  assert.deepEqual(pool.state.legacy,[]);
  assert.equal(pool.state.devices.find(x=>x.token===rawToken).active,false);
  assert.equal(pool.state.committed,2);
  assert.equal(pool.state.released,2);
});
