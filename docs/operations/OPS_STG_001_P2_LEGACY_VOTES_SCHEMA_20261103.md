# DEMOS — OPS-STG-001: migrazione P2 per opinioni, referendum e voti parlamentari (03/11/2026)

## Intervento completato

**Solo** sul progetto Supabase `Demos-Staging` (`fkeayjzvtuvzesljhjbc`) è stata applicata la migrazione additiva `ops_stg_001_p2_opinion_referendum_parliament_20261103`. SQL versionato in PR #565: `api/database/staging/ops_stg_001_p2_opinion_referendum_parliament_20261103.sql`.

Quattro tabelle **vuote**, richieste da route del backend esistenti:
- `opinioni_domande`: compatibilità catalogo opinioni legacy; il catalogo principale DEMOS rimane in codice, non è stato copiato alcun testo/scheda da produzione.
- `voti_referendum_abrogativi`: associazioni utente/referendum.
- `voti_camera`: voti parlamentari e riquadro `bacheca`.
- `notifiche_voti_parlamento`: notifiche relative ai voti dei rappresentanti.

Una sequenza `voti_camera_id_seq` è stata creata e legata alla relativa PK, senza importare valori di produzione. La migrazione è atomica (`BEGIN/COMMIT`), limita l'applicabilità all'identità di `Demos-Staging`, rifiuta oggetti già presenti ed è priva di `INSERT`/`UPDATE`/`DELETE` dati, `DROP` o `TRUNCATE`.

## Readback verificato dopo la scrittura

- **31/31** colonne, **14/14** vincoli, **23/23** indici identici alle definizioni recuperate dalla produzione.
- **4/4** nuove tabelle con RLS e senza privilegi diretti SELECT/INSERT/UPDATE/DELETE per `anon` e `authenticated`.
- **4/4** conteggi riga = **0**; nessun utente, voto o notifica di produzione importato.
- Sequenza `voti_camera_id_seq` correttamente associata e non utilizzabile dai ruoli `anon` e `authenticated`.
- Audit generale: **42/42** tabelle `public` con RLS abilitata e senza privilegi diretti a `anon`/`authenticated`; `civic_push_delivery_guard.blocked=true`; identità staging esatta.
- Staging da 38 a **42** tabelle pubbliche. Produzione 115; **76** nomi presenti in produzione non sono presenti nello staging, ma non vanno creati automaticamente.
- Preflight read-only aggiornato per esigere **26 tabelle** e per ricontrollare esplicitamente le nuove quattro come tabelle riservate. Il bootstrap è ancora un NO-GO per i test applicativi.
- Sul commit di test `8e649ad6`, workflow **Unified Staging Offline Safety** GitHub completato con successo (e altri due workflow completati con successo); un workflow catalogo/frontend era ancora in esecuzione alla verifica. Snyk `success`. **Non dichiarare test E2E**: soltanto test CI offline e readback schema.

## Gap funzionale distinto individuato nei sorgenti legacy

Le route `api/routes/referendum.js` e `api/routes/referendum-abrogativi.js` leggono/scrivono colonne `status`, `quorum` e `firestore_id_backup` nella tabella `referendum_abrogativi`, mentre tali colonne non risultano nello schema di staging (allineato in questo punto a produzione). Non trattare automaticamente ogni SQL legacy come un contratto aggiornato dell'app: verificare se tali route sono effettivamente montate e usate, poi correggere in modo compatibile i percorsi interessati prima di dichiarare PASS gli E2E di referendum. **Non** introdurre colonne arbitrarie solo per far passare un test.

Le quattro nuove tabelle sono intenzionalmente vuote: i test di flusso devono usare fixture e cataloghi di test sintetici, non la copia dei voti reali. Le 94 opinioni stabili restano catalogate in codice.

## Gate residui

1. Credenziale PostgreSQL di preflight separata e realmente limitata, attualmente non disponibile; provisioning precedentemente bloccato e non aggirato, più verifica delle dipendenze legacy.
2. Chiudere soltanto i gap di schema/route necessari alle E2E attive; controllare particolarmente referendum e catalogo opinioni legacy.
3. Connessione applicativa a `Demos-Staging` con test multiutente, identità DB e privilegi, TLS e nessun invio FCM/email/cron esterno.
4. Parità dei test, rollback e poi dismissione graduale dei nove vecchi servizi Render staging e verifica Key Value/PG in scadenza.

**Nessun nuovo servizio, nessun upgrade o costo, produzione invariata.**
