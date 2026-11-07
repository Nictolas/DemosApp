# OPS-STG-001 / T-55 — audit di sblocco a privilegi minimi (07/11/2026)

**Ambito: solo preparazione e metadata read-only; nessun deploy o modifica di database/Render.**
**Decisione: APP CANARY NO-GO; GROQ E2E NO-GO; notifiche Android 0/6.**

## Evidenze reali (Supabase Demos-Staging)

Fonte: consultazioni SQL **SELECT soltanto** tramite connettore ufficiale Supabase del progetto `fkeayjzvtuvzesljhjbc`, 07/11/2026, senza leggere nomi, voti, credenziali, token, testi o altri dati personali.

- `demos_staging_preflight` e `demos_staging_runtime`: entrambi `LOGIN=true`, `SUPERUSER=false`, `BYPASSRLS=false`, `CREATEDB=false`, `CREATEROLE=false`, `INHERIT=false`. Questo controllo di attributi **non certifica ogni grant o policy**.
- Identità `public.civic_runtime_identity`: fingerprint atteso corrisponde; guardia `public.civic_push_delivery_guard.blocked=true`. Dispositivi **0**; outbox civica **48** eventi storici, eventi `pending/dispatching/sent` **0**.
- Schema `public`: 51 tabelle, incluse tutte le 35 tabelle dello schema preflight. Sulle 35 tabelle, `demos_staging_runtime` ha **sia SELECT sia policy RLS di lettura applicabile su 14/35**. Sono **21/35** quelle non pronte (elencate di seguito). Non ampliare privilegi per far passare un controllo aggregato.
- Le 4 fonti del canary civico `eci`, `iniziative_ministero`, `iniziative_popolari`, `referendum_abrogativi`: grant SELECT, policy RLS runtime e RLS enabled **verificati**, ma questo non prova un login via Render né il successo delle query LIMIT 0 nel ruolo effettivo.
- `parlamento`, `votazioni_parlamento`, `voti_camera`: ognuna presente, **0 righe**, RLS enabled, **nessun SELECT runtime e nessuna policy RLS runtime applicabile**. Non inserire righe o aprire accessi fino a review di fixture sintetiche.
- Mancano inoltre le tabelle parlamentari per l'E2E AI completo: `parlamento_analisi_legge`, `parlamento_europeo`, `parlamento_europeo_voti_nominali`. I DDL nel repository **non sono stati applicati** e richiedono review di trigger, grant, RLS e idempotenza.

Le 21 tabelle del contratto senza coppia completa di SELECT + policy RLS:
```
active_sessions, candidati, civic_processes, comunicazioni, eventi, ice,
notifiche_avvistamenti, notifiche_comunali, notifiche_voti_comuni,
notifiche_voti_parlamento, opinioni_domande, parlamento,
political_candidacies, political_mandates, political_opinion_notifications,
programmi, segnalazioni, unita_elettorale, votazioni_parlamento,
voti_camera, voti_referendum_abrogativi
```

## Stato Render effettivo

Unico servizio condiviso `demos-staging`, ID `srv-db52l1g473hc739ld250`, branch `ops/demos-unified-staging-20261102`, `autoDeploy=no`, command `cd api && node staging/unified_staging_bootstrap.js`, deploy LIVE `ec0f7fad083a8d1daa6d74663f037fdd79daf98e`. È ancora **bootstrap**, non app-capable. La suite `Unified Staging Offline Safety` della PR #565 è green, ma non prova il runtime appena descritto.

## Sequenza sicura per lo sblocco

1. **Review e coordinamento DEMOS 10 / OPS-STG-001.** Riconfermare i toggle OFF, l'identità staging, la guardia blocked, 0 device e 0 outbox azionabili, e un rollback bootstrap pronto. Non confondere il precedente `STAGING_RUNTIME_LOCK_AUDIT_PASS` con il gate app.
2. **Canary civico read-only per primo:** il già versionato `api/staging/unified_staging_civic_readonly_canary.js` consulta 4 fonti con `LIMIT 0` e `BEGIN READ ONLY` e non richiede, di per sé, tutti i grant delle 35 tabelle. Dopo **GO separato per il solo staging condiviso**, review dei flag `app_canary`, privilege/DSN e test di sicurezza, effettuare deploy reversibile dello **stesso** servizio con push, Firebase, email, cron, login, admin e write OFF. Verificare `/health/civic-sources` senza contenuto record, `/health/ready=503`, API scrittura/dispatcher 404 e guard blocked; ripristinare bootstrap al primo FAIL. Nessun deploy autorizzato da questo documento.
3. **Piano ACL per le route E2E richieste:** associare ciascun endpoint alle sole tabelle/colonne/fixture sintetiche necessarie, creare review specifica di grants e policy RLS per `demos_staging_runtime`; non dare 21 SELECT indiscriminati. RLS + grant devono essere entrambi presenti; escludere utenti reali e `anon/authenticated`.
4. **Parlamento GROQ-02:** prima usare fixture ufficiali *pubbliche* minime e dati sintetici per test di route con lo schema esistente; verificare separatamente DDL delle tre tabelle mancanti con privilegi minimi/trigger idempotenti. Senza la PR #569 deployata in un ambiente espressamente autorizzato non è possibile il test autenticato della chiave Free da Render. CI mock non conta come test API.
5. **Gate finale indipendente:** test autenticato Groq Free, QA semantica con documenti ufficiali (benchmark provider reale oggi 0/150), E2E Android reali 0/6, rollback verificato e consenso/opt-out. Nessuna attivazione FCM, sync o release implicita.

## Vincoli confermati

Nessuna modifica alla configurazione del servizio, nessuna `GRANT`/`CREATE POLICY`, migrazione, chiave, copia dati, chiamata Groq, merge o deploy effettuata in questa verifica. Non toccare main/produzione o gli staging legacy. La scadenza metadata del PostgreSQL Render legacy (08/11/2026 17:38:42 UTC) non autorizza a cancellare o effettuare upgrade a pagamento.

Coordinamento: [PR staging #565](https://github.com/Nictolas/DemosApp/pull/565), [DEMOS 10 #589](https://github.com/Nictolas/DemosApp/issues/589), [PR GROQ #569](https://github.com/Nictolas/DemosApp/pull/569).
