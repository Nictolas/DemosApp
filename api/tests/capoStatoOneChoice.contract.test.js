"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const migration=read("api/migrations/20261109_capo_stato_one_current_choice.sql");
const service=read("api/services/capoStatoCurrentChoice.js");
const route=read("api/routes/capo-stato.js");
const admin=read("client/src/pages/Gestisci/ProposteSoggetti.tsx");
const propose=read("client/src/pages/ProponiSoggetto.tsx");
const voteForm=read("client/src/pages/CapodiStato/components/VotingForm.tsx");

test("one and only one current choice per account, without rewriting legacy vote history",()=>{
  assert.match(migration,/user_id uuid PRIMARY KEY REFERENCES public\.users\(id\) ON DELETE CASCADE/);
  assert.match(migration,/tipo text NOT NULL CHECK \(tipo IN \('voto','proposta'\)\)/);
  assert.match(migration,/DISTINCT ON \(v\.userid\)/);
  assert.match(migration,/ON CONFLICT \(user_id\) DO NOTHING/);
  assert.doesNotMatch(migration,/DELETE FROM public\.voti_capo_stato|TRUNCATE/);
  assert.doesNotMatch(migration,/SELECT p\.proposer_user_id/);
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/REVOKE ALL ON TABLE public\.capo_stato_scelte FROM PUBLIC, anon, authenticated/);
});

test("name-only private ranking counts DISTINCT users rather than proposal rows or public votes",()=>{
  assert.match(service,/count\(DISTINCT u\.id\)::int AS sostenitori/);
  assert.match(service,/c\.tipo='proposta'/);
  assert.match(service,/p\.status='pending'/);
  assert.match(service,/ORDER BY sostenitori DESC,p\.title ASC/);
  assert.match(route,/router\.get\('\/admin\/proposte',verifyToken,requireAdmin/);
  assert.match(route,/Cache-Control','private, no-store'/);
  assert.doesNotMatch(service,/SELECT p\.\*|SELECT c\.\*/);
});

test("proposal and vote writes share an account lock and the same cooldown",()=>{
  assert.match(service,/FOR UPDATE/);
  assert.match(service,/const consent=await getLockedPoliticalConsentForWrite\(client,userId\)/);
  assert.match(service,/scope:"capo-stato:preferenza"/);
  assert.match(service,/ON CONFLICT\(user_id\) DO UPDATE/);
  assert.match(service,/kind==="proposta"/);
  assert.match(service,/kind==="voto"/);
  assert.match(service,/COMMIT/);
  assert.match(service,/ROLLBACK/);
  assert.match(route,/router\.post\('\/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent/);
  assert.match(route,/router\.post\('\/proponi', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent/);
  assert.match(route,/voti\.length>1/);
});

test("new name is submitted without source or biography, while existing names use voting",()=>{
  assert.match(propose,/category === "capo_stato"/);
  assert.match(propose,/\/api\/capo-stato\/proponi/);
  assert.match(propose,/\{ nome: title\.trim\(\) \}/);
  assert.match(propose,/category !== "capo_stato" && <div/);
  assert.match(voteForm,/if \(!existingCandidate\) return/);
  assert.match(voteForm,/disabled=\{!existingCandidate/);
  assert.match(voteForm,/Questo nome non è ancora votabile/);
});

test("Admin uses five independent sections; Capo Stato only a ranked name and count",()=>{
  for(const category of ['capo_stato','grazia','amnistia','attivisti','organizzazioni']) {
    assert.match(admin,new RegExp('"'+category+'"'));
  }
  const start=admin.indexOf('aria-label="Classifica proposte Capo di Stato"');
  const end=admin.indexOf('activeCategory === "grazia" &&',start);
  assert.ok(start>0 && end>start);
  const ranked=admin.slice(start,end);
  assert.match(ranked,/item\.nome/);
  assert.match(ranked,/item\.sostenitori/);
  assert.doesNotMatch(ranked,/source_url|created_at|details|review\(p/);
  assert.match(admin,/\/api\/subject-proposals\/admin\/grazia/);
  assert.match(admin,/pending\.filter\(p => p\.category === activeCategory\)/);
});

test("canonical selection participates in GDPR export, consent withdrawal and account erasure",()=>{
  for(const file of ["politicalConsentService","privacyDataExportService","privacyErasureLedgerService"]) {
    assert.match(read("api/services/"+file+".js"),/'capo_stato_scelte'/);
  }
});

test("names reject invisible control characters and excessive text",()=>{
  const {cleanName}=require("../services/capoStatoCurrentChoice");
  assert.equal(cleanName("  Sergio   Mattarella  "),"Sergio Mattarella");
  assert.equal(cleanName(" Sergio\u200b Mattarella "),null);
  assert.equal(cleanName("a".repeat(151)),null);
  assert.equal(cleanName({toString(){return "Fake"}}),null);
});