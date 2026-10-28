'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const apiRoot=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(apiRoot,p),'utf8');

const migrated=[
  "routes/sondaggi.js",
  "routes/compatibility.js",
  "routes/opinioni/compatibility.js",
  "routes/opinioni/management.js",
  "routes/opinioni/user-answers.js",
  "routes/opinioni/stats.js",
  "routes/statistiche.js",
  "routes/users/profile.js",
  "routes/bacheca.js",
  "routes/opinioni-proposte.js",
  "routes/test-opinioni-endpoints.js",
  "routes/test-opinioni-proposte.js",
  "routes/dpo/overview.js",
  "services/politicalMatchingService.js",
  "services/politicalOpinionNotificationService.js",
  "services/opinioniCheckMissing.js",
  "utils/opinionStatsColumns.js"
];

test('primary backend surfaces do not query the old official questions table',()=>{
  for(const p of migrated){
    const code=source(p);
    assert.doesNotMatch(code,/\bFROM\s+(?:public\.)?opinioni_domande\b/i,p);
    assert.doesNotMatch(code,/\bJOIN\s+(?:public\.)?opinioni_domande\b/i,p);
  }
});

test('published catalog is not writable by Admin or draft proposal routes',()=>{
  const management=source('routes/opinioni/management.js');
  const details=source('routes/opinioni/user-answers.js');
  const proposals=source('routes/opinioni-proposte.js');
  for(const code of [management,details,proposals]){
    assert.doesNotMatch(code,/\b(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE)\s+(?:public\.)?opinioni_domande\b/i);
  }
  assert.match(management,/router\.post\('\/',\s*verifyToken,\s*requireAdmin,\s*officialCatalogReadOnly\)/);
  assert.match(management,/router\.put\('\/:id',\s*verifyToken,\s*requireAdmin,\s*officialCatalogReadOnly\)/);
  assert.match(management,/router\.delete\('\/:id',\s*verifyToken,\s*requireAdmin,\s*officialCatalogReadOnly\)/);
  assert.match(details,/router\.put\('\/:id\/approfondimento',\s*verifyToken,\s*requireAdmin/);
  assert.match(details,/CATALOG_RELEASE_REQUIRED/);
  assert.match(proposals,/PROPOSALS_TABLE_REQUIRED/);
  assert.match(proposals,/INSERT INTO opinioni_proposte/);
  assert.match(proposals,/DELETE FROM opinioni_proposte/);
  const diagnostics=source('routes/test-opinioni-proposte.js');
  assert.doesNotMatch(diagnostics,/CREATE TABLE|INSERT INTO|FROM opinioni_domande/);
  assert.match(diagnostics,/verifyToken,requireAdmin/);
  const addDev = source('routes/test-add-opinione.js');
  assert.doesNotMatch(addDev,/INSERT INTO|UPDATE|DELETE FROM/);
  assert.match(addDev,/CATALOG_RELEASE_REQUIRED/);
});

test('personal answers and consent remain DB-owned and protected',()=>{
  const answers=source('routes/opinioni/user-answers.js');
  const legacy=source('routes/compatibility.js');
  const stats=source('routes/opinioni/stats.js');
  assert.match(answers,/political_opinions_consent/);
  assert.match(answers,/BEGIN/);
  assert.match(answers,/ROLLBACK/);
  assert.match(answers,/opinioni_risposte/);
  assert.match(legacy,/opinioni_risposte/);
  assert.match(legacy,/verifyAccessToken/);
  assert.match(stats,/political_opinions_consent/);
  assert.match(stats,/minimumCellSize/);
});

test('Admin screen only lists official questions, never creates or edits them',()=>{
  const root=path.resolve(apiRoot,'../client/src/pages/GestisciOpinioni');
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const page=read('index.tsx'),listing=read('components/ListaOpinioni.tsx');
  const proposals=read('components/OpinioniProposte.tsx');
  assert.doesNotMatch(page,/<FormAggiungiOpinione/);
  assert.doesNotMatch(listing,/onClick|editMutation|deleteMutation/);
  assert.doesNotMatch(proposals,/accetta|ApproveDialog|setApproveDialogOpen/);
  assert.match(proposals,/action: 'rifiuta'/);
});
