'use strict';
// Static regression tests for the opt-in, no-polling foreground refresh.
// Backend Postgres lifecycle tests independently verify withdrawn titles are absent.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');

test('shared approved-subject foreground refresh is event-driven, not a polling loop', () => {
  const source=read('client/src/hooks/useApprovedSubjectResumeRefresh.ts');
  assert.match(source,/document\.addEventListener\("visibilitychange", resume\)/);
  assert.match(source,/window\.addEventListener\("focus", resume\)/);
  assert.match(source,/document\.removeEventListener\("visibilitychange", resume\)/);
  assert.match(source,/window\.removeEventListener\("focus", resume\)/);
  assert.match(source,/document\.visibilityState !== "visible"/);
  assert.doesNotMatch(source,/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
  assert.match(source,/now - lastResumeAt < 1500/,'deduplicate focus + visibility events');
  assert.match(source,/current\?\.abort\(\)/,'cancel stale in-flight requests');
  assert.match(source,/controller\.signal\.aborted/,'never apply aborted stale results');
});

test('focus refresh uses only one category-specific read and hides old names first', () => {
  const source=read('client/src/hooks/useApprovedSubjectResumeRefresh.ts');
  const relevant=source.match(/const resume = \(\) => \{([\s\S]+?)\n    \};/);
  assert.ok(relevant,'event handler must be present');
  assert.match(relevant[1],/setApprovedSubjects\(\[\]\)/,
    'remove old names immediately on resume before a network response');
  assert.match(relevant[1],/\/api\/subject-proposals\/approved\?category=/);
  assert.equal((relevant[1].match(/await apiRequest\(/g)||[]).length,1,
    'one targeted GET per resume, no extra complete directory read');
  assert.match(relevant[1],/catch \{[\s\S]*setApprovedSubjects\(\[\]\)/,
    'on offline/error fail closed, do not keep stale title');
  assert.match(source,/\.map\(\(entry: ApprovedDirectorySubject\) => \(\{ id: entry\.id, title: entry\.title \}\)\)/,
    'never copy extra source or third-party details into view state');
});

test('both directory views retain normal initial load and hook only when not loading', () => {
  for (const [name,route,category] of [
    ['client/src/pages/Attivisti/index.tsx','/api/attivisti','attivisti'],
    ['client/src/pages/Organizzazioni/index.tsx','/api/organizzazioni','organizzazioni']
  ]) {
    const source=read(name);
    assert.match(source,/useApprovedSubjectResumeRefresh/,'shared hook required in '+name);
    assert.ok(source.includes('useApprovedSubjectResumeRefresh("'+category+'"'),'correct category in '+name);
    assert.ok(source.includes(route),'initial directory load preserved in '+name);
    assert.match(source,/setApprovedSubjects\(\[\]\)/,'stale list cleared on reload/error in '+name);
    assert.doesNotMatch(source,/subject\.details|subject\.source_url/,'private text/url never rendered in '+name);
  }
  assert.match(read('client/src/pages/Attivisti/index.tsx'),/!!user && !loading && !error/);
  assert.match(read('client/src/pages/Organizzazioni/index.tsx'),/!isLoading && !isError/);
});

test('organization initial load and resumed approved list share the configured API origin',()=>{
  const org=read('client/src/pages/Organizzazioni/index.tsx');
  const hook=read('client/src/hooks/useApprovedSubjectResumeRefresh.ts');
  assert.match(org,/import \{ getApiUrl \} from "@\/lib\/api-config"/);
  assert.match(org,/fetch\(getApiUrl\('\/api\/organizzazioni\/filtri'\)\)/);
  assert.match(org,/const url = getApiUrl\(`\/api\/organizzazioni/);
  assert.doesNotMatch(org,/demos-c7k0\.onrender\.com|\bAPI_BASE\b/,
    'organization must not bypass staging/native/production API configuration');
  assert.doesNotMatch(org,/console\.log\s*\(/,
    'do not log entire user directories, individual names or search terms to browser console');
  assert.match(hook,/await apiRequest\(/,'foreground refresh also resolves API base by central helper');
});

test('the canonical public approved endpoint is no-store and includes only approved titles',()=>{
  const source=read('api/routes/subject-proposals.js');
  assert.match(source,/SELECT id, title FROM subject_proposals WHERE category=\$1 AND status='approved'/);
  assert.match(source,/res\.set\('Cache-Control', 'no-store'\)/);
});
