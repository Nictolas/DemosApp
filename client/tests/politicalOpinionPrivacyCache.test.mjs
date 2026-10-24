import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('personal opinion cache keys always include authenticated user identity',()=>{
 for(const [file,grado] of [
  ['pages/OpinioniNazionali.tsx','Nazionale'],
  ['pages/OpinioniRegionali.tsx','Regionale'],
  ['pages/OpinioniComunali.tsx','Comunale'],
  ['pages/OpinioniEuropee.tsx','Europeo']
 ]){
  const s=source(file);
  assert.ok(s.includes("queryKey: ['opinioniQuestions', '"+grado+"', user?.id]"),file);
 }
});

test('GDPR consent revocation purges cached sensitive opinion answers before refreshing state',()=>{
 const s=source('pages/GDPR/index.tsx');
 const revoke=s.slice(s.indexOf('const revokeConsentMutation'));
 const cancelEntry=revoke.indexOf("queryClient.cancelQueries({ queryKey: ['opinioniQuestions'] })");
 const cancelStats=revoke.indexOf("queryClient.cancelQueries({ queryKey: ['statsOpinionQuestions'] })");
 const cleared=revoke.indexOf("queryClient.removeQueries({ queryKey: ['opinioniQuestions'] })");
 const clearedStats=revoke.indexOf("queryClient.removeQueries({ queryKey: ['statsOpinionQuestions'] })");
 const consent=revoke.indexOf("queryClient.invalidateQueries({ queryKey: ['political-opinions-consent'] })");
 assert.ok(cancelEntry>=0 && cancelStats>=0);
 assert.ok(cleared>cancelEntry && clearedStats>cancelStats && consent>clearedStats);
});

test('statistics selector never shares a userAnswer cache key with opinion entry pages',()=>{
 const s=source('pages/StatisticheOpinione/components/OpinionSelector.tsx');
 assert.match(s,/queryKey: \['statsOpinionQuestions', grado, user\?\.id \?\? 'guest'\]/);
 assert.doesNotMatch(s,/console\.log\([^)]*data\)/);
});

test('opinion entry screens never print personal political answers to the browser console',()=>{
 for(const file of [
  'pages/OpinioniNazionali.tsx',
  'pages/OpinioniRegionali.tsx',
  'pages/OpinioniComunali.tsx',
  'pages/OpinioniEuropee.tsx'
 ]){
  assert.doesNotMatch(source(file),/console\.log\s*\(/,file);
 }
});

test('central API client must not log raw response payloads',()=>{
 const s=source('lib/queryClient.ts');
 assert.doesNotMatch(s,/console\.(?:log|error)\([^\n]*(?:text|JSON\.stringify\(data|data\.data)/);
 assert.doesNotMatch(s,/Text preview|Parsed data|Text that failed to parse/);
});

test('every personal opinion read forwards the React Query AbortSignal to the HTTP client',()=>{
 for(const [file,grado] of [
  ['pages/OpinioniNazionali.tsx','N'],
  ['pages/OpinioniRegionali.tsx','R'],
  ['pages/OpinioniComunali.tsx','CO'],
  ['pages/OpinioniEuropee.tsx','E']
 ]){
  const s=source(file);
  assert.match(s,/queryFn: async \(\{ signal \}\) => \{/);
  assert.ok(s.includes('apiRequest("GET", "/api/opinioni-list?grado='+grado+'", undefined, undefined, signal)'),file);
 }
 const selector=source('pages/StatisticheOpinione/components/OpinionSelector.tsx');
 assert.match(selector,/queryFn: async \(\{ signal \}\) => \{/);
 assert.ok(selector.includes('undefined, undefined, signal'));
 assert.ok(selector.includes('enabled: !!user'));
 assert.ok(selector.includes('return response.data;'), 'statistics selector must unwrap the actual JSON payload');
 const client=source('lib/queryClient.ts');
 assert.match(client,/externalSignal\?: AbortSignal/);
 assert.match(client,/externalSignal\?\.addEventListener\('abort', abortFromQuery/);
 assert.match(client,/externalSignal\?\.removeEventListener\('abort', abortFromQuery/);
});

test('ordinary consent UI contract cannot cache IP addresses or user-agent evidence',()=>{
 const hook=source('hooks/usePoliticalOpinionsConsent.ts');
 assert.match(hook,/interface ConsentData \{/);
 assert.match(hook,/granted: boolean/);
 assert.match(hook,/timestamp: string \| null/);
 assert.doesNotMatch(hook,/ipAddress|userAgent/);
});
