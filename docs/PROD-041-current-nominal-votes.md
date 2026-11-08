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

- **Only Camera and Senate representatives selected by at least one
  active DEMOS user AND holding an approved source-person identity bridge**:
  `demos:<users.id UUID>`. This rule prioritizes the free tiers of Render,
  Supabase and external parliamentary sources. The same representative
  selected by many citizens is fetched once per source roll call and has
  exactly one global current-vote row, never per-follower vote copies.
  Without active followers there is no individual source fetch, new
  current-vote write or notification; an existing canonical current row
  is not immediately deleted on deselection (DPO retention decision still
  pending). A newly followed representative becomes eligible at the
  **next existing scheduled sync**, not a new paid service or per-user
  history query. Source metadata/list synchronization is shared and may
  still run independently for the public ballot-list UI. Attribution
  requires a fail-closed unique roll-call match. The identity key
  is **not** the person's name. **A matching name alone is never
  sufficient to attribute a vote.** Senate uses an explicit individual
  source-person link in the roll-call row matched exactly to a reviewed
  institutional identity bridge. The genuine official Camera ballot has
  *no row-level person links*: it requires a separately reviewed, official
  Camera `source_person_id` linked to DEMOS UUID with official
  `evidence_url`, plus one and only one matching name in the exact
  verified official roster and no competing selected candidate. Without
  this independent verified crosswalk, it writes nothing. The bridge
  `institutional_nominal_identity_links` stores no name, party, ballot,
  date or voting history. No automated name-to-ID backfill is authorized.
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
4. **Verified crosswalk QA:** live source capability test confirmed
   Camera has no row-level person links (397 source rows), Openpolis
   Senate provides person links in all 205 observed rows. Review a genuine
   official Camera source ID and independent evidence for each DEMOS
   representative before enabling the official roster fallback. Senato
   keeps exact person-ID matching. No current canonical mandate IDs
   were auto-crosswalked.
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

**Code:** the source parser obtains a source-person URI only
from an explicit trusted person-profile anchor when the source supplies
one. The writer always requires a stable verified source ID. Senato
demands an exact source-person URI match with the vetted bridge. Camera's
official source has no row links, so a separately vetted institutional
Camera ID and official `evidence_url` are mandatory before the
unique official full-name roster match can be used; duplicate names,
untrusted evidence and conflicting row links fail closed. No automatic
name-to-ID crosswalk or live identity link insertion was performed.

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


## Italian representative UI and verified outcome — 8 November 2026

The Draft added `ballot_outcome` to the **current row**, with
a checked optional short source-backed value (never inferred).
The Camera/Senato writer passes the exact already-verified
`openpolis_votazioni_finali_decisive.esito` value; the independent
EP adapter only passes an explicitly verified `ballotOutcome`
when present. No extra nominal history or database read is needed
to display outcome. `20261108_institutional_current_vote_outcome.sql`
was applied to the existing unified Supabase staging project.

The Italian **Profilo → Rappresentanti Camera/Senato** now contains
a lazy "Mostra ultimo voto verificato" control in
`LatestItalianNominalVote.tsx` called by `ProfileRepresentatives.tsx`.
It does **not issue a query until opened**, uses the authenticated
`GET /api/voti-politici/rappresentanti/:id/ultimo-voto` endpoint,
and shows exactly one current ballot title, date, individual status,
verified outcome if supplied and provenance link. If the source ID
or vote cannot be verified, it displays an unavailable/no-vote message;
it never guesses. Italian source attribution remains explicit:
Openpolis Senate is *not* falsely labelled as the institutional Senato.
No political groups or party names, no historical list, and **no
European interface modification**. This UI remains Draft until
authenticated Chrome and Android end-to-end QA succeeds.

## Live source verification and name+DOB reconciliation — 8 November 2026

