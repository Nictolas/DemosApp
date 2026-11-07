# DEMOS 12 — DSAR synthetic rehearsal (draft, not executed)

Status: **DRAFT / NO-GO**. Scope: PR #502 only. This document is a test plan, not evidence of a completed DSAR, legal approval, or a deployed process.

## Preconditions
- Use an isolated, disposable PostgreSQL 17 database and synthetic UUIDs, names and HTTPS example.org URLs only.
- Run against the exact checked-out PR commit, recording its full SHA and the test command/output.
- Do not use DEMOS production, DEMOS10 unified staging, real profiles, real email addresses, or real notifications.
- Keep feature flags off in deployed environments. If a local test needs a flag, enable it only in the disposable process and record it.
- Verify migrations and route contracts on the disposable database; stop if the schema is incompatible.

## Scenario A — request from a proposer
1. Create synthetic users A (proposer), B (different authenticated user), and an Admin in the isolated database.
2. Create a pending proposal owned by A and an approved proposal with an unrelated synthetic title.
3. Verify B cannot read A's private proposal, obtain A's proposer UUID through the Admin list, or change either proposal.
4. Simulate A's account erasure through the canonical application service. Assert pending/rejected proposals are deleted, while approved/withdrawn records are detached from A only when the schema contract allows it; assert the public response remains minimized.
5. Verify no identifying proposer information survives in public directory payloads, nested JSONB, API errors, notifications or test logs.

## Scenario B — request from the person named by a third party
1. Create an approved synthetic Activist/Organization proposal, distinct from the proposer account.
2. Register a **fictional** rectification/objection ticket, with a case ID and timestamps but no real personal data.
3. Confirm an authenticated non-Admin cannot withdraw or edit the approved record. Test Admin withdrawal using the existing authorized endpoint.
4. Confirm the approved public directory no longer returns the withdrawn item; test first page, page beyond 100 records, and an old cursor. Record whether a background client refreshes when foregrounded.
5. Check that notification failure cannot roll back the withdrawal. Do not claim that withdrawal equals permanent erasure: retained audit, backups, caches and notification artifacts need separate review.

## DSAR workflow acceptance
- Record reception timestamp, classification (proposer vs named person), identity verification proportional to risk, action taken, recipients where applicable, response timestamp and closure.
- Article 12 GDPR: normally respond within one month; any permitted extension and reasons must be communicated within the first month. Do not require identity documents automatically.
- Articles 15–19 GDPR: assess access, rectification, erasure, restriction and recipient notification as applicable; record justified exceptions.
- Do not store real case content or personal identifiers in project-wide Google Sheets; use a restricted case register with an approved retention period.
- For Art. 14 third-party notice, Art. 9 political data, Art. 10 judicial data (especially Grazia), Art. 5(1)(e) retention, and Art. 35 DPIA screening: require separate documented human decisions. A public source or proposer consent does not establish legal basis for the named person.

## Evidence required before marking PASS
- Exact HEAD SHA, clean disposable database fixture, test commands, assertion counts, failure modes and redacted logs.
- CI results for that exact SHA, plus a human-reviewed evidence record in the privacy sheet.
- Actual mailbox intake and Android/staging end-to-end testing are **separate release gates** and are not proven by this rehearsal.

**Current result: NOT RUN.** This plan introduces no production/staging changes, migration, feature flag, or real DSAR.


## 07/11/2026 — Regressione sintetica: ritiro dopo generazione cursore (prova parziale)
- Nel ramo Draft, il test PostgreSQL 17 effimero `api/tests/publicApprovedSubjectPagination.pg.integration.test.js` aggiunge a entrambe le categorie **Attivisti** e **Organizzazioni** uno scenario distinto da quello preesistente dei ritiri antecedenti alla prima GET: dopo la prima pagina di 100 proposte su 105, un record nella seconda pagina viene marcato `withdrawn` **solo nella fixture sintetica**.
- Il cursore precedente deve restituire 4 voci senza il nominativo ritirato; la nuova consultazione completa deve avere 104 identificativi unici e payload limitato a `id,title`. Questo dimostra una proprietà della query di paginazione al momento della lettura, non il funzionamento della procedura umana DSAR.
- Commit del test: `a7f81d035b55f691ad0fe0638e0d3d9197dcef62`. Registrare separatamente il risultato del job GitHub `Civic privacy and moderation contracts` / PostgreSQL17 e l'HEAD definitivo; **non attribuire PASS prima della verifica**.
- **Limiti:** non è stato invocato l'endpoint Admin di ritiro, né il percorso canonico di cancellazione account. Nessuna prova su notifiche, email `privacy@demos.community`, cache già presenti nei browser aperti, gestione di una richiesta di una persona reale, staging/produzione o Android fisico. Le altre attività degli scenari A/B e i gate legali restano aperti. Stato **DRAFT / NO-GO**.


## 07/11/2026 — Collaudo parziale tramite endpoint Admin reale e directory paginata
- Dopo il controllo di paginazione su query diretta, è stato esteso il test già esistente `api/tests/subjectProposalLifecycle.pg.integration.test.js`. Tale test avvia **le route Express effettive** contro PostgreSQL 17 temporaneo, con utenti e record fittizi; il ritiro passa ora attraverso `POST /api/subject-proposals/admin/:id/withdraw`, non un `UPDATE` manuale.
- Nuove asserzioni: il cursore della pagina Admin `approved` acquisito **prima del ritiro** non restituisce più il record ritirato; la GET Admin resta `no-store` e contiene solo i campi consentiti. La directory pubblica `GET /api/subject-proposals/approved?category=attivisti`, su una o due pagine, esclude lo stesso ID e limita i record a `id,title`; nessun duplicato. La fixture comprende più di 100 approvati.
- Commit test `5f8012d7991fe9f257ea9baf0e036bb3f914c8cd`: controllo sintattico V8 effettuato prima del push; esito PostgreSQL 17/GitHub Actions **da verificare sul nuovo HEAD**, non dedurre dal PASS del commit precedente.
- **Non completato:** cancellazione canonica account come esercitazione DSAR integrale, identità del soggetto nominato, ricezione e risposta effettive, comunicazione ai destinatari, retention e DPIA. Il test verifica una proprietà tecnica del ritiro Admin sintetico, NON una procedura GDPR approvata. Staging, produzione, Android fisico e casella privacy non toccati. **NO-GO**.


## 07/11/2026 — Regressione aggiuntiva cursore pubblico pre-ritiro
- Gap rilevato nella verifica precedente: il cursore Admin era preesistente al ritiro, mentre il cursore **pubblico** era ottenuto solo dopo il ritiro. Questo non dimostrava la sicurezza di un cursore pubblico già consegnato.
- In `api/tests/subjectProposalLifecycle.pg.integration.test.js` il test Express/PG17 ora acquisisce la prima pagina e il `next_cursor` della directory Attivisti **prima** del ritiro Admin, verificando che il soggetto da ritirare si trovi nella pagina successiva. Dopo il `POST /api/subject-proposals/admin/:id/withdraw` riutilizza il vecchio cursore pubblico e verifica status 200, `Cache-Control: no-store`, assenza dell'ID ritirato e proiezione stretta `id,title`. Rimangono i controlli Admin e la consultazione pubblica fresca.
- Commit del test `f7a10ae4bcaf48567d59fa23cfc200c705a5bd6f`. Sintassi JS verificata prima del push; esito CI sul nuovo HEAD da verificare. Fixture soltanto sintetica, senza profili reali o scritture a database condivisi. La cache già conservata in browser aperti, le richieste DSAR vere e i gate legali/staging/Android restano **non verificati / NO-GO**.
