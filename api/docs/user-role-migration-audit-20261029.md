# DEMOS — F12-12: ruolo legacy, inventario e cutover controllato

Data: 29 ottobre 2026. Base: main a87af565c67114786c92631a8ed6982faae463fa.
Checklist autorevole: DEMOS – Roadmap – Tabella di Marcia, CHECKLIST MASTER, F12-12 e F12-12A…H.

## Regola architetturale confermata

- users.account_type distingue PERSON, ORGANIZATION, INSTITUTION.
- users.is_admin, users.is_dpo e users.is_activist descrivono capacità indipendenti.
- political_candidacies e political_mandates mantengono candidature e mandati con periodo, territorio e provenienza; non devono ricostruire incarichi da un vecchio ruolo.
- users.status è uno stato distinto. Non va unito ad account_type né eliminato automaticamente: il login OAuth e passkey controllano ancora 'a'.
- users.ruolo è una proiezione legacy. La sua rimozione è l'obiettivo finale, non il primo intervento.

## Evidenze iniziali, verificate su main

1. api/services/accountCapabilitiesService.js seleziona users.status, account_type, is_admin e is_activist, consulta le tabelle delle cariche, ma conserva il fallback a users.ruolo per vecchi schemi.
2. Nella base main, lo stesso servizio prima di questa PR contava qualsiasi mandato/candidatura ACTIVE, inclusi LEGACY_BACKFILL, come capacità politica attuale. Questa PR propone filtri espliciti per escludere tale origine non certificata.
3. api/routes/auth/oauth.js conserva SELECT users.ruolo e l'accesso è bloccato quando status != 'a'.
4. api/services/politicalEligibilityService.js conserva filtri users.ruolo = 'P' / 'CP' e users.status = 'a'.
5. api/routes/users/search.js, api/routes/organizzazioni.js e altre route utilizzano ancora ruolo come filtro o fallback.
6. Lato UI, il modello account_type è già usato per escludere le organizzazioni da alcuni dati M/F e per definire le statistiche delle Opinioni.
7. La migrazione api/database/create-account-capabilities-model.sql contiene ancora la proiezione di compatibilità legacy. NON eseguirla nuovamente alla cieca sulla produzione.
8. Da checklist POL-014: numerosi mandati LEGACY_BACKFILL/ACTIVE restano da verificare individualmente con fonti istituzionali. La migrazione non deve degradare o cancellare profili politici o inventare mandati.

## Evidenze F12-12B: aggregati live in sola lettura (29/10/2026)

Query riproducibili in `api/scripts/audit-account-role-consistency-20261029.sql`.
Produzione Supabase Demos, solo SELECT e conteggi: nessun ID/nome/email estratto.

| Controllo | Risultato |
| --- | ---: |
| Totale users | 1.838 |
| Contraddizioni tra account_type e ruolo I/O/persona | 0 |
| Contraddizioni is_admin vs AD | 0 |
| Contraddizioni is_activist vs A | 0 |
| status = 'a' | 1.835 |
| status = 'active' | 3 |
| ruolo in P/CP | 1.674 |
| P/CP senza mandato ACTIVE non-LEGACY_BACKFILL valido per periodo | 1.524 |
| NON-P/CP con mandato ACTIVE non-legacy valido per periodo | 0 |

Il fatto che 1.524 P/CP non abbiano attualmente un mandato non-legacy NON
significa che siano 1.524 utenti fittizi, inattivi o da eliminare. Significa che
il roster canonico deve essere completato e verificato prima del cutover. Un
mandato di provenienza non legacy non garantisce da solo attendibilità: occorre
sempre classificare la fonte.

In produzione sono stati osservati anche 1.524 mandati LEGACY_BACKFILL/ACTIVE
(e 7 candidature LEGACY_BACKFILL/ACTIVE): nessun dato è stato modificato.
Per i tre account con status 'active', l'attuale codice OAuth/passkey richiede
'a': serve una verifica del percorso di login prima di un'eventuale
normalizzazione, SENZA cambiarli automaticamente.

