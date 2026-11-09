'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('provincial category is absent from the five legacy office cards', () => {
  for (const page of ['Rappresentanti', 'Candidati']) {
    const categories = read(`client/src/pages/${page}/constants/categorie.ts`);
    assert.doesNotMatch(categories, /provinciale-trento|provinciale-bolzano/);
    const content = read(`client/src/pages/${page}/index.tsx`);
    assert.match(content, /<ProvincialOfficeChoice kind="(?:candidate|representative)"\s*\/>/);
  }
});

test('provincial UI requires explicit build GO, current session consent and bounded residence', () => {
  const config = read('client/src/lib/provincialSelection.ts');
  const button = read('client/src/components/ProvincialOfficeChoice.tsx');
  assert.match(config, /VITE_DEMOS_PROVINCIAL_SELECTIONS_GO\s*===\s*"true"/);
  assert.match(config, /\["IT", "ITALIA", "ITALY"\]/);
  assert.match(config, /\["TN", "TRENTO"\]/);
  assert.match(config, /\["BZ", "BOLZANO", "BOZEN"\]/);
  assert.doesNotMatch(config, /PROVINCIALE":/);
  assert.match(button, /isSessionVerified/);
  assert.match(button, /verifiedPoliticalConsent\?\.granted === true/);
  assert.match(button, /enabled:\s*canRead/);
  assert.match(button, /provincialOfficeFromResidence\(response\.data\.user\)/);
  assert.match(button, /queryKey: \["provincialOfficeForAccount", user\?\.id\]/);
});

test('provincial chooser reads and writes canonical selections without legacy field names or push topics', () => {
  const data = read('client/src/pages/ScegliRappresentante/hooks/useRappresentantiData.ts');
  const actions = read('client/src/pages/ScegliRappresentante/hooks/useRappresentantiActions.ts');
  const chooser = read('client/src/pages/ScegliRappresentante/index.tsx');
  const dialog = read('client/src/components/ViewOpinioniDialog.tsx');
  const layout = read('client/src/pages/SelectionGrid.css');
  assert.match(data, /provincialOffice\?\.officeId \|\| getTitolo\(categoria\)/);
  assert.match(data, /provincial-selection\?kind=representative/);
  assert.match(data, /provincial-selection\?kind=candidate/);
  assert.match(actions, /provincialOffice\s*\?\s*\x60\/api\/users\/\$\{userId\}\/political-selection\x60/);
  assert.match(actions, /if \(fcmToken && !isCandidateRoute && !provincialOffice\)/);
  assert.match(chooser, /provincialOfficeFromCategory\(categoria \|\| ""\) && !PROVINCIAL_UI_RELEASED/);
  assert.match(dialog, /'provinciale-trento': 'C'/);
  assert.match(dialog, /'provinciale-bolzano': 'C'/);
  assert.match(layout, /:has\(> \.provincial-office-choice\)/);
});

test('provincial selection can be cleared in chooser even if the old office has no eligible subjects', () => {
  const page = read('client/src/pages/ScegliRappresentante/index.tsx');
  const actions = read('client/src/pages/ScegliRappresentante/hooks/useRappresentantiActions.ts');
  const types = read('client/src/pages/ScegliRappresentante/types/index.ts');
  assert.match(page, /aria-label="Annulla scelta provinciale"/);
  assert.match(page, /onClick=\{\(\) => annullaSelezioneProvinciale\(\(\) => setRappresentanteSelezionato\(null\)\)\}/);
  assert.ok(page.indexOf('Annulla scelta provinciale') < page.indexOf('rappresentanti.length === 0'),
    'removal remains visible when no councillor or candidate is currently selectable');
  assert.match(page, /provincialOfficeFromCategory\(categoria \|\| ""\) && rappresentanteSelezionato/);
  assert.match(actions, /const annullaSelezioneProvinciale = async/);
  assert.match(actions, /selectedUserId: null/);
  assert.match(actions, /kind: isCandidateRoute \? "candidate" : "representative"/);
  assert.match(actions, /onSuccess\(\)/);
  assert.match(actions, /queryClient.invalidateQueries/);
  assert.doesNotMatch(types, /onDeseleziona/);
});
