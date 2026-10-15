# Demos Security Agent — Database Isolation Review v0.7

## Stato
Review read-only del progetto Supabase `Demos` (`eu-central-1`, PostgreSQL 17.6). Nessuna migration applicata e nessuna credenziale creata.

## Evidenze live
- `security_agent` non esiste ancora: nessuna collisione di schema o tabelle.
- I ruoli `demos_security_agent_writer`, `demos_security_center_reader` e `demos_security_agent_maintenance` non esistono ancora.
- `postgres` può creare ruoli; `service_role` ha `BYPASSRLS`.
- SSL è attivo e `password_encryption` è `scram-sha-256`.
- Non risultano default ACL globali di `postgres` che concedano accesso a future tabelle custom ad `anon`/`authenticated`.
- Il Security Advisor segnala 29 funzioni `public` con `search_path` mutabile e 3 estensioni in `public`; sono gap separati da CP-007 e restano nel piano di hardening Supabase.

## Hardening introdotto nel draft
1. Revoca esplicita a `PUBLIC`, `anon`, `authenticated`, `service_role` e `authenticator`.
2. Ruoli di gruppo `NOLOGIN`, `NOBYPASSRLS`, `NOCREATEROLE`, `NOCREATEDB`, `NOSUPERUSER`.
3. Writer runtime senza `DELETE`.
4. Retention/cancellazione isolata nel ruolo `demos_security_agent_maintenance`.
5. Reader Security Center con solo `SELECT`.
6. RLS `ENABLE` + `FORCE` con policy separate per comando/ruolo.
7. Default privileges fail-closed per oggetti futuri nello schema.
8. `PostgresSecurityStore.prune()` usa soltanto un `maintenancePool` separato; senza di esso non cancella nulla.

## Piano credenziali — non eseguito
Dopo l'approvazione retention/DPIA creare tre LOGIN distinti, ciascuno membro di un solo ruolo di gruppo:
- runtime Security Agent → `demos_security_agent_writer`;
- Security Center read-only → `demos_security_center_reader`;
- job retention → `demos_security_agent_maintenance`.

Vincoli per tutti i LOGIN: `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, password SCRAM casuale lunga, TLS obbligatorio, secret separati su Render, rotazione documentata. Il runtime non deve usare `postgres` né `service_role`.

## Gate prima della migration
- retention definitiva approvata dalla linea Privacy/DPIA;
- review finale SQL;
- piano rollback;
- test privilegi positivi/negativi su ambiente non produttivo o transazione controllata;
- verifica Security Advisor dopo DDL;
- credenziali create e validate separatamente;
- solo dopo: shadow mode collegato al durable store.
