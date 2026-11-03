import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const page = readFileSync(new URL('../src/pages/VotiPoliticiFinali.tsx',import.meta.url),'utf8');

test('public Voti Politici route loads the dedicated final-vote page, not the old mixed vote list',()=>{
  assert.match(app,/import VotiPoliticiFinali from "\.\/pages\/VotiPoliticiFinali"/);
  assert.match(app,/path="\/voti-politici" component=\{VotiPoliticiFinali\}/);
  assert.doesNotMatch(app,/path="\/voti-politici" component=\{VotiPolitici\}/);
});

test('final-only page reads the source-filtered final-votes endpoint with freshness limit',()=>{
  assert.match(page,/\/api\/voti-politici\/votazioni-finali-decisive\?limit=50/);
  assert.match(page,/const maxAgeDays = 120/);
  assert.match(page,/data\.filter\(isRecentFinale\)/);
  assert.match(page,/new Date\(b\.data_votazione/);
  assert.match(page,/\.sort\(/);
  assert.doesNotMatch(page,/\/api\/voti-camera\/votazioni"/);
});

test('only administrator can request a live sync of final votes',()=>{
  assert.match(page,/user\?\.ruolo === "AD"/);
  assert.match(page,/sync-votazioni-finali-decisive/);
  assert.doesNotMatch(page,/\/api\/voti-camera\/sync/);
});

test('source links use a strict allowlist; no generation for unverified rollcalls',()=>{
  assert.match(page,/const sourcePrefix = "https:\/\/parlamento19\.openpolis\.it\/votazioni\//);
  assert.match(page,/target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(page,/generaSpiegazioneMutation|spiegazione\/|Genera Spiegazione/);
});

test('final list is keyboard accessible and clearly distinguishes vote final from full legislative enactment',()=>{
  assert.match(page,/role="list" aria-label="Elenco votazioni finali recenti"/);
  assert.match(page,/role="listitem"/);
  assert.match(page,/Vedi voti/);
  assert.doesNotMatch(page,/max-h-\[68dvh\] overflow-auto/);
  assert.match(page,/non significa necessariamente che una legge sia già definitivamente approvata/);
});
