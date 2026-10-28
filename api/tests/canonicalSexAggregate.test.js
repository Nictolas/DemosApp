const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { protectSexCountRows, protectSexOpinionRows } = require('../utils/canonicalSexAggregate');

test('M/F conteggi: sopprime tutta la distribuzione se un gruppo contiene 1-9 persone', () => {
  assert.deepEqual(protectSexCountRows([{ sesso: 'M', totale: '20' }, { sesso: 'F', totale: '1' }]), {
    suppressed: true, data: []
  });
  assert.deepEqual(protectSexCountRows([{ sesso: 'M', totale: '12' }, { sesso: 'F', totale: '10' }]), {
    suppressed: false, data: [{ sesso: 'M', totale: 12 }, { sesso: 'F', totale: 10 }]
  });
  assert.deepEqual(protectSexCountRows([]), { suppressed: false, data: [] });
  for (const unsafe of [
    [{ sesso: 'Altro', totale: 20 }],
    [{ sesso: 'M', totale: -1 }],
    [{ sesso: 'F', totale: 'NaN' }],
    [{ sesso: 'M', totale: 15 }, { sesso: 'M', totale: 20 }]
  ]) assert.deepEqual(protectSexCountRows(unsafe), { suppressed: true, data: [] });
});

test('incrocio sesso x opinioni: nasconde anche celle politiche positive 1-9', () => {
  const safe = [{ sesso: 'M', favorevole: '20', contrario: '10', indeciso: '0' }];
  assert.deepEqual(protectSexOpinionRows(safe), {
    suppressed: false,
    data: [{ sesso: 'M', favorevole: 20, contrario: 10, indeciso: 0 }]
  });
  const risky = [
    { sesso: 'M', favorevole: 20, contrario: 2, indeciso: 0 },
    { sesso: 'F', favorevole: 11, contrario: 0, indeciso: 0 }
  ];
  assert.deepEqual(protectSexOpinionRows(risky), { suppressed: true, data: [] });
  assert.deepEqual(protectSexOpinionRows([{ sesso: 'F', favorevole: 1, contrario: 0, indeciso: 0 }]), { suppressed: true, data: [] });
  assert.deepEqual(protectSexOpinionRows([]), { suppressed: false, data: [] });
});

test('gli endpoint nazionali e regionali leggono solo users.sesso e mantengono alias legacy innocui', () => {
  const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
  const surveys = read('api/routes/sondaggi.js');
  const opinions = read('api/routes/opinioni/stats.js');

  assert.match(surveys, /sesso IN \('M','F'\)/);
  assert.match(opinions, /u\.sesso IN \('M','F'\)/);
  assert.match(opinions, /political_opinions_consent/);
  assert.match(surveys, /protectSexCountRows\(result\.rows/);
  assert.match(opinions, /protectSexOpinionRows\(result\.rows/);
  assert.match(surveys, /'\/genere\/:regione\/:provincia\/:comune'/);
  assert.match(opinions, /router\.get\('\/stats\/:opinionId\/genere'/);
  assert.match(surveys, /deprecated: true, stats: \[\]/);
  assert.match(opinions, /deprecated: true, minimumCellSize, data: \[\]/);
  assert.doesNotMatch(surveys, /WHERE genere IS NOT NULL/);
  assert.doesNotMatch(opinions, /u\.genere IS NOT NULL/);

  assert.match(read('client/src/pages/Sondaggi/hooks/useSondaggiData.ts'), /\/api\/sondaggi\/sesso/);
  assert.match(read('client/src/components/sondaggi/useSondaggiData.ts'), /\/api\/sondaggi\/sesso/);
  assert.match(read('client/src/pages/StatisticheOpinione/hooks/useGenereStats.ts'), /\/stats\/\$\{opinionId\}\/sesso/);
});

test('i form di modifica non scrivono piu genere legacy e non permettono sesso CIE client-side', () => {
  const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
  const routes = [
    read('api/routes/users/search.js'),
    read('api/routes/users/profile.js')
  ];
  routes.forEach(source => {
    const start = source.indexOf('const allowedFields = [');
    const end = source.indexOf('];', start);
    assert.ok(start >= 0 && end > start);
    const permitted = source.slice(start, end);
    assert.doesNotMatch(permitted, /'genere'/);
    assert.doesNotMatch(permitted, /'sesso'/);
  });
  const form = read('client/src/components/profile/PersonalDataSection.tsx');
  assert.doesNotMatch(form, /onFieldChange\("genere"/);
  assert.doesNotMatch(form, /onFieldChange\("sesso"/);
  assert.doesNotMatch(read('client/src/pages/Profilo/components/ProfileInfo.tsx'), /userInfo\.genere/);
});

test('portabilita GDPR include sesso CIE senza rimuovere le informazioni storiche dell interessato', () => {
  const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
  assert.match(read('api/services/privacyDataExportService.js'), /'data_nascita', 'sesso', 'genere', 'cittadinanza'/);
  assert.match(read('api/routes/user/gdpr-rights.js'), /u\.sesso AS sesso/);
});
