'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditOfficialSexEvidence, isOfficialSourceUrl, matchKey, parseCameraSparqlBindings } =
  require('../utils/officialSexEvidenceAudit');

const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
];
const user = (id, nome, cognome, data_nascita, extra = {}) =>
  ({ id, nome, cognome, data_nascita, account_type: 'PERSON', ruolo: 'P', sesso: null, ...extra });
const official = (external_id, nome, cognome, data_nascita, sesso, source_url = 'https://dati.senato.it/sito/home') =>
  ({ external_id, nome, cognome, data_nascita, sesso, source_url });

test('porta in revisione una corrispondenza esatta, senza assegnare sesso o dedurlo dal nome', () => {
  const users = [
    user(UUIDS[0], 'Andrea', 'Rossi', '1980-01-05'),
    user(UUIDS[1], 'Maria', 'Verdi', '1975-12-15')
  ];
  const officialRecords = [
    official('senatore-1', 'Andrea', 'Rossi', '1980-01-05', 'M'),
    official('senatore-2', 'Maria', 'Verdi', '1975-12-15', 'F')
  ];
  const before = JSON.stringify(users);
  const audit = auditOfficialSexEvidence(users, officialRecords);
  assert.equal(audit.mode, 'READ_ONLY_REVIEW');
  assert.equal(audit.writes_performed, 0);
  assert.equal(audit.review_required_count, 2);
  assert.deepEqual(audit.review_required.map(x => x.official_declared_sex), ['M','F']);
  for (const candidate of audit.review_required) {
    assert.equal(candidate.cie_verified, false);
    assert.equal(candidate.review_status, 'REQUIRES_MANUAL_VERIFICATION');
    assert.equal(candidate.match_method, 'EXACT_NAME_SURNAME_AND_DOB');
    assert.equal(Object.hasOwn(candidate, 'nome'), false);
    assert.equal(Object.hasOwn(candidate, 'cognome'), false);
  }
  assert.equal(JSON.stringify(users), before);
  assert.equal(users[0].sesso, null);
});

test('un nome che finisce con a od o non basta a creare corrispondenze', () => {
  const users = [
    user(UUIDS[0], 'Luca', 'Rossi', '1990-07-14'),
    user(UUIDS[1], 'Marco', 'Bianchi', null)
  ];
  const audit = auditOfficialSexEvidence(users, [
    official('senatore-1', 'Luca', 'Rossi', '1991-07-14', 'M'),
    official('senatore-2', 'Marco', 'Bianchi', '1975-12-15', 'M')
  ]);
  assert.equal(audit.review_required_count, 0);
  assert.equal(audit.skipped.noOfficialMatch, 1);
  assert.equal(audit.considered_users_with_complete_identity, 1);
});

test('omonomi stessi dati, fonti duplicate e identità ufficiali ambigue: bloccare', () => {
  const same = user(UUIDS[0], 'Giulia', 'Rossi', '1990-08-01');
  const duplicate = { ...same, id: UUIDS[1] };
  let audit = auditOfficialSexEvidence([same, duplicate],
    [official('sen-1','Giulia','Rossi','1990-08-01','F')]);
  assert.equal(audit.review_required_count, 0);
  assert.equal(audit.skipped.ambiguousUsers, 2);

  audit = auditOfficialSexEvidence([same],[
    official('sen-1','Giulia','Rossi','1990-08-01','F'),
    official('sen-2','Giulia','Rossi','1990-08-01','F')
  ]);
  assert.equal(audit.review_required_count, 0);
  assert.equal(audit.skipped.ambiguousOfficial, 1);

  audit = auditOfficialSexEvidence([same,user(UUIDS[1],'Anna','Verdi','1992-06-01')],[
    official('sen-1','Giulia','Rossi','1990-08-01','F'),
    official('sen-1','Anna','Verdi','1992-06-01','F')
  ]);
  assert.equal(audit.review_required_count, 0);
  assert.equal(audit.skipped.ambiguousOfficial, 2);
});

