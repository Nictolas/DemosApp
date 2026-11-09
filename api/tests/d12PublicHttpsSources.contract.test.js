'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {validateEvidenceUrl}=require('../utils/recognitionEvidence');

const projectRoot=path.resolve(__dirname,'..','..');
const read=relative=>fs.readFileSync(path.join(projectRoot,relative),'utf8');

test('browser and API reject identical unsafe sources before creating nominations',async()=>{
  // This is a pure TS helper with no dependencies; Node 22 strips its type
  // annotations, so the test executes the actual browser validation logic.
  const client=await import(pathToFileURL(path.join(projectRoot,'client/src/lib/publicHttpsSourceUrl.ts')).href);
  const cases=[
    ['https://www.comune.pisa.it/elezioni/lista.pdf',true],
    ['https://www.regione.toscana.it/elezioni',true],
    ['https://example.org/fonte',true],
    ['https://portale.unipi.it/',true],
    ['http://example.org',false],
    ['file:///etc/passwd',false],
    ['https://localhost/',false],
    ['https://localhost.evil.local/',false],
    ['https://server.local/',false],
    ['https://server.internal/',false],
    ['https://intranet.lan/',false],
    ['https://status.home/',false],
    ['https://server.test/',false],
    ['https://server.invalid/',false],
    ['https://server.example/',false],
    ['https://server.onion/',false],
    ['https://127.0.0.1/private',false],
    ['https://127.1/private',false],
    ['https://0x7f000001/',false],
    ['https://192.168.1.1/',false],
    ['https://10.1.2.3/',false],
    ['https://172.16.0.1/',false],
    ['https://8.8.8.8/',false],
    ['https://[::1]/',false],
    ['https://[::ffff:127.0.0.1]/',false],
    ['https://alice:password@example.org/',false],
    ['https://example..org/',false],
    ['https://-invalid.example.org/',false],
    ['https://my-internal-server',false],
    ['https://example.org/'+'a'.repeat(2050),false],
  ];
  for(const [url,expected] of cases){
    const browser=client.isPublicHttpsSourceUrl(url);
    const api=validateEvidenceUrl(url)!==null;
    assert.equal(browser,expected,'browser: '+url);
    assert.equal(api,expected,'API: '+url);
    assert.equal(browser,api,'frontend/backend mismatch: '+url);
  }
});

test('both nomination screens and backend routes use the verified source validator',()=>{
  const generic=read('api/routes/subject-proposals.js');
  const grazia=read('api/routes/grazia.js');
  const proposalPage=read('client/src/pages/ProponiSoggetto.tsx');
  const graziaSchema=read('client/src/pages/Grazia/constants/schema.ts');
  assert.match(generic,/!validateEvidenceUrl\(sourceUrl\)/);
  assert.match(grazia,/!validateEvidenceUrl\(urlProva\)/);
  assert.match(proposalPage,/isPublicHttpsSourceUrl\(sourceUrl\.trim\(\)\)/);
  assert.match(graziaSchema,/\.refine\(isPublicHttpsSourceUrl,/);
  // Neither validation performs a network request or sends URL contents to logs.
  const validator=read('api/utils/recognitionEvidence.js');
  assert.doesNotMatch(validator,/\bfetch\s*\(|https\.get|http\.get|console\.log/);
});
