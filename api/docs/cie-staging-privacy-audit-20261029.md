# DEMOS — audit staging e privacy CIE, 29 ottobre 2026

**Ambiente:** Supabase `Demos-Staging` (progetto `fkeayjzvtuvzesljhjbc`, PostgreSQL 17). **Nessuna scrittura/DDL su Supabase produzione.** Il ramo di codice è la PR #380 Draft.

## Allineamento limitato dello staging (eseguito)

La migration staging-only `staging_cie_identity_minimal_20261029` ha aggiunto `public.users.account_type VARCHAR(16)`, `public.users.sesso VARCHAR(1)` (CHECK M/F/NULL), e creato `public.identity_verifications` e `public.user_auth_providers` con i vincoli univoci e le FK necessari per testare identificazione e associazioni. Le nuove tabelle hanno RLS abilitato e forzato; nessun accesso `PUBLIC`, `anon` o `authenticated` è stato concesso.

Le 2 righe di `public.users` esistenti non sono state cancellate, riclassificate, né modificate nei campi già presenti. Nessun utente o identificativo di produzione è stato importato. Lo schema dello staging **non equivale ancora allo schema completo di produzione**: altre tabelle/campi delle registrazioni OAuth/passkey richiederanno una riconciliazione mirata prima di un E2E full-stack.

## Test PostgreSQL 17 eseguiti direttamente sullo staging

**12/12 PASS**, con `DO` PL/pgSQL: inserimento di profili e chiavi fittizi in un blocco eccezione PostgreSQL (subtransazione), seguito da errore deliberato e verifiche che tutte le righe sintetiche siano scomparse. Scenari:

1. CIE attiva può correggere un precedente M/F;
2. assenza di identità non autorizza la scrittura;
3. verifica scollegata non autorizza la scrittura né cambia M/F;
4. stato revoked non autorizza;
5. provider SPID non autorizza a scrivere un sesso da CIE;
6. tipo ORGANIZATION sempre escluso;
7. una person_key può appartenere solo a un utente;
8. un utente può avere una sola verifica;
9. vincolo sulla forma della person_key pseudonima;
10. vincolo M/F/NULL;
11. collegamento user_auth_providers sintetico;
12. rollback di utenti, identità e associazioni.

I dati fittizi sono stati eliminati mediante rollback transazionale; zero dati personali reali sono stati elaborati nei test. Questo test SQL **non** prova firma OIDC, callback reale o l'intero backend.

## Correzioni codice nella PR Draft

- `identityVerificationStore.getIdentityVerificationStatus` esclude le identità con `detached_at IS NOT NULL`; `sanitizeRow` e il ramo di idempotenza non considerano attive le identità scollegate.
- `registerVerifiedIdentity` usa `INSERT ... ON CONFLICT DO NOTHING RETURNING` e ricerca la collisione in query successive. Evita di effettuare una SELECT dentro una transazione PostgreSQL abortita da un errore 23505. Il conflitto tra due account resta bloccato; la doppia callback sullo stesso account è idempotente se la verifica è ancora attiva.
- `persistVerifiedCieSex` continua a richiedere una verifica CIE attiva nella stessa transazione e scrive soltanto `users.sesso` (M/F/NULL), senza `sesso_fonte`.
- L'export GDPR canonico ora include `identity_verification` solo con provider, status, verified_at, detached_at, retention_until. Non contiene `person_key` o codice fiscale; è compatibile con schemi precedenti in cui `identity_verifications` non esiste.
- I test coprono detachment, conflitto transazionale, OAuth/passkey, export, e un test di integrazione isolato `api/tests/ciePostgres.integration.test.js` con database PostgreSQL locale usa un secret HMAC **fittizio** e rifiuta host non locali.

## Revisione privacy — valutazione tecnica (non approvazione formale DPO)

**Verificato:** minimizzazione del singolo campo `users.sesso`; nessuna inferenza spacciata per certificazione; esclusione di PII identificativa dall'export e dai nuovi log; blocco di scritture M/F da provider diversi e di attestazioni scadute/scollegate; eliminazione collegamenti di identità prevista nel servizio di cancellazione `PrivacyErasureLedgerService`.

**Da riesaminare prima del rilascio:** autenticazione con OP CIE reale e userInfo firmata (non verificata qui); gestione cookie/redirect, cancellazione e retention di `person_key` nei casi di distacco; informativa e base giuridica del trattamento anagrafico; eventuali export ulteriori per Art. 15 GDPR; confronto dei flussi revoca/re-verifica; test Android fisico e QA con schema completo OAuth/passkey. Non eseguire nuove scritture in produzione prima del completamento di questi gate.

## Stato operativo

La PR #380 rimane Draft. Non fondere automaticamente o pubblicare un AAB soltanto perché i workflow GitHub sono verdi. Per la decisione formale sul rilascio consultare la riga GH-260 della CHECKLIST MASTER. Questa nota documenta esclusivamente modifiche e test tecnici.
