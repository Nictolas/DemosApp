const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sexFromVerifiedCieGender, persistVerifiedCieSex, isCurrentlyVerifiedCieSex } = require('../utils/cieSex');

test('il claim CIE firmato usa M/F/NULL e non inferisce il genere', () => {
  assert.equal(sexFromVerifiedCieGender('male'), 'M');
  assert.equal(sexFromVerifiedCieGender('female'), 'F');
  for (const invalid of [undefined, null, '', 'other', '0', '1', 0, 1, 'm', 'M', 'Female', 'u', 'd', 'a']) {
    assert.equal(sexFromVerifiedCieGender(invalid), null);
  }
});

test('persistenza sesso CIE richiede valore verificato, UUID e aggiornamento di una sola riga', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1 };
    }
  };
  assert.equal(await persistVerifiedCieSex(client, 'user-1', null), false);
  assert.equal(calls.length, 0);
  await assert.rejects(persistVerifiedCieSex(client, 'user-1', '0'), /non valido/);
  assert.equal(calls.length, 0);
  assert.equal(await persistVerifiedCieSex(client, 'user-1', 'M'), true);
  assert.deepEqual(calls[0].params, ['M', 'user-1']);
  assert.match(calls[0].sql, /sesso = \$1/);
  assert.doesNotMatch(calls[0].sql, /sesso IS NULL OR sesso = \$1/);
  // Un valore storico difforme non deve impedire la successiva verifica CIE.
  assert.match(calls[0].sql, /UPDATE users SET sesso = \$1/);
  assert.match(calls[0].sql, /account_type = 'PERSON'/);
  assert.match(calls[0].sql, /sesso_fonte = 'C'/);
  assert.match(calls[0].sql, /FROM identity_verifications iv/);
  assert.match(calls[0].sql, /iv.provider = 'CIE'/);
  assert.match(calls[0].sql, /iv.status = 'verified'/);
  assert.match(calls[0].sql, /iv.detached_at IS NULL/);
  assert.equal(await persistVerifiedCieSex(client, 'user-1', 'F'), true);
  assert.deepEqual(calls[1].params, ['F', 'user-1']);
  assert.doesNotMatch(calls[1].sql, /sesso IS NULL/);
  await assert.rejects(
    persistVerifiedCieSex({ query: async () => ({ rowCount: 0 }) }, 'user-1', 'F'),
    /Account inesistente o non PERSON/
  );
});

test('le API utente non accettano sesso CIE dal browser', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  for (const file of ['api/routes/users/search.js', 'api/routes/users/profile.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /'nome', 'cognome', 'sesso'/);
  }
  const callback = read('api/routes/auth/identity.js');
  assert.match(callback, /verifiedCieSex: userInfo\.sesso/);
  assert.match(callback, /sesso: userInfo\.sesso/);
  const admin = read('client/src/pages/Utenti/index.tsx');
  assert.match(admin, /user\.sesso === 'M' \|\| user\.sesso === 'F'/);
  assert.doesNotMatch(admin, /user\.genere \|\| 'N\/A'/);
});


test('single-user admin read contains canonical sex but profile updates cannot overwrite it', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  const source = read('api/routes/users/search.js');
  const start = source.indexOf('// GET /api/users/:userId');
  const end = source.indexOf('// PUT /api/users/:userId', start);
  assert.ok(start >= 0 && end > start, 'admin single-user route not found');
  const get = source.slice(start, end);
  assert.match(get, /SELECT id, name, nome, cognome, email, ruolo, status, created_at, updated_at,\s*sesso, account_type, genere,/);
  assert.match(get, /sesso: \['M', 'F'\]\.includes\(user\.sesso\) \? user\.sesso : null/);
  const update = source.slice(end);
  assert.match(update, /sesso: \['M', 'F'\]\.includes\(updatedUser\.sesso\)/);
  const listStart = source.indexOf("router.get('/',");
  assert.match(source, /avatar_config, sesso, account_type, genere, cittadinanza/);
  const list = source.slice(listStart, start);
  assert.match(list, /sesso: \['M', 'F'\]\.includes\(user\.sesso\)/);
  for (const block of [source.slice(end), read('api/routes/users/profile.js')]) {
    const permitted = block.match(/const allowedFields = \[([\s\S]*?)\];/);
    assert.ok(permitted, 'missing explicit editable field whitelist');
    assert.doesNotMatch(permitted[1], /'sesso'|'genere'/);
  }
});


