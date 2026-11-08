# PROD-041 / IMP-VOT-ULTIMO — verified current nominal votes

**Priority:** P0 / 10/10. **State:** Draft only, do not merge/deploy/clean up production.

## Decision and implementation

A representative has **one current nominal vote**, not a timeline. A chamber or institutional transition cannot leave two rows for the same DEMOS identity; same-day ballots from different institutions are not ordered by unrelated sequence numbers. The
database enforces a single row per `representative_key` (also across office transitions);
the writer atomically replaces it when the verified vote date is newer,
or on the same date and in the **same institution** its verified ballot
sequence is newer. Different institutions' same-day sequence numbers
cannot be compared. An older or equal-order replay cannot overwrite current state.
Same-day ambiguous sequencing must remain unresolved rather than guessed.
No party, political group, source roster, or individual history is stored.

- Camera and Senate selected representatives: `demos:<users.id UUID>`,
  taken from the currently selected, active representative and a
  fail-closed unique roster match on a checked roll call. The identity key
  is **not** the person's name. **A matching name is never sufficient to
  attribute a vote.** An explicitly linked `source_person_id` must be
  present in both the signed-off minimal identity bridge and the verified
  source row. Names are used only as an additional consistency check.
  The bridge `institutional_nominal_identity_links` has one unique
  source ID per institution and one DEMOS UUID per institution, no names,
  groups, ballot dates or voting history. Link entries require separate
  evidence review: no automatic seeding from names.
- European Parliament: reserved `pe:<official MEP id>` with official
  source only. Draft adapter `api/services/europeanCurrentNominalVoteAdapter.js`
  checks exact official MEP IDs and explicitly present voting categories;
  it never invents absences or copies political groups. It is **not yet
  wired to the independent EP import job**, so production coverage is
  **not implemented**. The European UI is outside this PR.
- Absent/mission/president statuses are preserved exactly when published
  as nominal status. No inference from party or political group; secret
  votes or missing source rows result in no new current record.
- Source/date/id/ballot order must be verified. The only accepted
  institutional data sources are official Camera, Openpolis Senate
  (explicitly non-institutional third party), official European Parliament.
- `GET /api/voti-politici/rappresentanti/:id/ultimo-voto?camera=Camera|Senato`
  returns one record or null, requires authentication, and never returns a
  list of individual historical votes. No EU interface changes.
- The feature remains disabled in production by its existing runtime flag.

Files: `api/database/20261108_institutional_current_nominal_votes.sql`,
`api/services/institutionalCurrentNominalVotesService.js`,
`api/services/parliamentLatestVoteNotificationsService.js`,
`api/routes/voti-politici.js`, the European standalone adapter,
unit tests and PostgreSQL ephemeral integration (including concurrent
writes, later EP ballots, and Camera-to-Senato office transitions);
`api/database/20261108_institutional_nominal_identity_links.sql`,
`api/database/20261108_latest_parliament_notifications_one_per_rep.sql`,
`api/tests/prod041SyntheticBackupRestore.sh`.

## Supabase inventory (read-only, 8 November 2026)

Project **Demos** `wxnblcqoyjqxktwkcqok`:
`parlamento_voti_nominali` **720** rows / **191** non-empty
`uri_politico` values, all from **five Senate ballots**; historic UNIQUE key is
`(uri_votazione,nome_politico,voto)` and **does not enforce** one per person.
`parlamento_europeo_voti_nominali` **0** rows; current schema uses
`(uri_votazione,mep_id)`, which would allow a history.
`voti_camera` **1,474** distinct names; **zero** rows have a populated `voto`,
`data_votazione` or `votazione_id` field. They are non-voting legacy metadata,
not an individual voting history, and must be preserved outside this cleanup. `notifiche_voti_parlamento` **0** rows in production. The Draft additionally ensures **one shared notification per person, not one per chamber**; migration refuses to silently collapse duplicates.
`parlamento` **284** and `parlamento_europeo` **84** are
ballot-level aggregates, not the nominal-personal history; retention
still needs assessment.

