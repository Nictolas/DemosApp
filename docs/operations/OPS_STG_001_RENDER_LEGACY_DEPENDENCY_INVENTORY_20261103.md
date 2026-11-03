# DEMOS — OPS-STG-001: inventario Render legacy e gate sicurezza
**Data:** 03/11/2026 · **Ambiente unico futuro:** `demos-staging` · **GO:** NO

## Fonte e perimetro della verifica

Lettura delle **risorse esistenti** nell'account Render, workspace `tea-d2gs3eadbo4c73ag95rg`: elenco servizi, dettagli pubblici di deploy/start command/branch/IP, elenco PostgreSQL e Key Value; confronto **solo del codice di avvio** in GitHub per i servizi specializzati. Nessuna lettura o modifica di secret, env var effettive, log contenenti dati, utenti o record applicativi; nessuna chiamata alle API live del vecchio staging. Nessuna eliminazione, sospensione, cambio di deploy, invio push o risorsa creata.

Risultato: **12 servizi Render** complessivi: 2 produzione (`demos-frontend` static site, `demos-backend` web service), **10 servizi staging**, di cui **1 condiviso da conservare** e **9 legacy da valutare**. Tutti i 10 staging sono `autoDeploy=no`, non sospesi e con ingresso `0.0.0.0/0` (accesso Internet abilitato: non equivale ad autorizzazione applicativa).

## Servizio condiviso — NON modificare

| Servizio | ID | Branch | Start | Stato |
| --- | --- | --- | --- | --- |
| `demos-staging` (URL Render storico `demos-functional-staging.onrender.com`) | `srv-db52l1g473hc739ld250` | `ops/demos-unified-staging-20261102` | `cd api && node staging/unified_staging_bootstrap.js` | `autoDeploy=no`, `/health` 200, `/health/ready` 503, no API/DB/E2E |

**Attenzione:** il nome del servizio è cambiato in `demos-staging`, ma URL/subdomain e ID storico non implicano un secondo staging.

## Nove servizi legacy — inventario e dipendenze da verificare prima della dismissione

| Servizio | ID Render | Branch | Tipo avvio emerso | Rischio/controllo pendente |
| --- | --- | --- | --- | --- |
| `demos-civic-deploy-probe-staging` | `srv-dbkcblss728c73conl60` | `feat/civic-new-initiatives-push-20261101` | `staging/civic_render_boot_probe.js` | Probe HTTP di bootstrap; il codice rifiuta variabili DB/FCM; verificare configurazione effettiva |
| `demos-sondaggi-op37-http-staging` | `srv-dbeeca5g1s2s73fb7pd0` | `feature/sondaggi-text-bulk-op37-20261024` | `staging/op37_render_http_probe.js` | **Priorità alta**: il codice prevede un collegamento Supabase session-pooler 5432, token HTTP e CA se configurato; verificare che non punti a produzione |
| `demos-b2-readonly-restore-staging` | `srv-dbct3vmq1p3s73d7rhg0` | `fix/audit-outbox-20261021` | `npm run archive:axiom:readonly-health` | **Priorità alta**: il codice può usare credenziali B2 di sola lettura se presenti; verificare scope e assenza scritture |
| `demos-outbox-readonly-staging` | `srv-dbckvbivcj2c73f0i7e0` | `fix/audit-outbox-20261021` | `npm run audit:outbox:readonly-health` | **Priorità alta**: il codice può aprire connessione DB read-only e usa configurazione Axiom; verificare l'effettiva destinazione |
| `demos-p07-rollback-dryrun-staging` | `srv-db8i4d689jmc73drmhp0` | `phase7/p07-deploy-rollback-dry-run-v0` | Test security P07 + microserver HTTP inline | Verificare che la simulazione di rollback sia davvero non eseguibile, e le env runtime |
| `demos-first-four-playbooks-staging` | `srv-db8hdg8u01pc7387rbc0` | `phase5/first-four-playbooks-v0` | Test playbook P01–P04 + microserver HTTP inline | Verificare nessuna attivazione vera dei playbook e le env runtime |
| `demos-action-runner-sandbox-staging` | `srv-db8h8ubncjis73b26hu0` | `phase5/action-runner-sandbox-v0` | Test runner + microserver HTTP inline | Verificare sandbox, confini e env runtime |
| `demos-security-gates-staging` | `srv-db8h4uo473hc73eums60` | `main` | Suite security + microserver HTTP inline | Verificare che la suite non importi client production; env effettiva |
| `demos-security-staging` | `srv-db2ho5jncjis73ep4ot0` | `security/agent-foundation-v0` | `npm run start:security-staging-stack` | **Priorità alta**: stack sicurezza con possibili servizi Axiom e storage; verificare config isolata e destinatari |

