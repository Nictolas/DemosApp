# Demos Security Agent — Credential & Migration Gate v0.8

## Stato del gate
**BLOCCATO PER PRODUZIONE.** Il foglio Privacy/DPIA non ha ancora una retention definitiva: il TTL è ancora da decidere. Nessuna migration, LOGIN role o secret deve essere creato finché quella decisione non è approvata.

## Separazione delle credenziali
Tre processi/capacità distinte, tre LOGIN differenti, nessun riuso di `DATABASE_URL` dell'app:

| Scopo | LOGIN previsto | Ruolo di gruppo | Secret env | Capacità DB |
|---|---|---|---|---|
| Security Agent runtime | `demos_security_agent_runtime` | `demos_security_agent_writer` | `SECURITY_AGENT_DATABASE_URL` | SELECT/INSERT/UPDATE security metadata; **NO DELETE** |
| Security Center | `demos_security_center_runtime` | `demos_security_center_reader` | `SECURITY_CENTER_DATABASE_URL` | SELECT-only |
| Retention job | `demos_security_retention_runtime` | `demos_security_agent_maintenance` | `SECURITY_RETENTION_DATABASE_URL` | DELETE incidenti scaduti + SELECT della sola `updated_at` |

Il runtime non deve usare `postgres`, `service_role`, `supabase_admin`, `authenticator`, `anon` o `authenticated`.

## Gate applicativo fail-closed
Il modulo `securityDbCredentialGate.js` impedisce l'attivazione del durable store finché non sono presenti contemporaneamente:
- flag del singolo componente (`SECURITY_AGENT_STORE_ENABLED`, `SECURITY_CENTER_STORE_ENABLED` o `SECURITY_RETENTION_JOB_ENABLED`);
- `SECURITY_STORE_POLICY_APPROVED=true`;
- `SECURITY_STORE_RETENTION_DAYS=<intero 1..3650>`;
- URL PostgreSQL con il LOGIN esatto previsto e password lunga almeno 24 caratteri.

Le opzioni SSL contenute nell'URL vengono rimosse e il client forza `rejectUnauthorized: true`; l'eventuale CA può essere fornita in `SECURITY_DATABASE_CA`.

Gli errori sono codici generici e non includono URL, password, hostname o altri secret. Lo status pubblico espone solo scopo, ruolo, retention e stato TLS.

## Confine dei processi
Preferenza architetturale:
1. `demos-security-agent` / worker → solo writer secret;
2. backend Admin / Security Center → solo reader secret;
3. job schedulato retention → solo maintenance secret.

Il maintenance secret **non deve essere presente nel processo del Security Agent**, così un agente compromesso non può cancellare le proprie evidenze.

## Matrice di verifica
`api/security-agent/sql/security-agent-privilege-matrix.sql` è un controllo read-only da eseguire dopo la futura migration e dopo la creazione dei LOGIN. Verifica:
- writer può leggere/inserire/aggiornare ma non cancellare;
- reader può solo leggere;
- maintenance può cancellare gli incidenti ma non inserirli/aggiornarli;
- anon/authenticated/service_role/authenticator non hanno USAGE sullo schema;
- ogni LOGIN appartiene a un solo ruolo di gruppo;
- RLS e FORCE RLS sono attive.

## Gate necessari prima dell'attivazione
1. retention definitiva approvata dalla linea Privacy/DPIA;
2. migration SQL finale approvata;
3. test privilegi su ambiente non produttivo o transazione controllata;
4. creazione dei tre LOGIN con password random SCRAM, nessun privilegio amministrativo e membership singola;
5. secret separati per servizio Render;
6. Security Advisor Supabase rieseguito dopo il DDL;
7. shadow run con durable store, senza azioni automatiche;
8. solo dopo, collegamento del Security Center.

## Non fatto in CP-008
- nessuna migration applicata;
- nessun LOGIN creato;
- nessun secret inserito su Render;
- nessun collegamento al runtime di produzione;
- nessuna modifica alla linea Privacy/GDPR.