Project **Demos-Staging** `fkeayjzvtuvzesljhjbc` is a reduced
synthetic schema: `parlamento_voti_nominali` and EP nominal table
are absent. Do not import production personal/voting data into staging.

Legacy dependencies to audit before any cleanup:
- `api/routes/voti-politici.js` historic detail nominal reader and direct
  SPARQL per-person lookup **removed by Draft PR #633**; ballot details now
  return `voti_nominali: null` with ballot aggregates preserved;
- `api/services/parlamentoEuropeoService.js` legacy cache read and
  table bootstrap; EU feature belongs to a separate workstream;
- historical `api/crea-notifiche-voti-senato-retroattive.js`
  and maintenance scripts;
- `voti_camera` legacy pages, scrapers, image and profile tooling;
  preserve these non-voting metadata separately from nominal cleanup;
- old vote notifications and reactions, FCM consent and source attribution.
The obsolete nominal DB writer in PR #576 was disabled; no new legacy
history writes should be reintroduced. Audit all remaining scheduled jobs
and all active Render deployments before retiring legacy tables.

## Safety and production cleanup — not approved/executed

**Gate 1 — Freeze writers.** Confirm running backend commit, cron and
feature flags. Keep latest-vote push and notifications OFF. Inventory
all SQL readers, writers, functions, views, constraints and triggers.
Verify no unnamed consumer depends on legacy tables.

**Gate 2 — Back up.** Create an access-controlled encrypted point-in-time
`pg_dump` of exactly the affected legacy tables and related definitions,
plus schema/roles/constraints. Record checksums, counts, capture timestamp,
DB version and operator. On a free tier without PITR, a verified logical
dump is required; never assume automatic recovery. Backup is temporary,
not a permanent nominal-vote archive. DPO approves minimal retention and
secure deletion after the restoration window.

**Gate 3 — Dry run + reconciliation.** Run
`20261108_nominal_legacy_cleanup_readonly.sql`; reconcile each source
person ID to an active mandate and the most recent *source ballot date +
verified ballot sequence*. Do not use name or ingestion timestamp as
ordering. Reject missing IDs, date ambiguity, secret votes, duplicates,
source conflicts and stale/unsupported European data. Compare every
existing current-state row against source, after which snapshot-free
aggregation should still work.

**Gate 4 — Restore rehearsal.** Restore the encrypted dump to an
authorized offline/local test DB (not the shared staging with synthetic
data). Revalidate row counts, checksum, schema and application read
contracts. Rehearse rollback with writers stopped. Confirm no paid
resource provisioning.

**Gate 5 — Separate deletion approval.** After explicitly approved
migration, maintenance window and DPO/data-retention signoff, stop old
writers, verify last counts, perform bounded cleanup in a transaction,
check post-conditions and roll back on any mismatch. The candidate
unique-current table must be populated from verified source IDs first.
Do **not** execute legacy deletes in this Draft. Restore using the
approved encrypted backup if necessary; first stop writers and reconcile
any newer votes to avoid regressing the last-vote state.

**Gate 6 — Evidence.** Re-run tests, active authenticated Chrome/Android
flows, secret/missing ballots, camera/senate coverage, source provenance,
one row per stable ID, concurrency and failed-source behavior. Review
existing notification reaction dependencies; DPO review; explicit
merge/deploy GO separate from cleanup GO.

### Still-open release gates

1. Verified source-person mapping for the **720 Senate nominal historical**
   rows, encrypted backup and restoration rehearsal, then separate cleanup GO.
   Do not delete the 1,474 non-voting `voti_camera` metadata records.
   Ensure no retained history is exposed through legacy APIs.
2. EP current-vote ingestion with official stable MEP IDs, independent
   EU branch coordination and end-to-end tests; no EU UI changes here.
