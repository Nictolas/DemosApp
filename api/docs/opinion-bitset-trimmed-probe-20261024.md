# DEMOS — prima prova PostgreSQL read-only: fixed vs trimmed 2-bit

Data: 24 ottobre 2026. Tutte le misure sono **aggregati SQL in sola lettura**,
senza esporre risposte politiche individuali, fare DDL o modificare dati reali.

## Risultati

824 righe reali di `opinioni_risposte`; 94 colonne `TEXT` di opinioni,
più `user_id` UUID e `fonti_opinioni` JSONB.

| Metrica | Risultato |
|---|---:|
| Opinioni compilate per riga, media | 8,32 |
| Opinioni compilate per riga, mediana | 6 |
| Posizione massima di un'opinione compilata, media | 72,83 / 94 |
| Posizione massima, mediana | 92 / 94 |
| Bitset fisso, soli dati binari | 24 byte/riga |
| Bitset senza byte zero terminali, media grezza | 18,67 byte/riga |
| Bitset senza byte zero terminali, mediana grezza | 23 byte/riga |
| Righe con payload binario trimmed a zero byte | 10 |
| Righe con payload trimmed da 24 byte | 361 |

Il formato trimmed usa sempre gli stessi due bit per stato: `00` = non
risposto, `01` = favorevole, `10` = contrario, `11` = indeciso.
I byte finali con soli `00` vengono omessi; gli slot intermedi senza risposta
restano zero. Questo richiede un catalogo di ID append-only persistito/versionato.

### Proxy di dimensione PostgreSQL tramite record anonimi

Abbiamo simulato con `pg_column_size(ROW(...))` l'ingombro di record
anonimi costruiti sulle righe di produzione senza salvare alcuna replica.
Le tre rappresentazioni includono UUID e `fonti_opinioni`:

| Rappresentazione | Byte medi del record simulato |
|---|---:|
| Attuale: UUID + 94 TEXT + JSONB | 763,07 |
| 2 bit fissi: UUID + BYTEA (24) + JSONB | 757,14 |
| 2 bit trimmed: UUID + BYTEA variabile + JSONB | 750,88 |

Risparmio stimato rispetto al record testuale simulato:
**5,92 byte/riga** per il fixed e **12,18 byte/riga** per il trimmed.
Con il trimmed: 646 righe più piccole, 76 più grandi e 102 uguali in questa
simulazione. Il formato più compatto sul campione NON prova che sia migliore
per nuovi utenti o in query SQL.

**Limite metodologico importante:** un record anonimo non è una nuova
tabella PostgreSQL. I dati sopra NON sono una misurazione di
`pg_total_relation_size` su due schemi reali, né dei loro indici, page
fill factor, compression, TOAST, WAL, VACUUM, costi query o CPU.
Lo stesso record fisico attuale ha `pg_column_size(t)` medio 754,26 byte,
contro i 763,07 byte del record testuale ricostruito: le differenze di
rappresentazione rendono la stima soltanto indicativa.

## Implicazioni di sviluppo

- Non è dimostrato che convenga modificare oggi il database.
- Una mappa ID → indice stabile è necessaria per entrambi i bitset.
- Il vecchio Android deve continuare a ricevere e salvare i valori previsti.
- La scrittura di un BYTEA condiviso richiede atomicità o versione/CAS.
- Il nuovo prototipo `api/utils/opinionTrimmedBitset.js` è solo in memoria:
  `encodeTrimmed`, `decodeTrimmed`, `patchTrimmed` e `readTrimmed`.
- Nessuna modifica a `users.status` è inclusa nel lavoro.

## Prossimo passo

Creare un benchmark riproducibile di schemi reali **su ambiente di prova
non di produzione**, se e solo se esiste una destinazione gratuita
disponibile. Comparare `TEXT`, `BYTEA` fixed, `BYTEA` trimmed e alternativa
sparse, includendo 0, 8, 24 e 94 risposte per persona, per gli
scenari 10mila/100mila/1 milione.

PR: https://github.com/Nictolas/DemosApp/pull/247

## Benchmark fisico su PostgreSQL 17 — GitHub Actions

Workflow: https://github.com/Nictolas/DemosApp/actions/runs/40044654101
Script: `api/scripts/benchmark-opinion-physical.js`.

Il job usa il servizio **PostgreSQL 17 temporaneo di GitHub Actions**, database
`opinion_bitset_ci`, senza credenziali Supabase e senza dati reali. Ogni
rappresentazione e densità contiene 1.200 UUID sintetici e lo stesso numero
di risposte. Vengono misurati `pg_relation_size` (heap),
`pg_indexes_size` (indice PK) e `pg_total_relation_size` (totale,
incluse altre allocazioni/TOAST).

Aggiunta la rappresentazione **binaria sparse/delta**:
`api/utils/opinionSparseBitset.js`. Ogni risposta esplicita salva l'offset
della sua posizione e 2 bit di valore. Se l'offset è nell'intervallo
1..63, basta **un byte** per risposta; un byte escape `0xFC` permette
salti più lunghi e cataloghi append-only più estesi. Non si registrano
le opinioni mai compilate (equivalenti al codice implicito `00`).

### Risparmio netto su testo, byte per account sintetico

**Scenario senza fonti JSONB**, confronto dimensione fisica della tabella
inclusi indice UUID PK e allocazioni accessorie. Un valore **positivo**
indica che la codifica binaria usa meno spazio rispetto al testo.

