'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const categories = ['capo_stato','grazia','amnistia','attivisti','organizzazioni'];

test('five native category options live in one static client bundle', () => {
  const file = read('client/src/config/subjectProposalCategories.ts');
  for (const name of categories) {
    assert.match(file, new RegExp('value: "' + name + '"'));
  }
  assert.match(file, /new URLSearchParams\(search/);
  assert.match(file, /isProposalCategory\(requested\)/);
  assert.match(file, /DEFAULT_SUBJECT_CATEGORY/);
  assert.match(file, /proposalReturnPathFromSearch\(search: string\)/);
  assert.match(file, /params\.get\("da"\) === "firma"/);
  assert.doesNotMatch(file, /apiRequest|fetch\(/);
});

test('activists and organizations see their self-only identity and representation requirements', () => {
  const file = read('client/src/config/subjectProposalCategories.ts');
  const activist = file.match(/value: "attivisti",[\s\S]*?backPath: "\/attivisti"/)?.[0] || '';
  const organization = file.match(/value: "organizzazioni",[\s\S]*?backPath: "\/organizzazioni"/)?.[0] || '';
  assert.match(activist, /soltanto te stesso/);
  assert.match(activist, /CIE verificata/);
  assert.match(activist, /videocall privata/);
  assert.match(organization, /presidente o rappresentante legale autorizzato/);
  assert.match(organization, /CIE verificata/);
  assert.match(organization, /verifica anche la carica/);
  assert.match(organization, /non crea automaticamente un account né attiva pagamenti/);
});

test('all contextual plus buttons navigate to shared proposal route without fetching', () => {
  const button = read('client/src/components/ProposeSubjectButton.tsx');
  assert.match(button, /navigate\("\/proponi-soggetto\?categoria=" \+ category\)/);
  assert.doesNotMatch(button, /apiRequest|fetch\(/);
  assert.doesNotMatch(button, /<Dialog|<form/);
  const roots = [
    ['CapodiStato', 'capo_stato'],
    ['Grazia', 'grazia'],
    ['Amnistia', 'amnistia'],
    ['Attivisti', 'attivisti'],
    ['Organizzazioni', 'organizzazioni']
  ];
  for (const [page, category] of roots) {
    const file = read(page === 'Attivisti' ? 'client/src/pages/Attivisti.tsx' : 'client/src/pages/' + page + '/index.tsx');
    assert.match(file, new RegExp('<ProposeSubjectButton category="' + category + '"'));
  }
});

test('civic headers use the centered fixed directory style and a single top-right proposal action', () => {
  const roots = [
    ['CapodiStato', 'capo_stato'],
    ['Grazia', 'grazia'],
    ['Amnistia', 'amnistia']
  ];
  for (const [page, category] of roots) {
    const header = read('client/src/pages/' + page + '/components/Header.tsx');
    const pageSource = read('client/src/pages/' + page + '/index.tsx');
    assert.match(header, /text-center/);
    assert.match(header, /flex items-center justify-center gap-2 px-11 sm:px-12/);
    assert.match(header, /className="sr-only"/);
    assert.match(header, /text-blue-600/);
    assert.match(pageSource, /shrink-0 border-b border-slate-200 bg-white/);
    assert.match(pageSource, /absolute right-0 top-0 z-10/);
    assert.match(pageSource, new RegExp('<ProposeSubjectButton category="' + category + '"'));
    assert.doesNotMatch(pageSource, /<CarceratoForm/);
  }
});

test('page is protected, retains Firma, and can be opened from a menu entry', () => {
  const app = read('client/src/App.tsx');
  const firma = read('client/src/pages/Proponi.tsx');
  assert.match(app, /<Route path="\/proponi-soggetto">/);
  assert.match(app, /<ProtectedRoute path="\/proponi-soggetto" component=\{ProponiSoggetto\}/);
  assert.match(app, /<Route path="\/firma">/);
  assert.doesNotMatch(firma, /href="\/proponi-soggetto/);
  assert.match(firma, /aria-label="Strumenti di firma"/);
  assert.match(app, /<Route path="\/proponi-opinione">/);
  assert.match(app, /<Route path="\/governo\/:slug">/);
});

test('shared form does not perform personal proposal GET when opening or switching category', () => {
  const file = read('client/src/pages/ProponiSoggetto.tsx');
  assert.match(file, /categoryFromSearch\(window\.location\.search\)/);
  assert.match(file, /<select/);
  assert.match(file, /navigate\(returnPath\)/);
  assert.match(file, /setReturnPath\(proposalReturnPathFromSearch\(window\.location\.search\)\)/);
  assert.match(file, />Proponi<\/h1>/);
  assert.match(file, /SUBJECT_PROPOSAL_CATEGORIES\.map/);
  const mountEffect = file.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[location\]\);/)?.[0] || '';
  assert.doesNotMatch(mountEffect, /apiRequest|fetch\(/);
  const changeCategory = file.match(/const chooseCategory = [\s\S]*?\n  \};/)?.[0] || '';
  assert.doesNotMatch(changeCategory, /apiRequest|fetch\(/);
  assert.match(file, /const checkMyStatus = async/);
  assert.match(file, /\/api\/subject-proposals\/mine\?category=/);
  assert.match(file, /\/api\/grazia\/mia-proposta/);
  const writes = file.match(/apiRequest\("POST", "\/api\/subject-proposals"/g) || [];
  assert.equal(writes.length, 1, 'one generic subject POST, with category-dependent route');
  assert.match(file, /apiRequest\("POST", "\/api\/grazia"/);
  assert.match(file, /response\?\.status === 202 && response\?\.data\?\.richiesta\?\.status === "pending"/);
  assert.match(file, /category === "grazia" \? 2000 : 2048/);
  assert.match(file, /response\?\.status === 201 && response\?\.data\?\.status === "pending"/);
  assert.match(file, /setSubmitted\(category\)/);
});

test('sensitive proposal information is minimized in Grazia and never directly published', () => {
  const page = read('client/src/pages/ProponiSoggetto.tsx');
  const config = read('client/src/config/subjectProposalCategories.ts');
  assert.match(page, /category !== "grazia"/);
  assert.match(page, /category === "grazia"/);
  assert.doesNotMatch(page, /sentenza|reato.{0,30}Textarea/i);
  assert.match(page, /sourceIsValid = isPublicHttpsSourceUrl\(sourceUrl\.trim\(\)\)/);
  assert.match(read('client/src/lib/publicHttpsSourceUrl.ts'), /url\.protocol !== "https:"/);
  assert.match(page, /sourceUrl\.trim\(\)/);
  assert.match(config, /Non inserire sentenze, reati, dati sanitari/);
  assert.match(page, /non rende automaticamente pubblico alcun nominativo/);
  assert.match(page, /status === 409/);
  // Equality to one fixed server error code is safe; rendering arbitrary
  // server-supplied error text is still prohibited by the contract.
  assert.match(page,/reason\?\.data\?\.error === "PROPOSTE_NON_DISPONIBILI"/);
  const pageWithoutFixedCodeCheck = page.replace(
    'reason?.data?.error === "PROPOSTE_NON_DISPONIBILI"', 'KNOWN_SAFE_CODE'
  );
  assert.doesNotMatch(pageWithoutFixedCodeCheck, /reason\?\.data\?\.(?:message|error)/,
    'raw server errors must not be rendered to users');
  assert.match(page, /status === 400 \|\| status === 422/);
  assert.match(page, /Non è stato possibile registrare la proposta\. Riprova più tardi/);
});

test('backend enforces source HTTPS and avoids criminal details in admin notice', () => {
  const route = read('api/routes/subject-proposals.js');
  assert.match(route, /if \(!sourceUrl\) return \{ error: 'Fonte pubblica HTTPS obbligatoria' \}/);
  assert.match(route, /category === 'grazia'\) return \{ error: .*code: 'GRAZIA_CODA_UNICA' \}/);
  assert.match(route, /status='pending' AND category IN \('capo_stato','amnistia','attivisti','organizzazioni'\)/);
  assert.doesNotMatch(route, /INSERT INTO grazia_carcerati/);
  const migration = read('api/migrations/20261031_subject_proposals_review_gate.sql');
  assert.doesNotMatch(migration, /category IN \([^)]*'grazia'/);
  assert.match(migration, /richieste_grazia/);
  assert.match(route, /!validateEvidenceUrl\(sourceUrl\)/);
  const evidenceValidator = read('api/utils/recognitionEvidence.js');
  assert.match(evidenceValidator, /url\.protocol !== 'https:'/);
  assert.match(evidenceValidator, /url\.username \|\| url\.password/);
  assert.match(route, /Nuova proposta ricevuta in una categoria da moderare/);
  assert.doesNotMatch(route, /proposal\.title\.slice\(0, 120\)/);
  assert.match(route, /INSERT INTO subject_proposals\(proposer_user_id,category,title,details,source_url,status,submission_notification_sent\)/);
  assert.match(route, /if \(error\.code === '23505'\) return res\.status\(409\)/);
  assert.match(route, /proposal\.code === 'GRAZIA_CODA_UNICA' \? 409 : 400/);
});

test('changing proposal category invalidates stale personal status responses', () => {
  const page=read('client/src/pages/ProponiSoggetto.tsx');
  assert.match(page,/statusRequestVersion = useRef\(0\)/);
  assert.match(page,/statusRequestVersion\.current \+= 1/);
  assert.match(page,/const requestVersion = \+\+statusRequestVersion\.current/);
  assert.match(page,/const requestedCategory = category/);
  assert.match(page,/statusRequestVersion\.current !== requestVersion \|\| currentOwnerId\.current !== requestOwnerId\) return/);
  assert.match(page,/if \(statusRequestVersion\.current === requestVersion && currentOwnerId\.current === requestOwnerId\)/);
  assert.match(page,/setCheckingStatus\(false\)/);
  assert.match(page,/disabled=\{submitting\}/,
    'a submission in flight must not silently clear a newer category form');
});

test('personal proposal statuses are owned by the authenticated user, even if the user changes without a route change', () => {
  const page = read('client/src/pages/ProponiSoggetto.tsx');
  assert.match(page, /const currentOwnerId = useRef<string \| null>\(user\?\.id \?\? null\)/);
  assert.match(page, /currentOwnerId\.current = user\?\.id \?\? null/);
  assert.match(page, /\[location, user\?\.id\]/, 'owner changes reset the form and invalidate in-flight checks');
  assert.match(page, /const requestOwnerId = user\.id/);
  assert.match(page, /statusOwnerId === user\.id/, 'the previously rendered status must not be visible to a new account');
  assert.match(page, /currentOwnerId\.current !== requestOwnerId\) return/);
  assert.match(page, /currentOwnerId\.current === requestOwnerId\)/);
  assert.match(page, /const submitOwnerId = user\.id/);
  assert.match(page, /if \(currentOwnerId\.current !== submitOwnerId \|\| submitRequestVersion\.current !== submitVersion\) return/,
    'a successful old-account POST cannot populate the new account form');
  assert.match(page, /if \(currentOwnerId\.current === submitOwnerId && submitRequestVersion\.current === submitVersion\)/);
});

test('a late POST response cannot update a newer category or user form', () => {
  const page = read('client/src/pages/ProponiSoggetto.tsx');
  assert.match(page,/const submitRequestVersion = useRef\(0\)/);
  assert.equal((page.match(/submitRequestVersion\.current \+= 1/g)||[]).length,2,
    'invalidate both on route or account effect and explicit category selection');
  assert.match(page,/const submitVersion = \+\+submitRequestVersion\.current/);
  assert.match(page,/currentOwnerId\.current !== submitOwnerId \|\| submitRequestVersion\.current !== submitVersion/);
  assert.equal((page.match(/currentOwnerId\.current === submitOwnerId && submitRequestVersion\.current === submitVersion/g)||[]).length,2,
    'error and finally must not mutate a newer form after an old POST');
});
