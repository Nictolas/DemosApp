'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('DEMOS12 release checklist reflects implemented withdrawal paths without marking GDPR approved',()=>{
  const guide=read('docs/proposte-gdpr-review-gate.md');
  const current=guide.split('## Decisione definitiva prodotto')[0];
  const generic=read('api/routes/subject-proposals.js');
  const grazia=read('api/routes/grazia.js');
  assert.match(generic,/router\.post\('\/admin\/:id\/withdraw', verifyToken, requireAdmin/);
  assert.match(generic,/category IN \('capo_stato','amnistia','attivisti','organizzazioni'\)/);
  assert.match(generic,/UPDATE capo_stato_soggetti_approvati SET active=FALSE/);
  assert.match(generic,/UPDATE amnistia SET attiva=FALSE/);
  assert.match(grazia,/router\.post\('\/richiesta\/:id\/ritira', personalNoStore, verifyToken, requireAdmin/);
  assert.match(current,/Ritiro non distruttivo di tutte le quattro categorie generiche supportato nel DRAFT/);
  assert.match(current,/Grazia resta esclusa/);
  assert.doesNotMatch(current,/Capo di Stato e Amnistia non è ancora supportato|Progettare separatamente ritiro Capo di Stato/);
  assert.match(current,/\- \[x\] Audit tecnico sul DRAFT dei payload/);
  assert.match(current,/\- \[ \] Valutazione DPO della pubblicabilità/);
  assert.match(current,/Demos-Staging/);
  assert.doesNotMatch(current,/staging gratuito schema-completo \(oggi 7 tabelle/);
  assert.match(current,/emulatore Android 15 con WebView e API sintetiche è già PASS/);
  assert.match(current,/QA Android su \*\*dispositivo fisico/);
  assert.match(current,/\*\*Stato:\*\* DRAFT \/ NO-GO/);
  assert.match(current,/Autorizzazioni distinte per migrazione, merge e deploy/);
});

test('documented security gates remain explicit and never infer third-party consent',()=>{
  const current=read('docs/proposte-gdpr-review-gate.md').split('## Decisione definitiva prodotto')[0];
  for(const evidence of ['Art. 9','Art. 10','Art. 14','DPIA','DSAR','retention','Grazia','account']){
    assert.ok(current.toLowerCase().includes(evidence.toLowerCase()),'missing GDPR gate: '+evidence);
  }
  assert.match(current,/Non introdurre "consenso implicito"/);
  assert.match(current,/nessuna migrazione o pubblicazione autorizzata/i);
});
