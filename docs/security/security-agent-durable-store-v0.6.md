# Demos Security Agent — Checkpoint 6: Durable Security Store v0.6

## Stato

**Implementato nel branch come codice e migration draft. Nessuna migration applicata, nessun deploy.**

## Obiettivo

Sostituire in futuro il `MemorySecurityStore` con una persistenza PostgreSQL separata, mantenendo gli stessi vincoli privacy-safe stabiliti nei checkpoint precedenti.

## Schema dati

Schema PostgreSQL dedicato: `security_agent`.

Tabelle previste:

- `security_agent.incidents`
- `security_agent.source_state`

Non esistono colonne per:

- `user_id`, `account_id`, `participant_id`;
- email, IP o session ID;
- codice fiscale/CIE;
- opinioni o risposte politiche;
- payload/body/raw event;
- mapping Identity↔Research.

Non esistono FK verso `users`, Identity, Research o tabelle politiche.

## Permessi

La migration draft definisce due ruoli di gruppo `NOLOGIN`:

- `demos_security_agent_writer`: scrittura/lettura solo nello schema security;
- `demos_security_center_reader`: sola lettura.

La migration non contiene password e non crea credenziali di login. L'assegnazione delle credenziali reali sarà un passaggio infrastrutturale separato.

`PUBLIC`, `anon` e `authenticated` non ricevono accesso allo schema. Le tabelle hanno RLS abilitata e policy esclusivamente per i due ruoli security.

## PostgresSecurityStore

`PostgresSecurityStore`:

- riceve un `pg.Pool` già configurato, quindi non legge segreti direttamente;
- usa query parametrizzate;
- valida status/severity/limit;
- sanitizza gli incidenti con la stessa allowlist del memory store;
- salva i batch di incidenti in transazione;
- persiste solo contatori/timestamp per lo stato sorgente;
- esegue pruning sulla retention configurata;
- calcola statistiche aggregate server-side.

## Compatibilità async

`ShadowSecurityRunner` e `SecurityCenterService` ora accettano sia lo store in-memory sincrono sia un durable store asincrono tramite `await` sul contratto comune.

Le API del Security Center restano GET-only e ora attendono correttamente letture asincrone.

## Retention

Il codice mantiene un valore configurabile. **La retention definitiva non viene fissata in questo checkpoint**: dovrà essere allineata con Privacy/DPIA prima di applicare la migration.

## Cosa NON viene fatto

- nessuna migration Supabase applicata;
- nessun nuovo schema creato in produzione;
- nessuna credenziale DB creata;
- nessun env var Render modificato;
- nessun mount su `server.js`;
- nessun runner attivato;
- nessun LLM;
- nessuna azione automatica.

## Gate prima dell'attivazione

1. retention approvata dal lavoro Privacy/DPIA;
2. revisione della migration sul database Supabase reale;
3. credenziali dedicate writer/reader;
4. test di isolamento: ruoli normali Demos, `anon` e `authenticated` non devono poter leggere lo schema;
5. test restore/backup dello store security;
6. solo dopo: collegamento shadow in ambiente controllato.
