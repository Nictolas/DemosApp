# DEMOS — Collaudo di recupero B2 isolato (22 ottobre 2026)

**Stato:** infrastruttura preparata, primo deploy Render Free **LIVE IN STANDBY**; nessuna verifica su oggetti B2 reali ancora eseguita. Non confondere il processo archiviatore già attivo su `main` con questo servizio di sola lettura.

## Ambiente dedicato e verificato

- Workspace Render: `Nicolas` (`tea-d2gs3eadbo4c73ag95rg`).
- Servizio: `demos-b2-readonly-restore-staging` (`srv-dbct3vmq1p3s73d7rhg0`).
- URL pubblico (solo `GET /healthz`): https://demos-b2-readonly-restore-staging.onrender.com
- Deploy iniziale: `dep-dbct40eq1p3s73d7rj2g`, commit `6341383154a9834a21f70f4ed0f4d39f1731a5d1`, **live**.
- Piano `Free` di Render, regione Frankfurt, ramo `fix/audit-outbox-20261021`, `autoDeploy=no`.
- Build: `cd api && npm ci --ignore-scripts`.
- Start: `cd api && npm run archive:axiom:readonly-health`.
- Log startup verificato: `B2_READONLY_RESTORE_STANDBY_NO_SECRET`. Questo è un **NO-GO di restore**, non un fallimento di connessione.
- Nessun segreto B2 configurato. Nessun `DATABASE_URL`, `AUDIT_OUTBOX_DATABASE_URL`, token Axiom o Firebase. Job Axiom produttivo invariato.

## Credenziale da configurare tramite i pannelli autorizzati

Nel pannello Backblaze **B2 Cloud Storage → Application Keys → Add a New Application Key**:

1. Nome suggerito: `demos-b2-restore-readonly-20261022`.
2. Accesso **solo** al bucket `demos-log-archive-eu`.
3. Permessi **Read Only** (nessuna scrittura o cancellazione); se necessario per la compatibilità S3, abilitare `List all bucket names` solo se il provider lo richiede. Il nostro client fa solo `HEAD Object` e `GET Object`, non `List Buckets`.
4. Prefix opzionale consigliato: `demos/axiom-archive/v1/` (checkpoint, manifest e file sono tutti sotto tale prefisso).
5. Durata breve / scadenza temporanea, ad esempio **24 ore**, se supportata.
6. Conservare in un gestore di segreti i valori **Key ID** e **Application Key**. La Application Key si può vedere solo quando viene generata: non inviarla in chat, documenti o ticket.

Aggiungere **esclusivamente** queste due variabili segrete nel servizio Render dedicato, sezione `Environment`:

- `B2_S3_ACCESS_KEY_ID` = **Key ID**.
- `B2_S3_SECRET_ACCESS_KEY` = **Application Key**.

Le variabili non segrete sono già configurate:
`B2_RESTORE_READONLY_MODE=true`,
`AXIOM_ARCHIVE_ENABLED=false`,
`B2_BUCKET_NAME=demos-log-archive-eu`,
`B2_S3_REGION=eu-central-003`,
`B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com`.
Non aggiungere credenziali del database, API Axiom o worker/archiviatore.

**Dopo il salvataggio dei segreti**, avviare un solo deploy manuale del servizio isolato. Il codice prima verifica checkpoint e manifest di `centralized_logs` e `real-time`, poi legge i soli oggetti del batch più recente. Ogni GET è limitato sotto 8 MiB, l'espansione gzip a 32 MiB e la verifica a 60.000 eventi per oggetto; confronta hash SHA-256, fingerprint, categorie, conteggi e dataset. Il wrapper SDK nega ogni comando diverso da `HEAD`/`GET` e qualsiasi bucket o prefisso differente.

## Criteri di risultato

- `B2_READONLY_RESTORE_STANDBY_NO_SECRET`, `GET /healthz` → 503: attesa delle credenziali, **non verificato**.
- `B2_READONLY_RESTORE_VERIFIED`, `GET /healthz` → 200: verifica autenticata di entrambi gli ultimi batch **PASS**, con sola lettura.
- `B2_READONLY_RESTORE_REJECTED`: **NO-GO**, non esporre errori del provider o segreti.

La presenza del log `Axiom archive completed` sul backend principale **non certifica** il restore B2.

## Evidenze

- Workflow GitHub `Logging and archive regression`: nuovo servizio verificato da test di startup, standby senza segreti, rifiuto configurazioni pericolose, e verifica sintetica; test del wrapper B2 sono separati.
- Riferimenti sorgente: `api/scripts/b2-restore-readonly-health-server.js`, `api/scripts/verify-b2-restore-readonly.js`, `api/services/axiomArchiveService.js`.
- Dopo il test reale, annotare solo timestamp, `PASS/FAIL`, conteggi aggregati e dataset. Non memorizzare contenuti dei log archiviati, chiavi oggetto, link firmati, password o token.

La PR #218 rimane **draft** e `main` invariato. Il criterio di rilascio GDPR/FCM/Axiom resta indipendente da questa sola verifica.
