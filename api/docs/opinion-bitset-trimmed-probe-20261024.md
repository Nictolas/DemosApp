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
