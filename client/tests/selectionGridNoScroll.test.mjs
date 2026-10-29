import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

const css = read("../src/pages/SelectionGrid.css");
const pages = [
  read("../src/pages/Rappresentanti/index.tsx"),
  read("../src/pages/Candidati/index.tsx"),
];

test("rappresentanti e candidati condividono la griglia fissa delle cinque categorie", () => {
  for (const page of pages) {
    assert.match(page, /import "\.\.\/SelectionGrid\.css"/);
    assert.match(page, /selection-grid-page__content/);
    assert.match(page, /selection-grid-page__grid/);
    assert.match(page, /categorie\.slice\(1\)\.map/);
    assert.doesNotMatch(page, /overflow-y-auto|app-page-scroll|paddingBottom: '120px'/);
    assert.doesNotMatch(page, /<style jsx global>/);
    assert.match(page, /ViewOpinioniDialog/);
  }
});

test("tre righe fluide e nessuno scroll della pagina, senza bloccare globalmente i dialoghi", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /> button:first-child\s*\{\s*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.app-main:has\(\.selection-grid-page\)\s*\{\s*overflow-y:\s*hidden !important/);
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:html|body)\s*\{/);
});

test("le cinque schede non hanno altezze fisse", () => {
  const components = [
    "../src/pages/Rappresentanti/components/CategoriaPrincipale.tsx",
    "../src/pages/Rappresentanti/components/RappresentanteCard.tsx",
    "../src/pages/Candidati/components/CategoriaPrincipale.tsx",
    "../src/pages/Candidati/components/CandidatoCard.tsx",
  ];
  for (const path of components) {
    const source = read(path);
    assert.match(source, /h-full min-h-0/);
    assert.doesNotMatch(source, /h-60/);
  }
});

test("Candidati non è più compresso da una transizione senza altezza", () => {
  const app = read("../src/App.tsx");
  const route = app.match(/<Route path="\/candidati">([\s\S]*?)<\/Route>/)?.[1];
  assert.ok(route, "route candidati esistente");
  assert.match(route, /ProtectedRoute path="\/candidati"/);
  assert.doesNotMatch(route, /PageTransition/);
});

test("la griglia usa solo lo spazio disponibile sopra la navbar, con margine inferiore", () => {
  const shell = read("../src/robust-layout.css");
  assert.match(shell, /grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  assert.match(shell, /robust-app-layout__content > \.app-navbar/);
  assert.match(css, /\.selection-grid-page \.selection-grid-page__content\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 0;/);
  assert.match(css, /padding-bottom:\s*clamp\(1rem, 2\.5dvh, 1\.75rem\)/);
  assert.match(css, /\.selection-grid-page__grid\s*\{[\s\S]*?flex:\s*1 1 0;/);
  assert.match(css, /\.selection-grid-page__grid\s*\{[\s\S]*?height:\s*auto;/);
  assert.doesNotMatch(css, /\.selection-grid-page__grid\s*\{[^}]*height:\s*100%/);
});
