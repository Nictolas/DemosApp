'use strict';

// Offline integration contract across the civic push server and three actual
// DEMOS pages. No user data, database, Firebase messages or device credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {buildCivicPush} = require('../services/civicNewInitiativePushDispatcher');
const root = path.resolve(__dirname,'../..');
const read = rel => fs.readFileSync(path.join(root,rel),'utf8');
const app = read('client/src/App.tsx');

const routes = [
  {category:'iniziative_popolari',path:'/iniziative-popolari',
   component:'client/src/pages/IniziativePopolari/index.tsx'},
  {category:'referendum_abrogativi',path:'/referendum-abrogativi',
   component:'client/src/pages/ReferendumAbrogativi/index.tsx'},
  {category:'eci',path:'/eci',
   component:'client/src/pages/ECI/index.tsx'},
];

test('each civic FCM payload points to a real app route and official-id deep link',()=>{
  for(const [n,route] of routes.entries()) {
    const officialId = '2026/'+String(n+1)+' qualità & accesso';
    const payload = buildCivicPush({
      id:100+n,category:route.category,official_id:officialId,
      title:'Synthetic test title',
    });
    const destination=new URL(payload.data.link);
    assert.equal(destination.origin,'https://www.demos.community');
    assert.equal(destination.pathname,route.path);
    assert.equal(destination.searchParams.get('initiative'),officialId);
    assert.equal(payload.data.category,route.category);
    assert.equal(payload.data.official_id,officialId);
    assert.equal(payload.data.type,'civic_new_initiative');
    assert.equal(payload.android.ttl,60*60*1000);
    assert.match(app,new RegExp('<Route path="'+route.path+'"'));
    const src=read(route.component);
    assert.match(src,/new URLSearchParams\(window\.location\.search\)\.get\("initiative"\)/);
    assert.match(src,/deepLinkHandled\.current/);
  }
  assert.throws(()=>buildCivicPush({
    id:1,category:'unknown',official_id:'x',title:'synthetic'
  }),/CIVIC_UNSUPPORTED_CATEGORY/);
});

test('civic deep links are consumed only after the matching official record exists',()=>{
  const ministero=read(routes[0].component);
  const referendum=read(routes[1].component);
  const eci=read(routes[2].component);
  assert.match(ministero,
    /const item = iniziativeUfficiali\.find\([\s\S]{0,200}?\);\s*if \(item\) \{\s*deepLinkHandled\.current = true;\s*startEditView\(item\);/);
  assert.doesNotMatch(ministero,
    /const item = filteredAndSortedIniziative\.find/);
  assert.match(referendum,
    /const item = referendumUfficiali\.find\([\s\S]{0,200}?\);\s*if \(item\) \{[\s\S]{0,210}?deepLinkHandled\.current = true;\s*startEditView\(item\);/);
  assert.match(eci,
    /const item = baseList\.find\([\s\S]{0,200}?\);\s*if \(item\) \{[\s\S]{0,260}?deepLinkHandled\.current = true;\s*setViewItem\(item\);/);
});

test('native listener routes only in-app civic links through the app WebView',()=>{
  const hook=read('client/src/hooks/useNativePush.ts');
  assert.match(hook,/pushNotificationActionPerformed/);
  assert.match(hook,/openNotificationTarget\(action\)/);
  assert.match(hook,/data\.link\s*\|\|/);
  assert.match(hook,/window\.location\.href\s*=\s*\x60\$\{target\.pathname\}\$\{target\.search\}\$\{target\.hash\}\x60/);
});