3. Legacy reader/writer and production cron/deploy dependency review,
   backed-up cleanup rehearsal and explicit deletion authorization.
4. **Source markup/link QA:** verify that live official Camera/Openpolis
   roll calls contain usable stable person hyperlinks. The parser will
   return no ID (and will not attribute a vote) for plain-text names.
   There is no automatic crosswalk in existing canonical mandates.
5. Authenticated E2E staging/Chrome/Android, FCM/cost/consent, DPO and
   separate release authorization.
6. Confirm running CI and exact HEAD of stacked Draft PR before merge.

The Transparency Podium is suspended, with no dependency on vote history.
No new paid services, production deploy, deletion, or push activation.

## Read-only production re-audit (8 November 2026, after Draft modifications)

A targeted SELECT confirmed that `voti_camera` has **1,474 distinct**
`politico_nome` values, **zero** populated vote fields, **zero** vote dates
and **zero** ballot IDs. By contrast, all **720**
`parlamento_voti_nominali` records belong to `camera = 'Senato'`,
with **191** distinct nonblank source-person URIs across **five** ballots.

The nominal cleanup must not delete `voti_camera`: these are currently
non-voting legacy metadata records. The historical Senate table remains
subject to backup, approved restoration rehearsal and explicit deletion GO.


## Verified-ID bridge, staging and shared-notification audit — 8 November 2026

**Identity audit (production SELECT only):** 1,485 currently active
Camera/Senate mandates (978 Camera, 507 Senate), 1,485 unique DEMOS
representative accounts. None of the five existing
`political_mandates.legacy_context` verification/source URL fields
matches an exact `uri_politico` value from the 720 legacy Senate
nominal rows. **Zero** verified source-person crosswalks can therefore
be imported by exact equality from these existing fields. Do not
infer matches from surnames or institutional office.

**Code:** source parser accepts a source-person URL only from an
explicit, validated person-profile anchor on the exact verified
ballot roster row, constrained to trusted Camera, Senato or Openpolis
domains. The current-vote writer requires a nonempty institution-appropriate
`sourcePersonId`; selected Italian representatives must have a record
in the vetted `institutional_nominal_identity_links` table and a matching
row-level source ID. Missing/ambiguous IDs yield no assignment. No
automated name-to-ID crosswalk or live manual link insertion was performed.

**Notification minimization:** the new Draft migration rejects any
existing cross-chamber duplicate `id_utente` and adds a unique index
on `id_utente`, not `(id_utente,camera)`. Writer changes its
`ON CONFLICT` to replace the existing shared row across institutional
transitions, with date + same-institution order guards and reaction reset.
It never automatically deletes duplicate real rows.

**Staging Supabase (pre-existing unified Demos-Staging, no new service):**
`institutional_current_nominal_votes` has a global PK on
`representative_key` with `source_person_id NOT NULL`; vetted
identity-link table created with RLS and no anon/authenticated SELECT;
identity bridge/current-vote tables contained **zero rows** at
post-migration verification. Existing `notifiche_voti_parlamento` was
verified empty and its prerequisite migration plus
`latest_rep` unique-index migration applied successfully.
The production project was not modified.

**Synthetic backup/restore rehearsal:** `api/tests/prod041SyntheticBackupRestore.sh`
is guarded to run only in isolated GitHub Actions PostgreSQL 16 with
`TEST_PARLIAMENT_PG_EPHEMERAL=true`. It exercises `pg_dump`, a
temporary encrypted backup (AES-256-CBC/PBKDF2), checksum comparison,
`pg_restore` into a separate ephemeral database and count/identity
checks, deleting the temporary files. **This is not a production backup
or an authorized restoration test of actual personal data.** Production
cleanup remains forbidden until an access-controlled, encrypted
production dump, actual verified restore test, DPO retention decision
and explicit deletion authorization are recorded.
