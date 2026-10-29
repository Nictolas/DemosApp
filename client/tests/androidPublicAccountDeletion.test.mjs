import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = process.env.DEMOS_ASSERT_BUILT_ASSET === '1'
  ? new URL('../dist/eliminazione-account.html', import.meta.url)
  : new URL('../public/eliminazione-account.html', import.meta.url);

test('public deletion instructions remain usable without a registered email', () => {
  const page = readFileSync(source, 'utf8');
  assert.match(page, /Eliminazione account DEMOS/);
  assert.match(page, /passkey/i, 'passkey-only users must have a deletion path');
  assert.match(page, /da un indirizzo email a cui puoi ricevere una risposta/i);
  assert.doesNotMatch(page, /dall.indirizzo email associato all.account/i);
  assert.match(page, /verificat[oa] la titolarit[aà] dell.account/i);
  assert.match(page, /Non inviare password, codici di accesso, passkey/i);
  assert.match(page, /mailto:privacy@demos\.community/);
  assert.match(page, /href="\/privacy-policy"/);
});
