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
    const file = read('client/src/pages/' + page + '/index.tsx');
    assert.match(file, new RegExp('<ProposeSubjectButton category="' + category + '"'));
  }
});

test('page is protected, retains Firma, and can be opened from a menu entry', () => {
  const app = read('client/src/App.tsx');
  const firma = read('client/src/pages/Proponi.tsx');
  assert.match(app, /<Route path="\/proponi-soggetto">/);
  assert.match(app, /<ProtectedRoute path="\/proponi-soggetto" component=\{ProponiSoggetto\}/);
  assert.match(app, /<Route path="\/firma">/);
  assert.match(firma, /href="\/proponi-soggetto\?da=firma"/);
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
  assert.doesNotMatch(file, /apiRequest\("GET"|fetch\(|\/subject-proposals\/mine/);
  const writes = file.match(/apiRequest\("POST", "\/api\/subject-proposals"/g) || [];
  assert.equal(writes.length, 1, 'submission must be the only API call in the form');
  assert.match(file, /response\?\.data\?\.status !== "pending"/);
  assert.match(file, /setSubmitted\(category\)/);
});

test('sensitive proposal information is minimized in Grazia and never directly published', () => {
  const page = read('client/src/pages/ProponiSoggetto.tsx');
  const config = read('client/src/config/subjectProposalCategories.ts');
  assert.match(page, /category !== "grazia"/);
  assert.match(page, /details: category === "grazia" \? "" : details\.trim\(\)/);
  assert.match(page, /url\.protocol === "https:"/);
  assert.match(page, /sourceUrl\.trim\(\)/);
  assert.match(config, /Non inserire sentenze, reati, dati sanitari/);
  assert.match(page, /non rende automaticamente pubblico alcun nominativo/);
  assert.match(page, /status === 409/);
});

test('backend enforces source HTTPS and avoids criminal details in admin notice', () => {
  const route = read('api/routes/subject-proposals.js');
  assert.match(route, /if \(!sourceUrl\) return \{ error: 'Fonte pubblica HTTPS obbligatoria' \}/);
  assert.match(route, /category === 'grazia' && details/);
  assert.match(route, /url\.protocol !== 'https:'/);
  assert.match(route, /url\.username \|\| url\.password/);
  assert.match(route, /Nuova proposta ricevuta in una categoria da moderare/);
  assert.doesNotMatch(route, /proposal\.title\.slice\(0, 120\)/);
  assert.match(route, /INSERT INTO subject_proposals\(proposer_user_id,category,title,details,source_url,status\)/);
  assert.match(route, /if \(error\.code === '23505'\) return res\.status\(409\)/);
});
