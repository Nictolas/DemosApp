# DEMOS 10 — Correzione upsert Ministero, solo staging (05/11/2026)

## Blocco verificato

Verifica diretta e **in sola lettura** del progetto Supabase `Demos-Staging`
(`fkeayjzvtuvzesljhjbc`, fingerprint database noto
`0cbb6ace68a9f11956904e2a37898ec8`).

La tabella `public.iniziative_ministero` ha il solo indice
`iniziative_ministero_pkey` su `id`. La colonna
`id_ministero` esiste ma **non** è soggetta a UNIQUE.
Il metodo `api/services/ministeroSync.js.saveIniziativa` provava
invece `ON CONFLICT (id_ministero)` quando la fonte conteneva
l'identificativo, producendo PostgreSQL `42P10` per ogni INSERT.

La correzione usa `ON CONFLICT (id)`, ancorato all'identificativo
stabile già previsto `ministero_${id_ministero}`, ed elimina la
generazione casuale di id quando il portale non restituisce
l'identificativo ufficiale. Una riga senza ID viene ora rifiutata prima
di qualunque query. Non è necessaria alcuna concessione di permessi
ulteriore, né creazione di indici sullo staging.

## Stato fonte e sicurezza

Fonte pubblica Ministero: prova del 05/11/2026 HTTP 200,
87 record (`infoPaginazione.elementCount=87`), mappati nel
catalogo come 80 leggi di iniziativa popolare e 7 richieste di
referendum; 47 nello stato «IN RACCOLTA FIRME».
La correzione del conteggio autorevole del Ministero è già nel
ramo staging via PR #599.

Prima della presente PR, la cache di Ministero era ancora
**vuota** (`iniziative_ministero=0`); la cache europea contiene
**12 ECI** e **12 eventi storici soppressi**, 0 eventi azionabili,
0 dispositivi, `delivery_guard.blocked=true`.

La correzione upsert è in una PR separata, con test offline di
inserimento, identificatore stabile, referendum e rifiuto degli
ID mancanti. Non avvia HTTP, Firebase, cron o database.

## Gate per import dei record sullo staging

Non eseguire `syncAll()` direttamente sul servizio condiviso:
importa dipendenze del backend completo e non ha ancora un gate
di transazione complessiva. Il primo import ministeriale deve:

- leggere e verificare nuovamente il dataset completo dalla fonte ufficiale;
- validare tutti gli ID, tipologie, stati, date e deduplica prima di scrivere;
- confrontare fingerprint DB, guardia push bloccata, baseline e devices;
- inserire la cache **solo** con transazione unica e
  identificatori deterministici, evitando `dati_raw` se non necessari;
- registrare eventi storici eligibili come `suppressed`, non `pending`;
- verificare conteggi e idempotenza dopo il commit, senza FCM.

**Non è ancora un GO per cron, segreti, FCM, Render, produzione
o Google Play**. Questo intervento non cambia database, configurazione,
schedulazioni o installazioni Android. Issue #589 e Android E2E 0/6
restano aperti.
