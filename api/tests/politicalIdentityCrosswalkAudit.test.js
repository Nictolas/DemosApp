'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { auditPoliticalIdentityCrosswalk, officialUrl, officialIdMatchesSource, validDate } =
  require('../utils/politicalIdentityCrosswalkAudit');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';

function caseFor(id = 'synthetic-01', userIds = [A, B]) {
  return {
    case_id: id,
    user_ids: userIds,
    accounts: userIds.map(user_id => ({ user_id, has_auth: false })),
    cross_chamber_evidence_url: 'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=000500',
    institutional_records: [
      {
        user_id: userIds[0], chamber: 'CAMERA', official_id: 'd1234_17',
        source_url: 'https://dati.camera.it/ocd/deputato.rdf/d1234_17',
        legislature: 17, starts_at: '2013-03-15', ends_at: '2018-03-22'
      },
      {
        user_id: userIds[1], chamber: 'SENATO', official_id: '500',
        source_url: 'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=000500',
        legislature: 19, starts_at: '2022-10-13', ends_at: null
      }
    ]
  };
}

test('valid synthetically evidenced case is still MANUAL review: no SQL, no merge', () => {
  const input = [caseFor()];
  const before = JSON.stringify(input);
  const report = auditPoliticalIdentityCrosswalk(input);
  assert.equal(report.mode, 'READ_ONLY_MANUAL_REVIEW');
  assert.equal(report.writes_performed, 0);
  assert.equal(report.automatic_merges_performed, 0);
  assert.equal(report.blocked_count, 0);
  assert.equal(report.manual_review_count, 1);
  assert.deepEqual(report.cases[0].problems, []);
  assert.equal(report.cases[0].review_status, 'MANUAL_REVIEW_REQUIRED');
  assert.equal(JSON.stringify(input), before, 'source snapshot must remain unchanged');
});

test('overlapping Camera and Senato dates block the case, never infer dual office', () => {
  const candidate = caseFor();
  candidate.institutional_records[1].starts_at = '2018-01-01';
  const report = auditPoliticalIdentityCrosswalk([candidate]);
  assert.equal(report.blocked_count, 1);
  assert.ok(report.cases[0].problems.includes('CHAMBER_MANDATE_DATE_OVERLAP'));
});

test('authenticated profile, missing official cross-chamber evidence are blocked', () => {
  const item = caseFor();
  item.accounts[0].has_auth = true;
  item.cross_chamber_evidence_url = 'https://www.senato.it.evil.example/member';
  const report = auditPoliticalIdentityCrosswalk([item]);
  assert.ok(report.cases[0].problems.includes('AUTHENTICATED_ACCOUNT_REQUIRES_SEPARATE_REVIEW'));
  assert.ok(report.cases[0].problems.includes('NO_OFFICIAL_CROSS_CHAMBER_EVIDENCE'));
});

test('official ID assigned to different cases or users fails closed', () => {
  const first = caseFor('first', [A, B]);
  const second = caseFor('second', [C, D]);
  second.institutional_records[0].official_id = first.institutional_records[0].official_id;
  const both = auditPoliticalIdentityCrosswalk([first, second]);
  assert.equal(both.blocked_count, 2);
  assert.ok(both.cases[0].problems.includes('OFFICIAL_ID_IN_MULTIPLE_CASES'));
  assert.ok(both.cases[1].problems.includes('OFFICIAL_ID_IN_MULTIPLE_CASES'));
  first.institutional_records[1].official_id = first.institutional_records[0].official_id;
  first.institutional_records[1].chamber = 'CAMERA';
  first.institutional_records[1].source_url = 'https://www.camera.it/deputati/elenco/19-123';
  const report = auditPoliticalIdentityCrosswalk([first]);
  assert.ok(report.cases[0].problems.includes('OFFICIAL_ID_IN_MULTIPLE_USERS'));
});

test('missing source, invalid dates, spoofed official hosts and user preflight omissions block', () => {
  for (const url of [
    'https://www.senato.it.evil.example/scheda',
    'http://www.senato.it/scheda',
    'https://evil@www.senato.it/scheda',
    'https://www.senato.it:8443/scheda',
    'https://www.camera.it/scheda'
  ]) assert.equal(officialUrl(url, 'SENATO'), false, url);
  assert.equal(officialUrl('https://www.senato.it/scheda', 'SENATO'), false);
  assert.equal(officialUrl(
    'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00018055',
    'SENATO'), true);
  assert.equal(officialUrl(
    'https://www.senato.it/export/senator/full/19/18055',
    'SENATO'), true);
  assert.equal(officialUrl(
    'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=500&tab=other',
    'SENATO'), false);
  assert.equal(officialUrl(
    'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=500&did=500',
    'SENATO'), false);
  for (const date of ['2018-02-30', '2022-2-01', '2050-13-01', null]) {
    assert.equal(validDate(date), false);
  }
  const candidate = caseFor();
  candidate.institutional_records[0].starts_at = '2013-02-30';
  candidate.accounts = [];
  const report = auditPoliticalIdentityCrosswalk([candidate]);
  assert.ok(report.cases[0].problems.includes('INVALID_OR_UNVERIFIED_MANDATE'));
  assert.ok(report.cases[0].problems.includes('AUTH_PREFLIGHT_INCOMPLETE'));
  assert.ok(report.cases[0].problems.includes('UNMATCHED_LOCAL_USER'));
  assert.throws(() => auditPoliticalIdentityCrosswalk({}), TypeError);
});

test('official source ID must match the Senato did despite leading zeros', () => {
  const candidate = caseFor();
  assert.equal(officialIdMatchesSource(candidate.institutional_records[1]), true);
  candidate.institutional_records[1].official_id = '501';
  const report = auditPoliticalIdentityCrosswalk([candidate]);
  assert.ok(report.cases[0].problems.includes('OFFICIAL_ID_SOURCE_MISMATCH'));
  candidate.institutional_records[1].official_id = '0500';
  const padded = auditPoliticalIdentityCrosswalk([candidate]);
  assert.ok(padded.cases[0].problems.includes('OFFICIAL_ID_SOURCE_MISMATCH'),
    'Canonical IDs are unpadded so identical Senate IDs cannot fragment');
});

test('official source ID must match the Camera RDF resource when available', () => {
  const candidate = caseFor();
  candidate.institutional_records[0].official_id = 'd9999_17';
  const report = auditPoliticalIdentityCrosswalk([candidate]);
  assert.ok(report.cases[0].problems.includes('OFFICIAL_ID_SOURCE_MISMATCH'));
});

test('CLI emits aggregates only, creates no personal report by default, returns nonzero on blockers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-identity-'));
  try {
    const input = path.join(dir, 'private.json');
    const content = [caseFor()];
    content[0].accounts[0].has_auth = true;
    fs.writeFileSync(input, JSON.stringify(content), { mode: 0o600 });
    const proc = spawnSync(process.execPath,
      ['api/scripts/audit-political-crosswalk.js', '--cases=' + input],
      { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8', timeout: 5000,
        env: { ...process.env, DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/nodb' } });
    assert.equal(proc.status, 2);
    assert.equal(JSON.parse(proc.stdout).blocked_count, 1);
    assert.doesNotMatch(proc.stdout + proc.stderr, /11111111-1111|22222222-2222|synthetic-01/);
    assert.deepEqual(fs.readdirSync(dir), ['private.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