## Passo reale sul percorso /auth/me, solo PR Draft

La risposta `api/routes/auth/profile.js` era già munita di `getAccountSubject`
ma includeva ancora `u.ruolo` nella query canonica e lo usava come fallback
ridondante. Nella PR il campo JSON `ruolo` rimane disponibile come proiezione
compatibile `accountSubject.legacyRole`, mentre account type, flag admin,
attivista, politico/candidato e DPO derivano dal modello canonico e dallo
status (non dal vecchio ruolo). `getAccountSubject` mantiene per ora la
compatibilità con schemi vecchi. Questo intervento NON elimina `ruolo` dal
database e non è live.

## F12-12A — inventario statico

Il comando seguente non apre connessioni né modifica il database:

    node --test api/tests/userRoleMigrationAudit.test.js api/tests/accountCapabilitiesLegacyEvidence.test.js api/tests/accountCapabilitiesService.test.js api/tests/accountRoleConsistencyAudit.test.js api/tests/authMeAccountModelContract.test.js
    node scripts/audit-user-role-migration.js --output artifacts/user-role-inventory.json --markdown-output artifacts/user-role-inventory.md

Il report include percorso, riga, categoria e segnale per le sorgenti tracciate in Git. Cerca 'ruolo', 'account_type', flag capability e i riferimenti riconoscibili allo status dell'account. Conta anche test, script storici e ruoli diversi da users.ruolo: ogni corrispondenza va classificata prima della rimozione. Non è un elenco di dipendenze confermate.

In particolare la classificazione manuale deve distinguere:
- Runtime: login, controlli permessi, ricerche, liste, statistiche, profili, notifiche.
- Importatori e job batch: inserimenti/aggiornamenti di utenti e mandati, idempotenza, fonte del mandato.
- Migrazioni e trigger DB: proiezione users.ruolo, procedure e script eseguibili.
- Client e tipi API: pagine e serializzatori che ancora espongono/leggono ruolo.
- Test, documenti e file storici: non eliminare riferimenti solo per ridurre conteggi.

## Sequenza di esecuzione

A. Inventario e assegnazione della sostituzione precisa per ogni riferimento attivo.
B. Riconciliazione account e mandati, coordinata con POL-014, POL-015 e DBMAP-20261028.
C. Contratto dei tre stati indipendenti: tipo soggetto, capacità/mandati, stato di accesso.
D. Sostituzione backend con contratti API invariati e permessi server-side.
E. Sostituzione frontend e statistiche, verificando parità e qualità delle liste.
F. Suite test sinteticamente isolati, staging, auth, GDPR, CIE e utenti con capacità multiple.
G. Cutover controllato: niente merge automatico, audit e rollback verificato.
H. Solo dopo zero consumer attivi, migrazione DDL separata per rimuovere users.ruolo.

## Gate anti-regressione

- Non dedurre isPolitician da LEGACY_BACKFILL/ACTIVE, anche se il record è marcato ACTIVE.
- Non confondere lo status dei mandati con lo status di accesso di users.
- Non far dipendere autorizzazioni da metadati JWT modificabili lato client.
- Non attribuire P/C a una persona dalla sola uguaglianza di nome o data di nascita.
- Non cancellare né unificare utenti/mandati sulla base di questo audit.
- Non alterare gli endpoint Android in uso né rilasciare automaticamente la PR.

## Limiti della PR

Questa PR prepara un inventario riproducibile e una guardia locale contro mandati legacy non verificati nel servizio accountCapabilities. Non prova che la migrazione di tutti i consumer sia completa, non modifica schema/data di produzione, non sostituisce il controllo dei roster ufficiali e non autorizza il DROP COLUMN. Le verifiche di test nel workflow sono offline: NON sono un collaudo live di Supabase/Render.