**Real read-only network probe in GitHub Actions**: [Parliament run
42511211411](https://github.com/Nictolas/DemosApp/actions/runs/42511211411)
fetched authentic final roll calls without storing pages, names, vote
statuses or source-person URLs. The Camera official source dated
**5 November 2026** parsed **397** individual rows and **zero**
person-profile links. Openpolis Senate source dated **28 October 2026**
parsed **205** rows, **205** trusted person links. The original
hard requirement for a Camera link in every nominal row would have
prevented *all* verified Camera attribution. Corrected in Draft:
Camera can use only an **independently vetted official Camera identity
bridge and official evidence URL**, with a unique name in that one
official roll call; Senato continues matching the exact row-level
Openpolis person URL. No source identity is guessed or inserted.

**Read-only audit on production:** all 720 legacy Senato records refer
to 191 distinct `http://dati.senato.it/senatore/...` identifiers.
The non-voting `voti_camera` table has 1,474 rows and 1,472
distinct Openpolis person links, not institutional identity IDs.
Among 507 currently active Senate mandates, joining on unique
normalized public names across Senate source URI, Openpolis profile
and DEMOS candidate produces 179 candidate triples. **177** are
unique by all three source dimensions; comparing the official-person
candidate's DEMOS birth date to the published Openpolis profile slug
leaves **171 name+date-agreeing review candidates**, **4 conflicting
birthdates**, **2 missing birthdates**, and **2 ambiguous triples**.
These are **candidate matches, not accepted identity mappings**.
Manual/independent official registry verification is still necessary,
including checking the provenance and current validity of the birth
date and IDs. The four conflicts and ambiguous records must never be
promoted automatically.

`api/database/20261108_senate_identity_candidates_readonly.sql`
provides only read-only aggregate counts and a reviewer-scoped query
for source IDs and DEMOS UUIDs, with **no writes, history retention or
automatic link creation**. This candidate audit is not a license to
delete the 720 historical Senato rows. Human/DPO review and a verified
real backup/restore remain independent GO gates.

## Selection-scoped latest vote and explicit identity review gate — 8 November 2026

**Definitive product decision — free-tier first:** the temporary
"all approved representatives" experiment has been **reverted**.
Only an active politician with at least **one active follower selecting
that specific institution** is considered for the canonical latest
individual vote. SQL uses `EXISTS` over `political_selections`, an
active follower and an active political mandate. It never multiplies
representatives by follower count. Candidates must also have a manual
`VERIFIED` identity bridge. On zero selected eligible representatives,
the refresh does **not even query final-ballot candidate rows**, contact
a roll-call site, begin a write transaction or send any FCM notification.
When a new selection is made, the existing periodic final-ballot sync
will consider that representative on its next cycle; there is no
immediate per-follower fetch, scraping history, or paid service. When
the final follower deselects, future individual vote sync stops; an
existing last-current row is kept pending the documented DPO decision
rather than an unsafe automatic DELETE. The shared ballot-list updater
remains available to the public page regardless of selections. The
verified source safeguards, newest-date anti-replay rule, one row
per representative, and no names/parties/groups/history remain unchanged.
This decision is recorded in the four canonical DEMOS Google Sheets.

**Read-only selection census on production (8 November 2026):**
3 active selections identify **3 distinct current Camera representatives**;
6 active selections identify **4 distinct current Senate representatives**.
The selected-first source refresh therefore currently needs to consider
just **7** distinct Italian representatives, not all 1,485 active mandates.
All 7 selected representative mandates have source `LEGACY_BACKFILL`
and lack official profile identity URLs in their inspected
`legacy_context` fields, so the official person-ID bridge must still
be independently reviewed before attributing any vote. Of the 4
followed Senators, **zero** have a mutual-unique name-and-birthdate
candidate in the earlier 171-person *unselected* provisional audit.
The general 171-person reconciliation is therefore **not a launch
prerequisite** for this selected-only feature; focus evidence work on
these 7 selected MPs, with no automatic seeding. The read-only
`api/database/20261108_selected_mp_identity_review_readonly.sql`
is the scoped review queue; it returns no follower identities,
nominal history or private birth dates. Counts must be refreshed
before GO because user selections can change.

**Explicit reviewer constraint:** a newly created
`institutional_nominal_identity_links` entry is **PENDING**, not
implicitly approved by insertion. Migration
`api/database/20261108_institutional_identity_review_gate.sql`
adds `review_state`, `reviewed_by` (existing DEMOS reviewer UUID)
and `reviewed_at`. Its CHECK prevents `VERIFIED` with missing reviewer
or timestamp; selected representative SQL reads only
`review_state='VERIFIED'` with all required evidence fields. The
migration was applied to the existing staging service, where the link
table remained empty. No real person's identity was automatically
approved or copied into staging.

**CI:** unit tests and real isolated PostgreSQL 16 integration cover:
an unselected MP gets **no new current vote and no notification**;
two followers produce **one** vote and one notification; selecting an
already vetted MP enables the next scheduled sync; removing the last
selection stops new writes; a PENDING identity cannot be selected; a VERIFIED identity with missing
reviewer is rejected; manually reviewed synthetic identities can be
used; same-day replay, cross-chamber transition, reaction reset and
FCM consent tests remain active. Human identity review, end-to-end QA,
EU job integration, DPO and explicit production/release GO remain open.



## Selezioni future: controllo automatico dell'istituzione, senza approvazioni cieche

**Problema realmente verificato il 8 novembre 2026:** tra le 7 persone
seguite vi sono due selezioni istituzionali storicamente incongruenti
nel DB DEMOS, entrambe con `political_mandates.source='LEGACY_BACKFILL'`:
- **Claudio Borghi**, associato alla Camera in DEMOS ma senatore in XIX
  legislatura. Fonte ufficiale pubblica:
  https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00033070
- **Benedetto Della Vedova**, associato al Senato in DEMOS ma deputato
  nella XIX legislatura. Fonte ufficiale pubblica:
  https://www.camera.it/deputati/elenco/19-301577

La causa principale qui **non è l'omonimia**: è un attributo di
istituzione/mandato errato nel backfill. Non si devono riportare
voti da un'assemblea all'altra, né mutare in automatico le selezioni
degli utenti; i mandati errati vanno rettificati con una migrazione
distinta e testata, documentando la provenienza istituzionale.
Le 7 selezioni non equivalgono a 7 collegamenti istituzionali verificati.

**Preflight economico:** `api/services/parliamentSelectedOfficePreflightService.js`
è collegato al cron esistente `openpolisVotazioniFinaliJob.js` ma è
**DISABILITATO di default** (`PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED`).
Scansiona **soltanto rappresentanti seguiti da utenti attivi con
mandato attivo** e mappatura ID non ancora approvata, con una pagina
di 12 candidati per ciclo e rotazione della pagina tra cicli, al massimo
due URL pubblici dedotti da nome+data di nascita per candidato.
Cache volatile 24 ore di massimo 64 pagine; niente servizi a pagamento,
nessuna tabella aggiuntiva e nessuna registrazione di dati personali
in log. Da un profilo pubblico Openpolis verifica **nome, data
di nascita e Camera dichiarata**, con rigetto per profilo indisponibile,
omonimo non risolto, data incoerente o Camera non riconoscibile.
Il risultato è **solo un riepilogo di conteggi**, non un'autorizzazione
di voto; `CANDIDATE_ONLY` rimane non validato finché manca un riscontro
istituzionale. `OFFICE_MISMATCH` segnala un potenziale errore e non
aggiorna automaticamente un mandato o una preferenza cittadina.
Nessuna inserzione/approvazione in `institutional_nominal_identity_links`
e nessuna modifica in Supabase produzione durante il controllo.
Il codice `VERIFIED` con revisore autorizzato resta l'unico
ingresso nel writer dei voti. Non deve essere abilitato prima di
una verifica QA delle fonti live e dell'integrazione nella release.


## Legacy C/S identity double quarantine — 8 November 2026

**Existing canonical issue, not a newly authorized merge:** GitHub
[issue #396](https://github.com/Nictolas/DemosApp/issues/396) and
[Draft #397](https://github.com/Nictolas/DemosApp/pull/397)
already documented **36 same-name, same-DOB active legacy C/S
double-profile groups** and retired unsafe importer SQL. Draft #398
separately guards re-running the migration that fabricated
`LEGACY_BACKFILL/ACTIVE` historical mandates. Do not duplicate their
user-merging or migration work in PROD-041.

**New read-only check on production:** there are 1,485 active DEMOS
Camera/Senato representative IDs and 36 pairs (72 IDs) matching by
public name+DOB with C/S `LEGACY_BACKFILL/ACTIVE` mandates.
Exactly **2 of the 7 currently selected Italian representatives**
are in those cross-office legacy-duplicate groups (one of the three
selected Camera accounts, one of the four selected Senate accounts).
The accounts involved are Claudio Borghi and Benedetto Della Vedova.
A previous identity review warned that the Camera profile of
Claudio Borghi has authentication and personal preferences attached:
**never merge/delete it automatically**.

**New fail-closed writer gate:** `selectedRepresentatives` now
refuses a selected profile that has (a) a matching birth date and
the exact same first and last name as a *different* DEMOS user,
(b) a corresponding simultaneously active legacy-backfilled mandate
in the opposite house, and (c) its own selected mandate also
`LEGACY_BACKFILL/ACTIVE`. A **reviewed source-person link by itself
does not override** this provenance problem. Only after an independently
verified current-office mandate has been reconciled does the user
become eligible for selected-only current nominal votes. Same name
alone or different date of birth does not trigger this quarantine.
This does not merge users, remove existing notifications, change
selections, delete historical records or silently switch the house.
The reviewer-only queue
`api/database/20261108_selected_mp_identity_review_readonly.sql`
now returns `QUARANTINED_CROSS_CHAMBER_LEGACY_DUPLICATE` for such
selected cases; no follower IDs or private DOB is emitted.

**Regressions:** isolated real PG16 synthetic tests create a pair
of separately keyed C/S accounts with the same full name and DOB
and overlapping legacy mandates. Tests require quarantine even
with a manually VERIFIED identity link; an officially reconciled
current mandate lifts quarantine, while a same-name/different-DOB
pair is not automatically classified as one person. The entire
change remains Draft and has **not** been executed in production.
A user-profile merge and remediation of selected slots belongs to
issue #396 and requires an independent DPO/operations GO.

## Official selected-person birthdate and office source audit — 8 November 2026

The selected-only official-registration cross-check materially narrowed the
identity backlog. A **read-only query against the production selected
representative slots** was compared with institutional biographies
and the verified Camera proclaimed-members registry. In the initial
seven selected people:

- **2 office mismatches:** Claudio Borghi is a XIX Senatore despite
  selection of a Camera legacy duplicate; Benedetto Della Vedova
  is a XIX Deputato despite selection of a Senato legacy duplicate.
- **3 date-of-birth mismatches:** Marco Grimaldi has
  `1980-10-22` in DEMOS but the Camera's official XIX proclaimed-members
  roster reports `1980-11-08`; Carlo Calenda has `1973-09-04` in
  DEMOS vs. `1973-04-09` on the official Senate profile; Matteo
  Salvini has `1973-09-03` in DEMOS vs. `1973-03-09` on his
  official Senate profile. These are **biographical inconsistencies
  requiring controlled correction, not a license to merge accounts**.
- **2 public biographies agree on current office and DOB:** Nicola
  Fratoianni (Camera) and Peppe De Cristofaro (Senato). They are
  **not yet source-person-ID-VERIFIED** and must NOT be used to attribute
  a current nominal vote until the stable crosswalk is reviewed.
  The Senate institutional name is *Peppe De Cristofaro*, whereas
  Openpolis renders the same known profile as *Giuseppe De Cristofaro*.
  The optional preflight now reuses the notifier's source-confirmed
  **Peppe/Giuseppe alias**; it does not enable any fuzzy or arbitrary
  nicknames.

**Evidence repository:** `api/database/20261108_selected_official_registry_audit_readonly.sql`
contains only seven publicly documented institutional biographies,
reference URLs, birth dates, and current chambers, with snapshot date.
When executed against real active DEMOS selections it returned
`OFFICE_MISMATCH_REVIEW=2`, `DOB_MISMATCH_REVIEW=3`,
`PUBLIC_BIO_MATCH_NOT_ID_VERIFIED=2` and
`NEEDS_NEW_OFFICIAL_REGISTRY_REVIEW=0`; no user/follower IDs
or private voting history was included in any report. It is an
**operator-only, SELECT-only snapshot**, not an automated
registration/approval process. A future newly selected person
unrecognized by this snapshot receives
`NEEDS_NEW_OFFICIAL_REGISTRY_REVIEW`, not a false match.

**Public first-party source evidence:**
- The **XIX** Camera official proclamation register
  `https://www.camera.it/deputati/elezioni/eletti` for
  Marco Grimaldi's birth date.
- XIX personal page Nicola Fratoianni:
  `https://www.camera.it/deputati/elenco/19-305880`
- XIX personal page Benedetto Della Vedova:
  `https://www.camera.it/deputati/elenco/19-301577`
- XIX Senate biographies (each canonical):
  `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00033070` (Borghi),
  `...?did=00030110` (Calenda),
  `...?did=00022918` (De Cristofaro),
  `...?did=00025407` (Salvini).

**Default-off automated screening:** the optional
`PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED` now reports
`birthDateMismatches` separately from `officeMismatches`,
without logging names/UUIDs or approving any link. Synthetic
unit tests assert date mistakes do not grant `VERIFIED`.
No DOB or selection was rewritten in production, no merge was
performed and the deployment remains NO-GO.

## Selected Senate IDs from existing source cache — 8 November 2026

**Additional selected-only, source-backed identity-preparation work:**
`api/database/20261108_selected_senate_official_id_candidates_readonly.sql`
extracts **only politician person-ID candidates**, not vote histories,
from the existing legacy table `parlamento_voti_nominali`.
It joins active citizen selections and live eligible Senato mandates,
checks the chamber exactly, restricts politician URIs to the
`dati.senato.it/senatore/<number>` host/path, deduplicates identical
IDs, and returns an `official_review_url` only for exactly **one**
institutional ID candidate. Different official IDs for the same name
produce `AMBIGUOUS_SOURCE_PERSON_IDENTITIES`; absence of an ID
produces `NO_OFFICIAL_PERSON_ID_IN_EXISTING_CACHE`. These are
**read-only reviewer candidates**, never `VERIFIED` identities.
No new DB table, download of per-politician vote history, user selection
change, link upsert, profile write, merge, or FCM dispatch.

**Live aggregate result for four currently followed Senate slots:**
- **Peppe De Cristofaro**: **1 unique official Senate person ID**,
  `22918` from four previously cached nominative-source rows.
  Reviewer URL:
  `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=22918`.
  His DEMOS public DOB agrees with the first-party Senate registry.
  The Openpolis historic profile URL contains a **different DOB suffix**
  and must NOT be treated as a first-party DOB authority.
- **Matteo Salvini**: **1 unique official Senate person ID**,
  `25407` from one cached nominal source row. Reviewer URL:
  `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=25407`.
  DEMOS DOB remains inconsistent with the institutional biography,
  so no approval or automatic correction.
- **Carlo Calenda**: no official person ID in this limited source cache.
  The Senate's public first-party registry already identifies person ID
  `30110` and public DOB `1973-04-09`, but this MUST NOT be
  silently assumed equal to a nominal roll-call source-person href.
- **Benedetto Della Vedova**: no official Senate candidate in the
  cache, consistent with the outstanding historical wrong-house slot.
  His active first-party office is Camera, requiring the issue #396
  selection/identity reconciliation without changing a citizen's
  preference without authorization.

**Important stale-cache limitation:** `voti_camera.url_openpolis`
also contains three legacy Openpolis profile URLs for the current
selection names Grimaldi, Calenda and Peppe De Cristofaro, whose
birth-date suffixes conflict with at least one first-party registry
DOB. Never parse those slug dates as evidence to grant
`review_state='VERIFIED'`, to correct `users.data_nascita` or to
merge people. The optional public Openpolis `profileEvidence`
is *screening only*. For the authoritative DOB/office, use actual
Camera/Senato first-party documents.

**Regression:** PG16 ephemeral integration inserts a synthetic
selected senator, duplicate source URI, a cross-chamber URI,
an untrusted host, and later a conflicting official ID. The report
must dedupe valid repeats, ignore foreign hosts/chambers, withhold
ambiguous URLs, drop deselected senators, and leave all identity links
unchanged. The static audit test forbids DML/DDL.
No production or staging data has been mutated.


## Bridge Parlamento europeo — Draft, verifica prima del rilascio (08/11/2026)

- La PR #633 ora impone `representativeKey=demos:<UUID>` al writer PE. Qualunque chiave `pe:<MepId>` viene rifiutata prima di interrogare il database.
- La singola istruzione SQL PE controlla e blocca con `FOR SHARE` il collegamento UUID↔MepId approvato (`review_state='VERIFIED'`, revisore, data), l'URL di prova ufficiale, il mandato E attivo e almeno una selezione canonica `eu.parliament.it` appartenente a un follower attivo. Senza condizioni valide, non effettua alcuna scrittura. La scheda continua a richiedere la prova verificata in lettura.
- L'adattatore PE richiede metadata dell'identità già revisionata e produce soltanto la chiave DEMOS. La migrazione `api/database/20261108_ep_verified_identity_bridge.sql` è stata portata dalla proposta collaudata della PR #635: CHECK PE su MepId numerici da 1 a 9 cifre, preservando Camera/Senato, PK/UNIQUE, review gate e RLS. **Il file non è stato applicato a staging o produzione.**
- La suite PostgreSQL 16 effimera include i casi di rifiuto dopo revoca review, sostituzione indebita MepId e assenza di follower, oltre a scritture concorrenti, replay e unicità di voto. L'esito della CI va verificato sulla HEAD dopo ogni modifica.

**Rimane NO-GO:** collegamento dei tre UUID europei da revisionare (uno con anno di nascita discordante), E2E autenticato sullo staging unico, QA AAB Android, controllo DPO, autorizzazioni specifiche a modifiche schema, cleanup, merge/deploy e pubblicazione.