Per tutti e nove: stato **non sospeso**, `autoDeploy=no`, IP allow-list `0.0.0.0/0`, piano `free`. **Queste proprietà sono un inventario, non una prova che l'app non legga credenziali o dati di produzione.** Dalla documentazione precedente emergono configurazioni potenzialmente non isolate; l'account/servizio effettivo va verificato senza mostrare valori sensibili.

### Risorse correlate NON cancellabili adesso

- **PostgreSQL Render** `demos-civic-staging-db`, ID `dpg-db4id8id0e5s73cfb0cg-a`, piano free, regione Frankfurt, stato available, **scadenza 08/11/2026 alle 17:38:42 UTC**. Rischio operativo **imminente**: preservare prova di ripristino/backup e dipendenze prima della scadenza; **non confondere scadenza con autorizzazione alla cancellazione**.
- **Render Key Value** `demos-security-staging-kv`, ID `red-db2ljmc9v7es738inuh0`, piano free, stato available, **persistenceMode=off**. Non dare per scontato che non sia più utilizzato.
- Copia di backup Render precedentemente segnalata in `D:\DEMOS-Preserved\Render-Archive\...`: questa posizione è fuori dallo spazio DeskMCP autorizzato, quindi **non è stato possibile verificarne indipendentemente l'esistenza/integrità** in questo turno. Non dichiarare il backup validato finché non si ottengono metadati/checksum e prova di ripristino attraverso un canale autorizzato.

## Sub-gate 1: fatto vs da fare

**Completato (sola lettura):** censimento 9/9 staging legacy, 1 staging condiviso, 2 produzione, 1 PG Render legacy, 1 Key Value; incrocio dei nove comandi di avvio con GitHub e classificazione di dipendenze **potenziali**. Nessuna nuova risorsa.

**Non completato:** verifica delle **env e delle credenziali reali**, verifica non invasiva di host/database/ref di destinazione e risorse esterne, prova di restore backup, presenza e isolamento del ruolo dedicato `demos_staging_preflight` (assente all'ultima lettura), connessione di preflight PostgreSQL a sola lettura via TLS/session-pooler. Nessun tentativo di aggirare blocchi di sicurezza del provisioning di ruoli.

### Ordine sicuro del lavoro successivo

1. Fare audit delle **sole chiavi e dei metadati permessi** degli ambienti Render, senza restituire, stampare o copiare valori di secret, e confermare destininazioni STAGING vs PROD servizio per servizio con verifica autorizzata.
2. Verificare il backup/restore del vecchio PostgreSQL **prima della scadenza dell'08/11**; preservare fino al GO.
3. Predisporre il ruolo PostgreSQL `demos_staging_preflight` con provisioning approvato e verifiche effettive `current_user`, `transaction_read_only=on`, NO SUPERUSER/BYPASSRLS, NO CREATE, NO UPDATE/INSERT/DELETE su `public`.
4. Soltanto dopo, applicare le ACL minime per fixture P3/P4 eventualmente approvate, configurare `demos-staging` verso Supabase Demos-Staging, collaudare E2E con push/email/cron OFF, e solo dopo considerare il cleanup.

**GO per cleanup legacy:** BLOCCATO. **GO applicativo Render:** BLOCCATO. **Produzione:** invariata.

Restano 4 gate principali complessivi, ma il lavoro di inventario del gate 1 è ora documentato. Valutazione dell'avanzamento di questo intervento: **6/10** — prepara una decisione sicura sulla dismissione ed evidenzia una scadenza, senza ancora risolvere credenziali né E2E.
