import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { opinionQuestionsKey, purgePersonalOpinionCache } from '../src/lib/opinionQueryKeys.ts';

// Exercise the installed TanStack Query runtime, not a Map-based mock.
// All account IDs and responses are synthetic. No network or API connection.
test('logout purge cancels an in-flight opinion query and discards its late response', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = opinionQuestionsKey('Nazionale', 'account-a');
  const publicKey = ['publicStats', 'Nazionale'];
  client.setQueryData(publicKey, { count: 42 });
  let completeRequest;
  let signalSeen;
  const pending = client.fetchQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      signalSeen = signal;
      return new Promise(resolve => { completeRequest = resolve; });
    }
  }).then(() => 'resolved', () => 'cancelled');

  assert.ok(signalSeen, 'TanStack must start the query');
  assert.equal(signalSeen.aborted, false);
  purgePersonalOpinionCache(client);
  assert.equal(signalSeen.aborted, true, 'The underlying fetch signal must abort on purge');
  assert.equal(client.getQueryData(key), undefined);
  completeRequest({ success: true, data: [{ userAnswer: 'f' }] });
  assert.equal(await pending, 'cancelled');
  assert.equal(client.getQueryData(key), undefined, 'Late data must not reappear');
  assert.deepEqual(client.getQueryData(publicKey), { count: 42 });
  client.clear();
});

test('purge cancels all account/grade snapshots including a query with an active observer', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const aKey = opinionQuestionsKey('Regionale', 'account-a');
  const bKey = opinionQuestionsKey('Nazionale', 'account-b');
  client.setQueryData(aKey, { data: [{ userAnswer: 'c' }] });
  let bSignal;
  let completeB;
  const pendingB = client.fetchQuery({
    queryKey: bKey,
    queryFn: ({ signal }) => {
      bSignal = signal;
      return new Promise(resolve => { completeB = resolve; });
    }
  }).catch(() => null);
  assert.ok(bSignal);
  purgePersonalOpinionCache(client);
  assert.equal(bSignal.aborted, true);
  completeB({ data: [{ userAnswer: 'i' }] });
  await pendingB;
  assert.equal(client.getQueryData(aKey), undefined);
  assert.equal(client.getQueryData(bKey), undefined);
  client.clear();
});
