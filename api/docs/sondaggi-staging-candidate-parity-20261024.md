# DOC-069 — Parità del candidato SQL su Supabase Demos-Staging

**Data:** 24 ottobre 2026. **PR:** [#258](https://github.com/Nictolas/DemosApp/pull/258), ancora in bozza.

## Contesto e isolamento

Il database **Demos-Staging** (Supabase, PostgreSQL 17.11) ospita uno schema privato `op37_sondaggi_ci`, già creato per DOC-058, con **1.200 account e 1.200 righe di opinioni interamente sintetici**. Il catalogo contiene **94 opinioni**, di cui **93 pubblicate**. Lo schema `public` del progetto staging è rimasto senza relazioni; il ruolo `op37_http_staging_reader` è ancora **NOLOGIN**. Nessun database di produzione è stato interrogato.

La verifica SQL nazionale, eseguita tramite l'accesso amministrativo già autorizzato a **Demos-Staging** e senza copiare password in Render, ha confrontato:

1. **Baseline:** aggregazione `CROSS JOIN LATERAL (VALUES)` degli stati `f/c/i` per opinione e soggetto ammesso;
2. **Candidato opt-in:** `COUNT(*) FILTER` per colonna delle stesse risposte, seguito da trasformazione finale per opinione.

Entrambi applicano le condizioni `account_type='PERSON'` e consenso politico effettivo `COALESCE(user_consents.political_opinions_consent, users.political_opinions_consent, false) IS TRUE`; il confronto considera le stesse 93 opinioni pubblicate e gli stessi dati sintetici. La corrispondenza è stata verificata tramite FULL JOIN degli aggregati per `opinion_id`, controllo esplicito dei conteggi `f/c/i` e conteggio delle statistiche ammissibili con `f+c+i>=10`.

**Risultato nazionale Demos-Staging:** 93 righe baseline, 93 righe candidato; **0 differenze** nei conteggi; **93 statistiche ammissibili** per ciascuna strategia. Questa è una prova di **parità funzionale sul database di staging reale**, non di maggior velocità.

## Prestazioni: stato effettivamente misurato

È stata predisposta una prova alternata `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` dei quattro ambiti geografici, ma **l'esecuzione dei confronti ripetuti sul database remoto è stata fermata da un controllo di sicurezza**. Nessun set completo e affidabile di p50/p95 Demos-Staging è stato prodotto. **Non attribuire alle query candidate un miglioramento percentuale su Supabase-Staging.**

Restano valide le prove di laboratorio precedenti:
- su **GitHub Actions PostgreSQL 17 effimero**, 1.000/10.000/50.000 account inventati, quattro ambiti, risultati identici;
- candidato più lento per 1.000 account e più veloce per 10.000/50.000 nelle esecuzioni CI; non derivarne una soglia automatica, un SLA, capacità di un milione di utenti o risparmi monetari sui piani gratuiti.

## Decisione e prossimi passi

La query candidata è disponibile nel ramo della PR #258 **solo con flag esplicito `SONDAGGI_EXPERIMENTAL_DIRECT_FILTER=true`**. Il flag **rimane non impostato** nella configurazione corrente; la query standard non è stata sostituita. Nessuna modifica al database Supabase di produzione, a Render, al formato dati, alla compressione 2-bit o alla release Android.

Per procedere con misure HTTP end-to-end e A/B reale servono comunque collegamento Render→Supabase Demos-Staging e credenziali temporanee, via pannelli dei provider con percorso autorizzato; attualmente Render è `setup-only` e il ruolo dedicato è `NOLOGIN`.

**Tracking:** OP-37 in corso; KPI-19 (query) validato nei test CI; KPI-20 (latency HTTP) *da misurare*. La presente verifica non conclude OP-36/39.
