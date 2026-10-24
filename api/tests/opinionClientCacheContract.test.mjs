import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { opinionQuestionsKey, purgePersonalOpinionCache } from '../../client/src/lib/opinionQueryKeys.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');

test('political-answer keys isolate accounts and grades', () => {
  assert.deepEqual(opinionQuestionsKey('Nazionale', 'account-a'), ['opinioniQuestions', 'Nazionale', 'account-a']);
  assert.notDeepEqual(opinionQuestionsKey('Nazionale', 'account-a'), opinionQuestionsKey('Nazionale', 'account-b'));
  assert.notDeepEqual(opinionQuestionsKey('Nazionale', 'account-a'), opinionQuestionsKey('Regionale', 'account-a'));
  assert.notDeepEqual(opinionQuestionsKey('Nazionale', null), opinionQuestionsKey('Nazionale', 'account-a'));
});

test('purge drops all grades, accounts and legacy unscoped keys but not public stats', () => {
  const keys = [
    ['opinioniQuestions', 'Nazionale'],
    ['opinioniQuestions', 'Nazionale', 'account-a'],
    ['opinioniQuestions', 'Regionale', 'account-b'],
    ['political-opinions-consent', 'account-b'],
    ['publicStats', 'Nazionale']
  ];
  const operations = [];
  const client = {
    cancelQueries({ queryKey }) {
      operations.push('cancel:' + queryKey.join('/'));
      return Promise.resolve();
    },
    removeQueries({ queryKey }) {
      operations.push('remove:' + queryKey.join('/'));
    for (let i = keys.length - 1; i >= 0; i--) {
      if (queryKey.every((v, j) => keys[i][j] === v)) keys.splice(i, 1);
    }
  }};
  purgePersonalOpinionCache(client);
  assert.deepEqual(operations, ['cancel:opinioniQuestions', 'remove:opinioniQuestions']);
  assert.deepEqual(keys, [['political-opinions-consent', 'account-b'], ['publicStats', 'Nazionale']]);
});

test('all four opinion pages and selector scope cached political answers to user ID', () => {
  for (const file of [
    'client/src/pages/OpinioniNazionali.tsx',
    'client/src/pages/OpinioniRegionali.tsx',
    'client/src/pages/OpinioniComunali.tsx',
    'client/src/pages/OpinioniEuropee.tsx',
    'client/src/pages/StatisticheOpinione/components/OpinionSelector.tsx'
  ]) {
    const code = source(file);
    assert.match(code, /queryKey:\s*opinionQuestionsKey\([^\n]+user\?\.id\)/, file);
    assert.match(code, /enabled:\s*!!user/, file);
    assert.match(code, /queryFn:\s*async\s*\(\{ signal \}\)/, file);
    assert.match(code, /apiRequest\("GET", [^\n]*undefined, undefined, signal\)/, file);
  }
});

test('revoke, auth loss and account deletion explicitly purge opinion snapshots', () => {
  for (const file of [
    'client/src/pages/GDPR/index.tsx',
    'client/src/hooks/use-auth.tsx',
    'client/src/pages/Impostazioni/CancellaAccount/index.tsx'
  ]) assert.match(source(file), /purgePersonalOpinionCache\(queryClient\)/, file);
  assert.match(source('client/src/hooks/use-auth.tsx'), /if \(!token\) purgePersonalOpinionCache\(queryClient\)/);
});

test('API request forwards React Query cancellation and preserves timeout', () => {
  const code = source('client/src/lib/queryClient.ts');
  assert.match(code, /externalSignal\?: AbortSignal/);
  assert.match(code, /externalSignal\?\.addEventListener\('abort', abortFromQuery/);
  assert.match(code, /signal: controller\.signal/);
  assert.match(code, /externalSignal\?\.removeEventListener\('abort', abortFromQuery/);
});