test('fonti spoof, HTTP, valori inventati e account non politici non possono produrre evidenza', () => {
  for (const url of [
    'https://dati.senato.it.attacker.test/member',
    'http://dati.senato.it/member',
    'https://dati.camera.it/member',
    'https://fake@dati.senato.it/member',
    'javascript:alert(1)',
    'https://dati.senato.it:8443/member'
  ]) assert.equal(isOfficialSourceUrl(url), false, url);
  assert.equal(isOfficialSourceUrl('https://dati.senato.it/sito/home'), true);

  const politician = user(UUIDS[0], 'Andrea', 'Rossi', '1980-01-05');
  const records = [
    official('sen-1', 'Andrea','Rossi','1980-01-05','male'),
    official('sen-2', 'Andrea','Rossi','1980-01-05','F','https://random.example.test/member')
  ];
  assert.equal(auditOfficialSexEvidence([politician],records).review_required_count, 0);
  assert.equal(auditOfficialSexEvidence([{...politician,sesso:'M'}],
    [official('sen-3','Andrea','Rossi','1980-01-05','M')]).review_required_count, 0);
  assert.equal(auditOfficialSexEvidence([{...politician,account_type:'ORGANIZATION'}],
    [official('sen-3','Andrea','Rossi','1980-01-05','M')]).review_required_count, 0);
  assert.equal(auditOfficialSexEvidence([{...politician,ruolo:'E'}],
    [official('sen-3','Andrea','Rossi','1980-01-05','M')]).review_required_count, 0);
});

test('date non reali e dati mancanti vengono sempre scartati', () => {
  for (const dob of ['1111-11-11','2027-01-01','1990-02-30','1990-2-01',null,'']) {
    assert.equal(matchKey(user(UUIDS[0],'Paola','Bianchi',dob)),null);
  }
  assert.throws(() => auditOfficialSexEvidence({},[]),TypeError);
  assert.throws(() => auditOfficialSexEvidence([],{}),TypeError);
});


test('Camera dei deputati: importa solo foaf:gender male/female e data anagrafica valida', () => {
  const binding = (value, type = 'literal') => ({ type, value });
  const row = (deputato, nome, cognome, dataNascita, genere) => ({
    deputato: binding(deputato, 'uri'), nome: binding(nome),
    cognome: binding(cognome), dataNascita: binding(dataNascita), genere: binding(genere)
  });
  const input = [
    row('http://dati.camera.it/ocd/deputato.rdf/d305960_18','GIULIA','SARTI','19860813','female'),
    row('http://dati.camera.it/ocd/deputato.rdf/d305960_18','GIULIA','SARTI','19860813','female'),
    row('https://dati.camera.it/ocd/deputato.rdf/d305946_18','MICHELE','ANZALDI','19600804','male'),
    row('http://dati.camera.it/ocd/deputato.rdf/d305999_18','ANNA','BIANCHI','19900230','female'),
    row('http://dati.camera.it/ocd/deputato.rdf/d305999_18','ANNA','BIANCHI','19900101','unknown'),
    row('http://attacker.example/ocd/deputato.rdf/d305999_18','ANNA','BIANCHI','19900101','female')
  ];
  const parsed = parseCameraSparqlBindings(input);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].sesso, 'F');
  assert.equal(parsed[1].sesso, 'F');
  assert.equal(parsed[2].sesso, 'M');
  assert.equal(parsed[0].data_nascita, '1986-08-13');
  assert.equal(parsed[0].source_url, 'https://dati.camera.it/ocd/deputato.rdf/d305960_18');
  assert.equal(parsed[2].data_nascita, '1960-08-04');

  const demoUser=user(UUIDS[0],'Giulia','Sarti','1986-08-13');
  const audit=auditOfficialSexEvidence([demoUser],parsed);
  assert.equal(audit.review_required_count,1,'multiple identical source rows must not block review');
  assert.equal(audit.review_required[0].official_declared_sex,'F');
  assert.equal(audit.review_required[0].cie_verified,false);
  assert.equal(demoUser.sesso,null);
  assert.throws(() => parseCameraSparqlBindings({}),TypeError);
});

test('Camera: only official deputy resource links can support demographic evidence', () => {
  assert.equal(isOfficialSourceUrl('https://dati.camera.it/ocd/deputato.rdf/d305960_18'),true);
  for (const spoof of [
    'http://dati.camera.it/ocd/deputato.rdf/d305960_18',
    'https://dati.camera.it.evil.test/ocd/deputato.rdf/d305960_18',
    'https://dati.camera.it/member',
    'https://dati.camera.it/ocd/deputato.rdf/d305960_18?x=1',
    'https://evil@dati.camera.it/ocd/deputato.rdf/d305960_18'
  ]) assert.equal(isOfficialSourceUrl(spoof),false,spoof);
});
