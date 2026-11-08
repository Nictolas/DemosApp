import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const component = read("../src/components/LatestItalianNominalVote.tsx");
const profile = read("../src/components/ProfileRepresentatives.tsx");
const service = read("../../api/services/institutionalCurrentNominalVotesService.js");

test("Italian profile opens exactly one latest verified nominal vote on demand", () => {
  assert.match(component, /enabled:\s*expanded\s*&&\s*validId/, "no new SQL read on initial profile display");
  assert.match(component, /\/api\/voti-politici\/rappresentanti\//);
  assert.match(component, /\/ultimo-voto\?camera=/);
  assert.match(component, /Nessun voto nominale attribuibile con certezza/);
  assert.match(component, /data\.ballot_outcome/);
  assert.match(component, /data\.source_url/);
  assert.match(component, /data\.ballot_title/);
  assert.match(profile, /representativeId=\{userInfo\.rappresentante_camera\}/);
  assert.match(profile, /chamber="Camera"/);
  assert.match(profile, /representativeId=\{userInfo\.rappresentante_senato\}/);
  assert.match(profile, /chamber="Senato"/);
  assert.doesNotMatch(profile, /<LatestItalianNominalVote[^>]*chamber="PE"/);
});

test("Last vote never includes a political group or a person-name lookup", () => {
  assert.doesNotMatch(component, /gruppo_politico|partito|political_group|m\.group/);
  assert.match(service, /ballot_outcome/);
  assert.match(service, /source_person_id/);
  assert.match(service, /WHERE institution = \$1 AND representative_key = \$2 LIMIT 1/);
});
