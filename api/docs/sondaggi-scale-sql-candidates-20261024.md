# DOC-067 — Misura della crescita delle query Sondaggi TEXT e confronto SQL

**Data:** 24 ottobre 2026. **Stato:** PR [#258](https://github.com/Nictolas/DemosApp/pull/258) ancora DRAFT, nessun merge, deploy di produzione o connessione a dati reali.

## Perché

I test DOC-055–066 hanno confermato il vantaggio dell'aggregazione TEXT e protetto la coerenza fra più gruppi. Non avevano però ancora misurato l'aumento del tempo SQL con un numero maggiore di account. Il nuovo script
`api/scripts/benchmark-sondaggi-text-scale-ci.js` crea un **terzo database PostgreSQL 17 effimero nel runner GitHub Actions**, autonomo, con account e opinioni interamente inventati. Si interrompe se non rileva le variabili e le credenziali esatte dell'ambiente CI. Non tocca Supabase, Render, database o account reali.

La fixture contiene 94 colonne TEXT, circa 1/12 risposte presenti, mix sintetico PERSON/organizzazioni, consenso, revoche sintetiche e territori. I livelli cumulativi sono 1.000, 10.000 e 50.000 account.

## Esecuzione verificata

Workflow [40123432219](https://github.com/Nictolas/DemosApp/actions/runs/40123432219), marker `SONDAGGI_TEXT_SCALE_CI_PASS`, **SUCCESS**.

Nella sua singola esecuzione, il percorso nominale ha usato **3 query totali per GET** nei quattro ambiti: catalogo, whitelist delle colonne, aggregazione. Ogni riga rappresenta 7 misure sequenziali **dopo un warm-up**; mediana e p95 sono campioni descrittivi e non un SLA statisticamente robusto.

| Account sintetici | Nazionale p50/p95 | Regionale p50/p95 | Provinciale p50/p95 | Comunale p50/p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1.000 | 12,436 / 14,164 ms | 7,725 / 9,351 ms | 7,851 / 8,974 ms | 8,152 / 8,690 ms |
| 10.000 | 55,142 / 57,520 ms | 20,996 / 22,096 ms | 21,158 / 21,456 ms | 21,456 / 21,962 ms |
| 50.000 | 206,139 / 229,661 ms | 83,690 / 84,983 ms | 84,625 / 87,092 ms | 84,438 / 85,852 ms |

La tabella `opinioni_risposte` sintetica occupa rispettivamente 163.840, 1.138.688, 5.455.872 byte, inclusi heap e indici secondo `pg_total_relation_size`. Non è la dimensione del database DEMOS reale, né include utenti, log, WAL e altre relazioni.

**Ripetibilità e variabilità:** il precedente workflow [40123215737](https://github.com/Nictolas/DemosApp/actions/runs/40123215737), sulla medesima progettazione della fixture, aveva p50 nazionale di 8,812 / 41,189 / 159,540 ms. Le differenze fra esecuzioni CI evidenziano la variabilità dei runner e dell'ambiente: non vanno presentati i valori come misure riproducibili di latenza di produzione.

## Candidato SQL per ridurre i calcoli intermedi

Nel nuovo script è inclusa **solo per benchmarking** una variante che applica i 3 `COUNT(*) FILTER` direttamente a ogni colonna dopo il join/consenso, *prima* di creare le righe `opinion_id` per il risultato. Questo evita l'espansione di ogni risposta soggetto×opinione del `CROSS JOIN LATERAL (VALUES...)` attuale.

Con gli stessi 50.000 account, **all'interno della medesima esecuzione** e in sette iterazioni alternate:

| SQL | Media | Mediana | p95 |
| --- | ---: | ---: | ---: |
| Aggregazione attuale (righe per risposta) | 203,754 ms | 203,894 ms | 205,613 ms |
| Alternativa `COUNT FILTER` per colonna | 123,267 ms | 122,613 ms | 126,242 ms |

**Mediana candidata / attuale: 0,601×**, ossia circa **39,9% meno tempo** nella prova nazionale. Le righe aggregate (`f/c/i`) e l'eleggibilità PERSON/consenso sono risultate identiche nella fixture e ogni iterazione è stata verificata per uguaglianza. Questo risultato **non è sufficiente per distribuire la variante**.

## Attività successive prima di scegliere il nuovo SQL

1. Verificare il candidato sulle quattro aree geografiche, con parametrizzazione e stessa soglia di 10.
2. Ripetere le regressioni sulle transazioni `REPEATABLE READ READ ONLY` con cataloghi oltre 256 opinioni e revoche durante la richiesta.
3. Misurare anche il candidato a 1.000 e 10.000 account, con più repliche, distribuzioni realistiche, `EXPLAIN (ANALYZE, BUFFERS)`, e valutare CPU/heap/pianificatore.
4. Solo dopo i test completi considerare l'eventuale sostituzione del SQL nella PR #258 e una nuova verifica su PostgreSQL **Demos-Staging**.
5. Misurare l'HTTP reale Render↔Supabase staging quando siano disponibili le credenziali temporanee tramite percorso autorizzato. Il servizio resta setup-only e il ruolo Supabase dedicato `NOLOGIN`.

**Stato:** OP-37 in corso; KPI-19 numero query verificato in CI; KPI-20 end-to-end non verificato. Non inferire capacità di un milione di account o risparmio economico del piano Free dalle misure locali.
