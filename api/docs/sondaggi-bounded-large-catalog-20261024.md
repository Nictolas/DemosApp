# DOC-065 · Cataloghi Sondaggi oltre 256 opinioni senza N+1

Data: 24 ottobre 2026. PR [#258](https://github.com/Nictolas/DemosApp/pull/258), **DRAFT**. Non è un rilascio.

## Problema individuato

L'ottimizzazione iniziale delle 94 opinioni TEXT usava un'unica aggregazione SQL dopo la lettura delle domande e la verifica delle colonne. Per cataloghi con **più di 256 opinioni**, tuttavia, il codice eseguiva il fallback per-ogni-colonna invece di usare l'aggregazione: ciò avrebbe introdotto oltre 600 interrogazioni per un catalogo di 300 opinioni.

## Soluzione

`api/utils/sondaggiTextBulk.js` invia ora blocchi di **massimo 256 colonne** validati per statement `CROSS JOIN LATERAL (VALUES...)`, mantenendo una sola lettura di metadati per richiesta e aggregando in memoria soltanto i conteggi per opinione già pubblicabili.

- Con le **94 opinioni attuali**, il percorso nominale resta invariato: **3 query** per GET (catalogo domande, colonne, aggregazione).
- Con **300 opinioni**, attese **4 query** per GET (catalogo + metadati + **2** aggregazioni) senza query singole per opinione.
- Se una delle aggregazioni successive fallisce, l'operazione fallisce senza restituire statistiche parziali.
- Se l'aggregazione è incompatibile con il database, il fallback legacy può utilizzare al massimo **128 opinioni**. Per cataloghi più grandi l'errore viene propagato, evitando centinaia di tentativi anche con l'SQL non supportato.
- Gli identificatori restano validati e autorizzati solo in base alle colonne presenti nel database; i parametri geografici sono vincolati; si mantiene il criterio PERSON, consenso politico e soglia di almeno 10 risposte.

## Test

`api/tests/sondaggiTextBulk.test.js` verifica quattro ambiti, **600 opinioni sintetiche** (blocchi 256+256+88), l'esclusione delle statistiche sotto soglia, l'assenza di risultati parziali se fallisce la seconda aggregazione e il limite sul fallback per cataloghi 129/257/600.

`api/scripts/verify-sondaggi-large-catalog-pg17.js`, eseguito solo nel PostgreSQL 17 effimero di GitHub Actions, crea un database di prova separato e **300 colonne fisiche TEXT** con risposte sintetiche. Verifica i due blocchi SQL, gli aggregati nei quattro ambiti geografici e la sparizione dei risultati con la revoca effettiva del consenso di un soggetto sintetico (10→9). Nessuna connessione a Supabase o Render.

La prova del database reale è specifica dell'ambiente **PostgreSQL 17 GitHub CI**, non di Demos-Staging e non è una previsione di prestazioni o costi per 1 milione di utenti.

## Limiti

Il costo del calcolo potrebbe crescere con cataloghi e volumi molto maggiori; da questo test non si può inferire capacità o consumo del piano gratuito. Su un errore SQL realmente incompatibile con cataloghi oltre 128 domande l'endpoint fallisce anziché caricare il DB con query di recupero; va risolta la causa anziché forzare la modalità legacy.

**Stato:** OP-37 *In corso*, KPI-20 HTTP end-to-end *Non verificato*. La PR #258 resta in bozza, il servizio Render staging resta `setup-only` senza credenziali e la compressione a due bit (#247) resta separata e sospesa.