| Percentuale risposte compilate | 2 bit fisso | 2 bit trimmed | Binario sparse |
|---|---:|---:|---:|
| 0% | -20,48 | +6,83 | +6,83 |
| 5% | -6,83 | +6,83 | +20,48 |
| 9% | 0 | +6,83 | **+20,48** |
| 33% | +47,79 | **+54,61** | +47,79 |
| 100% | **+177,49** | **+177,49** | +116,05 |

**Scenario con fonti JSONB sintetiche**, circa 600 caratteri pseudo-casuali
per riga: al 9% tutte le tre codifiche binarie occupano, nel campione,
lo stesso spazio complessivo del testo, a causa dei salti di allocazione
su pagine PostgreSQL. A densità 33% risparmiano tutte +68,27 byte/riga.
Questi valori NON descrivono le fonti reali né un database di 1 milione
di utenti.

Per il 9% senza fonti, proiezione puramente lineare della differenza di
dimensione **+20,48 MB per un milione di righe** con sparse vs TEXT.
Non è una previsione della quota Free (altre tabelle, indici, WAL,
metadati, workload, RLS e traffico restano fuori).

### Esito e limiti

- **30/30 test del codec PASS** (GitHub Actions, stesso run).
- **Benchmark PostgreSQL fisico PASS** su servizio effimero, non su Supabase.
- Campione sintetico uniforme di 1.200 righe per variante: esistono effetti
  di quantizzazione delle pagine da 8 kB e non sono simulati gli accessi
  reali, i backup, gli UPDATE o i carichi concorrenti.
- Le chiavi JSONB sparse sono intenzionalmente lunghe per evitare un
  confronto ingannevole con nomi `q0` troppo corti.
- Restano da misurare aggiornamenti atomici, query Sondaggi/matching,
  tempi di lettura/scrittura, compressione di fonti, compatibilità Android
  e comportamento su campioni realisticamente distribuiti.
- **Nessuna migrazione, nessun merge e nessuna modifica a Supabase.**

La soluzione finale potrebbe essere un formato adattivo (sparse per
pochi voti, trimmed/fisso per molti), ma aggiungere un selettore di formato
e complessità di querying richiede un benchmark ulteriore. Non introdurlo
in produzione senza prova del beneficio complessivo.


## Benchmark di aggregazione SQL e scritture simultanee (24 ottobre)

Script: api/scripts/benchmark-opinion-queries.js.
Test CI: https://github.com/Nictolas/DemosApp/actions/runs/40045221798.
Usa esclusivamente PostgreSQL 17 effimero su runner GitHub Actions:
1.200 account sintetici, ciascuno con 94 opinioni, circa 9% compilate;
stessi valori per quattro formati, nessuna identità o opinione reale.

**Correttezza:** per 6 posizioni (inizio, fine e intermedie), il conteggio
f/c/i/NULL è IDENTICO nelle rappresentazioni TEXT, fixed, trimmed e sparse.
Lo script confronta ogni conteggio e fallisce la CI in caso di discrepanza.
Questa prova NON include ancora filtri ACCOUNT_TYPE, consenso, segmenti
geografici o regola pubblica di soglia minima 10.

### Tempo di esecuzione server PostgreSQL (ms, mediana 9 EXPLAIN)

| Slot | TEXT | Fixed | Trimmed | Sparse diretto | Sparse MATERIALIZED |
|---:|---:|---:|---:|---:|---:|
| 0 | 0,183 | 0,362 | 0,359 | 4,384 | 1,564 |
| 45 | 0,321 | 0,371 | 0,366 | 11,072 | 3,272 |
| 93 | 0,445 | 0,364 | 0,282 | 16,831 | 4,736 |

La query SPARSE diretta chiama una funzione PL/pgSQL ripetutamente per
gli aggregati. Una CTE MATERIALIZED calcola il decoder una volta per
riga: migliora i tempi, ma la scansione sparse resta più costosa delle
colonne TEXT/fixed/trimmed. Sono tempi su campione piccolo, senza rete
e cache di produzione. Non inferire da questi numeri una SLA, il costo
su un milione di utenti o la prestazione di tutte le query Sondaggi.

### Aggiornamenti simultanei

Il test ha verificato con successo due strategie su BYTEA sparse,
con due salvataggi di opinioni diverse:
- transazioni con SELECT ... FOR UPDATE: la seconda lettura parte dalla
  versione aggiornata e nessun voto viene perso;
- optimistic concurrency CAS con campo revision: il secondo UPDATE con
  revisione vecchia modifica zero righe; la successiva rilettura e
  ripetizione conserva entrambe le opinioni.

Entrambe le verifiche sono PASS su database di prova. Il codice di
produzione e i client Android NON utilizzano ancora questi protocolli:
sarebbe scorretto considerarli integrati e approvati.

### Decisione provvisoria

- Preferire un'analisi congiunta **spazio + CPU + I/O + semplicità**,
  non la codifica più piccola in assoluto.
- La soluzione sparse potrebbe essere economicamente sfavorevole
  per una pagina che calcola molti aggregati, anche se risparmia
  ~20 B/utente nello scenario senza fonti e con densità 9%.
- Confrontare aggregazione SQL precomputata/caching con invalidazione
  corretta, preservando consenso e soglia anti-inferenza, PR #216
  salvataggio delle sole risposte modificate e client legacy.
- Nessun cambiamento a Supabase né merge della PR #247.
