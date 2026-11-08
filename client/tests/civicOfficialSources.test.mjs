import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { civicOfficialSourceUrl, CIVIC_SOURCE_LABELS } from "../src/lib/civic-official-sources.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("Ministry civic links require an official ID, never user-submitted URLs", () => {
  assert.equal(civicOfficialSourceUrl("iniziative_popolari", "7300000"),
    "https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/7300000");
  assert.equal(civicOfficialSourceUrl("referendum_abrogativi", 7300001),
    "https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/7300001");
  assert.equal(civicOfficialSourceUrl("referendum_abrogativi", null, "https://evil.test"),
    null);
  assert.equal(civicOfficialSourceUrl("iniziative_popolari", "non-numerical"),
    "https://firmereferendum.giustizia.it/referendum/open");
  assert.equal(CIVIC_SOURCE_LABELS.eci, "Commissione europea");
});

test("ECI official URL rejects hostile scheme, subdomains, credentials and spoofing", () => {
  const fallback = "https://citizens-initiative.europa.eu/index_it";
  const cases = [
    "javascript:alert(1)",
    "http://citizens-initiative.europa.eu/unsafe",
    "https://citizens-initiative.europa.eu.evil.test/unsafe",
    "https://evil.test/citizens-initiative.europa.eu",
    "https://attacker@citizens-initiative.europa.eu/path",
    "data:text/html,hello",
    "invalid-url",
  ];
  for (const url of cases) {
    assert.equal(civicOfficialSourceUrl("eci", "2026-000011", url), fallback, url);
  }
  assert.equal(civicOfficialSourceUrl("eci", "2026-000011", "https://eci.ec.europa.eu/066/public/?lg=it"),
    "https://eci.ec.europa.eu/066/public/?lg=it");
});

test("the three existing detail dialogs reuse one information component without new requests", () => {
  const component = read("client/src/components/civic/CivicOfficialInformation.tsx");
  const paths = [
    ["client/src/pages/IniziativePopolari/components/ViewDialog.tsx", "iniziative_popolari"],
    ["client/src/pages/ReferendumAbrogativi/components/ViewDialog.tsx", "referendum_abrogativi"],
    ["client/src/pages/ECI/index.tsx", "eci"],
  ];
  assert.match(component, /<details/);
  assert.match(component, /<summary/);
  assert.match(component, /civicOfficialSourceUrl/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /\b(fetch|apiRequest|useQuery|useEffect)\s*\(/);
  for (const [path, category] of paths) {
    const content = read(path);
    assert.match(content, /<CivicOfficialInformation/);
    assert.ok(content.includes(`category="${category}"`), path);
  }
});
