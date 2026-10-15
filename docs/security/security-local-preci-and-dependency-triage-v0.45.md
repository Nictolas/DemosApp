# CP-045 – Local pre-CI gate & dependency audit triage v0.45

## Obiettivo
Ridurre al minimo l'uso di GitHub Actions spostando la validazione ripetibile in locale, senza indebolire i controlli e senza attivare runner, deploy, migration o write di produzione.

## Gate locale
Comando unico dalla root:

`npm run test:security-preci`

Il gate esegue, nell'ordine:
1. `git diff --check`;
2. `node --check` su tutti i moduli `api/security-agent/*.js`;
3. `node --check` su tutti i test `api/tests/security*.test.js`;
4. suite completa `api` `test:security-agent`;
5. build production Vite del client.

Il gate non installa dipendenze, non usa rete, non fa push, non avvia GitHub Actions e non esegue deploy/migration/write.

## Workflow GitHub osservati
- `eci_sync.yml`: schedulato ogni 6 ore; è il principale consumo Actions indipendente dallo sviluppo del Security Agent.
- `update-monitoring.yml`: solo `workflow_dispatch`; contiene anche commit/push e quindi non fa parte del gate locale.
- Nessun workflow PR dedicato a test/lint/build del Security Agent è presente nel branch ispezionato.

## Audit dipendenze – baseline 05/10/2026
### API
- produzione (`npm audit --omit=dev`): 5 package vulnerabili = 1 high + 4 moderate;
- audit completo: 8 = 4 high + 4 moderate;
- i 3 high aggiuntivi sono dev-chain `nodemon -> chokidar/braces`;
- high di produzione: `@fastify/busboy`, fix disponibile senza major;
- moderate di produzione: catena `firebase-admin -> firestore/google-gax/uuid`; npm propone `firebase-admin` 14.5.0 come major upgrade.

### Client
- produzione: 37 package vulnerabili = 3 critical + 19 high + 14 moderate + 1 low;
- completo: 43 = 3 critical + 22 high + 16 moderate + 2 low;
- critical principali transitivi: `protobufjs`, `websocket-driver`, `tar`;
- `tar` è legato a `@capacitor/cli` e la correzione completa proposta richiede Capacitor 8 (major);
- fix non-major disponibili per varie dipendenze, tra cui Express, DOMPurify, PostCSS, Vite, protobufjs, Rollup e altre transitives;
- `tailwindcss`/`micromatch`/`braces` e `@originjs/vite-plugin-commonjs` hanno catene senza fix diretto pulito nel major corrente secondo npm audit.

## Decisione CP-045
Nessun `npm audit fix` automatico e nessun `--force`.
Gli aggiornamenti saranno separati in batch controllati:
1. fix non-major con test/build completi;
2. verifica funzionale auth/Firebase/WebAuthn/Capacitor;
3. major upgrade solo in checkpoint dedicati con rollback semplice.

L'AI Agent resta shadow/read-only. Action Runner, real delivery, migration e produzione restano disabilitati.
