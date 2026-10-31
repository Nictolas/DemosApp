'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/PrivacyPolicy.tsx', import.meta.url), 'utf8');
const start = source.indexOf('id="eliminazione-account"');
const next = source.indexOf('className="bg-blue-50 p-4 rounded-lg mt-4', start);
const section = source.slice(start, next);

test('privacy deletion instructions support passwordless and unlinked-email accounts', () => {
  assert.ok(start >= 0 && next > start);
  assert.match(section, /Google, Apple o passkey/);
  assert.match(section, /indirizzo email non associato/);
  assert.match(section, /La sola email non dimostra la titolarità/);
  assert.match(section, /Non inviare password, codici di accesso, passkey o documenti/);
  assert.doesNotMatch(section, /credenziali \(email e password\)/);
  assert.doesNotMatch(section, /confermare la tua identità con la password/);
  assert.doesNotMatch(section, /indicando l'email dell'account da eliminare/);
});

test('privacy deletion wording does not claim an unverified successful deletion', () => {
  assert.match(section, /Considera completata la cancellazione soltanto quando ricevi un esito confermato/);
  assert.match(section, /La sola ricezione/);
  assert.match(section, /copie tecniche e i backup richiedono procedure distinte/);
  assert.doesNotMatch(section, /verranno eliminati in modo permanente/);
});

test('privacy deletion explains actual profile categories without legacy mandatory names', () => {
  assert.match(section, /comune di residenza, cittadinanza, anno di nascita, sesso/);
  assert.doesNotMatch(section, /Profilo utente \(nome, cognome, email/);
  assert.doesNotMatch(section, /genere, avatar/);
});
