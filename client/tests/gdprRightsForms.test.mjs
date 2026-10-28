import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
const compile = (path, loader) => transformSync(
  readFileSync(new URL(path, import.meta.url), 'utf8'),
  { loader, format: 'cjs', target: 'es2022' },
).code;
const retryHelper = { exports: {} };
vm.runInNewContext(compile('../src/lib/gdprRightsSubmission.ts', 'ts'), {
  module: retryHelper, exports: retryHelper.exports,
});

function harness(compiled, initialAuth) {
  let auth = initialAuth;
  let calls = 0;
  const box = name => ({ children }) => React.createElement('div', { 'data-component': name }, children);
  const named = names => Object.fromEntries(names.map(name => [name, box(name)]));
  const modules = {
    react: React,
    '@/hooks/use-auth': { useAuth: () => auth },
    wouter: { useLocation: () => ['/', () => {}] },
    '@/lib/queryClient': { apiRequest: async () => { calls++; throw Error('Unexpected API call while rendering'); } },
    '@/lib/gdprRightsSubmission': retryHelper.exports,
    '@/components/ui/button': {
      Button: ({ children, disabled, type, onClick }) => React.createElement('button', { disabled, type, onClick }, children),
    },
    '@/components/ui/card': named(['Card', 'CardContent', 'CardDescription', 'CardHeader', 'CardTitle']),
    '@/components/ui/alert': named(['Alert', 'AlertDescription']),
    '@/components/ui/label': { Label: ({ children, htmlFor }) => React.createElement('label', { htmlFor }, children) },
    '@/components/ui/checkbox': {
      Checkbox: ({ id, checked, disabled }) => React.createElement('input', { id, type: 'checkbox', checked, disabled, readOnly: true }),
    },
    '@/components/ui/textarea': {
      Textarea: ({ id, value, disabled, maxLength }) => React.createElement('textarea', { id, value, disabled, maxLength, readOnly: true }),
    },
    'lucide-react': named(['Loader2', 'Shield', 'FileText', 'AlertTriangle', 'CheckCircle', 'XCircle', 'Info']),
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected form dependency: ${name}`);
      return modules[name];
    },
  });
  return {
    Page: module.exports.default,
    setAuth(value) { auth = value; },
    apiCalls: () => calls,
    render: () => renderToStaticMarkup(React.createElement(module.exports.default)),
  };
}

for (const [name, directory, prefix, action] of [
  ['limitation', 'LimitazioneTrattamento', 'limitation', 'Applica Limitazioni'],
  ['objection', 'OpposizioneTrattamento', 'objection', 'Registra Opposizione'],
]) {
  const compiled = compile(`../src/pages/Impostazioni/${directory}/index.tsx`, 'tsx');

  test(`${name}: loading without a user renders safely and sends nothing`, () => {
    const page = harness(compiled, { user: null, isLoading: true });
    assert.match(page.render(), /data-component="Loader2"/);
    assert.equal(page.apiCalls(), 0);
  });

  test(`${name}: unauthenticated visitors receive the login prompt`, () => {
    const page = harness(compiled, { user: null, isLoading: false });
    const html = page.render();
    assert.match(html, /Accesso Richiesto/);
    assert.match(html, /Vai al Login/);
    assert.doesNotMatch(html, /type="checkbox"/);
    assert.equal(page.apiCalls(), 0);
  });

  test(`${name}: an authenticated form has labelled categories and cannot send an empty selection`, () => {
    const page = harness(compiled, { user: { id: 'synthetic-account-a' }, isLoading: false });
    const html = page.render();
    assert.match(html, new RegExp(`<label for="${prefix}-political_opinions"`));
    assert.match(html, new RegExp(`<input id="${prefix}-political_opinions" type="checkbox"`));
    assert.match(html, new RegExp(`<button disabled="">[\\s\\S]*?${action}</button>`));
    assert.equal(page.apiCalls(), 0);
  });

  test(`${name}: changing account changes the React form key, resetting its memory-only retry state`, () => {
    const page = harness(compiled, { user: { id: 'synthetic-account-a' }, isLoading: false });
    // These wrappers use only mocked auth/location hooks. Inspect their actual
    // React child boundary; do not simulate hook state or interactive rerenders.
    const first = page.Page();
    page.setAuth({ user: { id: 'synthetic-account-b' }, isLoading: false });
    const second = page.Page();
    assert.ok(React.isValidElement(first) && React.isValidElement(second));
    assert.equal(first.type, second.type);
    assert.equal(first.key, 'synthetic-account-a');
    assert.equal(second.key, 'synthetic-account-b');
    assert.equal(page.apiCalls(), 0);
  });
}
