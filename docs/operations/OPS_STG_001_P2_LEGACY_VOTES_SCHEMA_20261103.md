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

## Aggiornamento compatibilità route e frontend (03/11/2026 — PR #565, NON distribuito)

Verifica del codice di `api/app.js`: le route legacy dei referendum sono effettivamente montate, ma la fonte ufficiale oggi è `iniziative_ministero`. Il vecchio codice di `api/routes/referendum.js` chiedeva `status`, `quorum`, `firestore_id_backup` non presenti nella struttura corrente e disponeva ancora di scritture sulla classifica di priorità (funzione ritirata). Intervento registrato in PR #565:

- `api/routes/referendum.js`: mantenuto **soltanto** il sottorouter attuale `/vote-real` (voto sì/no sui referendum reali), tutti gli altri endpoint legacy restituiscono **HTTP 410** esplicito, senza leggere/scrivere voti o proposte. Non introdotta alcuna modifica al database di produzione.
- `api/routes/referendum-abrogativi.js`: l'endpoint di menu `GET /prossima` conserva l'autenticazione preesistente, ma legge solo la raccolta ufficiale `iniziative_ministero` tramite `buildQueryForTipo('referendum', null, null, false, true)`. Eliminato codice SQL ormai morto su colonne assenti. Risposta resta `{success:true,data}`, con `data:null` quando non ci sono referendum; non espone dettagli SQL in caso di errore.
- `api/utils/selectNextOfficialReferendum.js`: selezione deterministica del referendum con scadenza più vicina; scadenze assenti/sentinel 9999 in fondo, spareggio con firme e ID stabile, senza mutare la lista originaria.
- Frontend pagina `ReferendumAbrogativi`: hook dati limitato ai referendum ufficiali (niente classifica, proposte, cooldown, voti), hook azioni **sola visualizzazione**, eliminate props `mieiVoti` non usate, debug HTTP ridotto; la tabella usa la soglia firme `signature_threshold` restituita dai metadata civici anziché un numero fisso 50.000. Nessuna modifica all'interfaccia del voto reale.
- Tests: aggiunta `api/tests/referendumOfficialRoutes.staging.test.js`, adeguato il test esistente `referendumPriorityRetired.smoke.test.js` per distinguere il vero `/vota-referendum` dalla rotta dismessa `/vota-referendum-abrogativo`. Estesa la workflow **Unified Staging Offline Safety** a questi controlli insieme alle smoke tests di referendum reali e igiene route.

La prima esecuzione CI ampliata ha trovato tre test falliti: uno era un'espressione di test troppo generica che interpretava `res.status(500)` come riferimento alla colonna SQL `status`; gli altri due hanno individuato assunzioni errate sui link del voto reale e logica legacy effettivamente presente nel frontend. **Tutte e tre le cause sono state affrontate nel codice della PR.** Un'esecuzione CI successiva deve ancora confermare la soluzione: NON dichiarare PASS finché i job non sono conclusi.

Lo staging Render rimane bootstrap `/health/ready=503`: **nessun test E2E** e nessun rilascio in produzione. Continuano a mancare provisioning autorizzato dell'account preflight, collegamento a Supabase staging, test end-to-end e dismissione con rollback.
