import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Use the compiler already locked and installed by Vite, whether nested or hoisted.
const { transformSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
const compiled = transformSync(
  readFileSync(new URL('../src/pages/Sostenitori.tsx', import.meta.url), 'utf8'),
  { loader: 'tsx', format: 'cjs', target: 'es2022' },
).code;

// Execute the real page and real React hooks/SSR. Substitute only its external
// data hooks and presentation components; unexpected imports fail closed.
function pageHarness(auth, apiRequest = async () => { throw Error('Unexpected API call'); }) {
  const queries = [];
  const box = name => ({ children }) => React.createElement('div', { 'data-component': name }, children);
  const named = names => Object.fromEntries(names.map(name => [name, box(name)]));
  const modules = {
    react: React,
    '@/hooks/use-auth': { useAuth: () => auth },
    '@tanstack/react-query': {
      useQuery(options) {
        queries.push(options);
        return { data: undefined, isLoading: false, isError: false };
      },
    },
    '@/lib/queryClient': { apiRequest },
    wouter: {
      Redirect: ({ to }) => React.createElement('span', { 'data-redirect': to }),
      Link: ({ href, children }) => React.createElement('a', { href }, children),
    },
    '@/components/ui/button': named(['Button']),
    '@/components/ui/card': named(['Card', 'CardContent', 'CardDescription', 'CardHeader', 'CardTitle']),
    '@/components/ui/tabs': named(['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger']),
    'lucide-react': named(['Loader2', 'ArrowLeft', 'Users', 'Eye', 'EyeOff']),
    recharts: named(['PieChart', 'Pie', 'Cell', 'Tooltip', 'Legend', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid', 'ResponsiveContainer']),
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected page dependency: ${name}`);
      return modules[name];
    },
  }, { filename: 'Sostenitori.compiled.cjs' });
  return {
    queries,
    render: () => renderToStaticMarkup(React.createElement(module.exports.default)),
  };
}

test('supporters page renders the authentication loading state without a user', () => {
  const page = pageHarness({ user: null, isLoading: true });
  assert.match(page.render(), /data-component="Loader2"/);
  assert.ok(page.queries.length > 0);
  assert.ok(page.queries.every(query => query.enabled === false));
});

test('supporters page redirects an unauthenticated visitor without dereferencing a user', () => {
  const page = pageHarness({ user: null, isLoading: false });
  assert.match(page.render(), /data-redirect="\/auth"/);
  assert.ok(page.queries.every(query => query.enabled === false));
});

test('the combined political profile loads its own private aggregate and preserves the response', async () => {
  const calls = [];
  const counts = { politico: 3, candidato: 4, attivista: 1, organizzazione: 0, totale: 8 };
  const page = pageHarness({ user: { id: 'synthetic-cp', ruolo: 'CP' }, isLoading: false }, async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ success: true, data: counts }) };
  });
  page.render();
  const query = page.queries.find(item => item.queryKey[0] === 'totaleData');
  assert.ok(query?.enabled);
  assert.deepEqual(await query.queryFn(), counts);
  assert.deepEqual(calls, [['GET', '/api/sostenitori/totale-privato?sostenuto_id=synthetic-cp']]);
});

test('a failed private aggregate request rejects instead of producing invented zero counts', async () => {
  const page = pageHarness({ user: { id: 'synthetic-cp', ruolo: 'CP' }, isLoading: false }, async () => {
    throw Error('Synthetic authorization failure');
  });
  page.render();
  const query = page.queries.find(item => item.queryKey[0] === 'totaleData');
  await assert.rejects(query.queryFn(), /Synthetic authorization failure/);
});