test('le statistiche M/F storiche non vengono presentate come CIE certificate', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  const charts = [
    'client/src/components/sondaggi/GenereChart.tsx',
    'client/src/pages/Sondaggi/components/GenereChart.tsx',
    'client/src/pages/StatisticheOpinione/components/GenereChart.tsx',
    'client/src/pages/Sostenitori.tsx'
  ];
  for (const file of charts) {
    const source = read(file);
    assert.match(source, /Distribuzione per sesso/);
    assert.match(source, /storici o inferiti/);
    assert.match(source, /non necessariamente/);
    assert.doesNotMatch(source, /Distribuzione per sesso anagrafico \(CIE\)/);
    assert.doesNotMatch(source, /Sesso anagrafico certificato \(CIE\)/);
  }
  const polls = read('api/routes/sondaggi.js');
  const opinions = read('api/routes/opinioni/stats.js');
  for (const route of [polls, opinions]) {
    assert.match(route, /sesso IN \('M','F'\)/);
    assert.doesNotMatch(route, /Statistiche per sesso anagrafico CIE|Breakdowns CIE/);
  }
  // La fonte CIE si dimostra nella verifica dell'identita', non dalla presenza di M/F.
  const cie = read('api/utils/cieSex.js');
  assert.match(cie, /sexFromVerifiedCieGender/);
  assert.match(cie, /account_type = 'PERSON'/);
});


test('metadato provenienza: migrazione non effettua backfill e CIE richiede verifica attiva', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  const migration = read('api/migrations/20261028_cie_sex_provenance.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sesso_fonte VARCHAR\(1\)/);
  assert.match(migration, /sesso_fonte IN \('L', 'N', 'O', 'C'\)/);
  assert.match(migration, /sesso IN \('M', 'F'\)/);
  assert.match(migration, /account_type = 'PERSON'/);
  assert.doesNotMatch(migration, /UPDATE\s+(?:public\.)?users\s+SET/i);
  const cie = read('api/utils/cieSex.js');
  assert.match(cie, /sesso_fonte = 'C'/);
  assert.match(cie, /identity_verifications iv/);
  assert.match(cie, /iv.provider = 'CIE'/);
  assert.match(cie, /iv.detached_at IS NULL/);
});

test('opinion statistics never return raw SQL errors or log exception objects', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/opinioni/stats.js'), 'utf8');
  assert.doesNotMatch(source, /message:\s*error\.message|error:\s*error\.message/);
  assert.doesNotMatch(source, /console\.error\([^;\n]*,\s*error(?:\.stack)?\s*\)/);
  assert.doesNotMatch(source, /Error details:/);
  assert.match(source, /message:\s*'Errore interno del server'/);
});


test('la certificazione CIE corrente richiede fonte C e verifica attiva', async () => {
  let sqlText = '';
  const active = {
    async query(sql, params) {
      sqlText = sql;
      assert.deepEqual(params, ['user-cie']);
      return { rows: [{ verified_cie_sex: true }] };
    }
  };
  assert.equal(await isCurrentlyVerifiedCieSex(active, 'user-cie'), true);
  for (const guard of [
    /u\.sesso IN \('M','F'\)/,
    /u\.sesso_fonte = 'C'/,
    /iv\.provider = 'CIE'/,
    /iv\.status = 'verified'/,
    /iv\.detached_at IS NULL/,
    /u\.account_type = 'PERSON'/
  ]) assert.match(sqlText, guard);
  assert.equal(await isCurrentlyVerifiedCieSex({
    async query() { return { rows: [{ verified_cie_sex: false }] }; }
  }, 'user-cie'), false);
  assert.equal(await isCurrentlyVerifiedCieSex({
    async query() { return { rows: [] }; }
  }, 'user-cie'), false);
  assert.equal(await isCurrentlyVerifiedCieSex({
    async query() { throw new Error('must not query'); }
  }, null), false);
});

test('sesso_fonte non e modificabile dal browser e compare nell export GDPR canonico', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  for (const file of ['api/routes/users/search.js', 'api/routes/users/profile.js']) {
    const source = read(file);
    for (const fields of source.matchAll(/const allowedFields = \[([\s\S]*?)\];/g)) {
      assert.doesNotMatch(fields[1], /'sesso_fonte'/);
    }
  }
  const exportService = read('api/services/privacyDataExportService.js');
  assert.match(exportService, /'data_nascita', 'sesso', 'sesso_fonte', 'genere'/);
  assert.match(exportService, /filter\(\(column\) => columns\.includes\(column\)\)/);
});
