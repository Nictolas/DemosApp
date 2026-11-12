'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Parliamentary petitions have working entry points on mobile and desktop', () => {
  const firma = read('client/src/pages/Proponi.tsx');
  const desktop = read('client/src/pages/Preferiti/PreferitiDesktopHub.tsx');
  const app = read('client/src/App.tsx');

  assert.match(firma, /title: "Petizione Parlamentare"/);
  assert.match(firma, /href: "\/petizioni-parlamentari"/);
  assert.match(desktop, /id: "petizioni-parlamentari"/);
  assert.match(desktop, /path: "\/petizioni-parlamentari"/);
  assert.ok(firma.includes('description: "Firma qui per chiedere ai politici di intervenire su un tema."'));
  assert.ok(desktop.includes('description: "Firma qui per chiedere ai politici di intervenire su un tema."'));
  assert.match(desktop, /label: "Petizione Parlamentare"/);
  assert.match(app, /<Route path="\/petizioni-parlamentari">/);
  assert.match(app, /<ProtectedRoute path="\/petizioni-parlamentari" component=\{PetizioniParlamentari\} \/>/);
  assert.match(app, /import PetizioniParlamentari from "\.\/pages\/PetizioniParlamentari"/);
});

test('Parliamentary petitions page scrolls independently above the mobile navbar', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const page = read('client/src/pages/PetizioniParlamentari/index.tsx');

  assert.match(layout, /location === '\/petizioni-parlamentari'/);
  assert.match(page, /<PageContainer className="overflow-hidden">/);
  assert.match(page, /app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(page, /aria-label="Petizione parlamentare"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.doesNotMatch(page, /page-with-navbar|min-h-screen/);
});

test('Petitions use official destinations only, not unverifiable signature states or backend reads', () => {
  const page = read('client/src/pages/PetizioniParlamentari/index.tsx');

  assert.match(page, /https:\/\/petizionionline\.camera\.it\/petizioni/);
  assert.match(page, /https:\/\/www\.camera\.it\/leg19\/468/);
  assert.match(page, /https:\/\/www\.senato\.it\/relazioni-con-i-cittadini\/presentare-una-petizione/);
  assert.match(page, /SPID o CIE/);
  assert.match(page, /Non tutte le/);
  assert.match(page, /non verifica lo stato/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /apiRequest|useQuery|fetch\(|axios|supabase|localStorage|setInterval/);
  assert.doesNotMatch(page, /Firma ora|Firma questa petizione|\d+ firme raccolte/);
});

test('Petitions have their own yellow palette on mobile and desktop, including dark mode', () => {
  const mobile = read('client/src/pages/Proponi.tsx');
  const desktop = read('client/src/pages/Preferiti/PreferitiDesktopHub.tsx');
  const theme = read('client/src/css/color-scheme.css');
  const card = mobile.slice(mobile.indexOf('title: "Petizione Parlamentare"'));
  const shortcut = desktop.slice(desktop.indexOf('id: "petizioni-parlamentari"'));

  assert.match(card, /tone: "warning"/);
  assert.match(card, /border-yellow-300/);
  assert.match(card, /from-yellow-50/);
  assert.match(card, /from-yellow-500/);
  assert.match(card, /text-yellow-700/);
  assert.match(shortcut, /accent: "#a16207"/);
  assert.match(shortcut, /accentSoft: "#fef08a"/);
  assert.match(theme, /html\.dark \.demos-semantic-card--warning\s*\{[\s\S]*--demos-tone-border: #fbbf24;/);
});


test('Petitions guidance explains the two Camera actions, Senato requirements and privacy', () => {
  const page = read('client/src/pages/PetizioniParlamentari/index.tsx');

  assert.match(page, /Petizione Parlamentare/);
  assert.match(page, /Cos'è una petizione parlamentare/);
  assert.match(page, /non servono le 50\.000/);
  assert.match(page, /non è obbligato ad accogliere/);
  assert.match(page, /Presenta una petizione/);
  assert.match(page, /Sottoscrivi una petizione/);
  assert.match(page, /Entrambi i pulsanti aprono lo stesso portale/);
  assert.equal((page.match(/href=\{CAMERA_PETITIONS_URL\}/g) ?? []).length, 2);
  assert.match(page, /Consulta l'elenco pubblico/);
  assert.match(page, /Istruzioni per presentarla/);
  assert.match(page, /firma digitale valida/);
  assert.match(page, /documento\s+d'identità valido/);
  assert.match(page, /Come preparare una petizione/);
  assert.match(page, /problema di interesse generale/);
  assert.match(page, /Commissione competente/);
  assert.match(page, /dark:bg-slate-900/);
  assert.match(page, /dark:text-slate-300/);
  assert.doesNotMatch(page, /apiRequest|useQuery|fetch\(|axios|supabase|localStorage|setInterval/);
});
