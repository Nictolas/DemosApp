import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  normalizeCivicNotificationTarget as normalize,
  rememberCivicNotificationTarget as remember,
  consumePendingCivicNotificationTarget as consume,
} from '../../client/src/lib/civic-notification-pending-link.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');

function memoryStorage() {
  const data=new Map();
  return {
    getItem:key=>data.get(key)??null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key),
    get length(){return data.size;},
    key:i=>[...data.keys()][i]??null,
    clear:()=>data.clear(),
  };
}

test('only trusted civic official-item links survive normalization',()=>{
  for(const p of ['/eci','/iniziative-popolari','/referendum-abrogativi']) {
    const id='2026/1 qualità & accesso';
    const link='https://www.demos.community'+p+'?initiative='+encodeURIComponent(id);
    assert.equal(normalize(link),p+'?initiative='+encodeURIComponent(id));
    assert.equal(normalize(p+'?initiative=TEST_123'),p+'?initiative=TEST_123');
    assert.equal(normalize('https://demos.community'+p+'?initiative=1'),p+'?initiative=1');
  }
  for(const bad of [
    '', 'javascript:alert(1)', 'https://evil.example/eci?initiative=1',
    'http://www.demos.community/eci?initiative=1',
    'https://www.demos.community.evil.example/eci?initiative=1',
    'https://user:pass@www.demos.community/eci?initiative=1',
    'https://www.demos.community/eci?initiative=1#extra',
    '/eci', '/eci?initiative=', '/eci?initiative=1&initiative=2',
    '/eci?initiative=1&redirect=https://evil.example',
    '/auth?initiative=1', '/profilo?initiative=1',
    '//evil.example/eci?initiative=1',
    '/eci?initiative='+('X'.repeat(201)),
    '/eci?initiative='+encodeURIComponent('\n'),
  ]) assert.equal(normalize(bad),null,bad.slice(0,90));
});

test('pending civic destination is session-only, one-shot and expires after 15 minutes',()=>{
  const store=memoryStorage();
  const target='/eci?initiative=QA-ONLY-NOT-REAL';
  assert.equal(remember(target,store,10000),true);
  assert.equal(consume(store,10001),target);
  assert.equal(consume(store,10002),null);
  assert.equal(remember('/iniziative-popolari?initiative=123',store,0),true);
  assert.equal(consume(store,15*60*1000+1),null);
  assert.equal(remember('/referendum-abrogativi?initiative=123',store,500),true);
  assert.equal(consume(store,499),null);
  assert.equal(remember('/eci?initiative=x&evil=1',store,1000),false);
  assert.equal(consume(store,1002),null);
});

test('storage unavailable or broken fails closed',()=>{
  const broken={
    getItem(){throw Error('storage restricted');},
    setItem(){throw Error('storage restricted');},
    removeItem(){throw Error('storage restricted');},
  };
  assert.equal(remember('/eci?initiative=1',null),false);
  assert.equal(consume(null),null);
  assert.equal(remember('/eci?initiative=1',broken),false);
  assert.equal(consume(broken),null);
});

test('Android civic tap saves only guest target and auth resumes it after success',()=>{
  const native=read('client/src/hooks/useNativePush.ts');
  const auth=read('client/src/hooks/useAuthLogin.ts');
  assert.match(native,/if \(!getAuthToken\(\)\) rememberCivicNotificationTarget\(target\.toString\(\)\)/);
  assert.match(native,/rememberCivicNotificationTarget[\s\S]*?window\.location\.href =/);
  const hits=auth.match(/window\.location\.href = consumePendingCivicNotificationTarget\(\) \|\| "\/profilo"/g)||[];
  assert.equal(hits.length,2,'both OAuth and passkey existing-user success preserve the link');
  assert.match(auth,/if \(result\.isNew === false\)/);
  assert.doesNotMatch(native,/localStorage\.setItem\(.+initiative/);
});
