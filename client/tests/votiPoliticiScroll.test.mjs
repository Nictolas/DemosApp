import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/VotiPolitici.tsx", import.meta.url), "utf8");

test("Voti Politici page has its own vertical scroll container", () => {
  assert.match(source, /<PageContainer className="[^"]*overflow-y-auto[^"]*">/);
  assert.match(source, /<div className="w-full flex-none px-4 py-6">/);
  assert.equal(source.split('max-h-[55dvh] overflow-auto overscroll-contain').length - 1, 2);
  assert.ok(source.includes('aria-label="Elenco dei voti dei politici" tabIndex={0}'));
  assert.ok(source.includes('aria-label="Elenco delle votazioni parlamentari" tabIndex={0}'));
});

test("admin guidance identifies the Votazioni tab and explains how to generate AI explanations", () => {
  assert.match(source, /<TabsTrigger value="votazioni">Votazioni<\/TabsTrigger>/);
  assert.match(source, /isAdmin && \(\s*<p className="mt-2 text-sm text-muted-foreground">/);
  assert.match(source, /Per generare una spiegazione AI/);
  assert.match(source, /accanto a una spiegazione non disponibile/);
});

test("generation controls remain administrator-only and a short action label is visible in the Votazioni tab", () => {
  assert.match(source, /isAdmin && \(\s*<Button[\s\S]*?generaSpiegazioneMutation\.mutate\(votazione\.votazione_id\)/);
  assert.match(source, /Genera Spiegazione/);
  assert.match(source, /Genera\s*<\/Button>/);
});
