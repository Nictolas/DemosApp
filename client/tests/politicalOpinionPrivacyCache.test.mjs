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
 const cleared=revoke.indexOf("queryClient.removeQueries({ queryKey: ['opinioniQuestions'] })");
 const consent=revoke.indexOf("queryClient.invalidateQueries({ queryKey: ['political-opinions-consent'] })");
 assert.ok(cleared>=0 && consent>cleared);
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
