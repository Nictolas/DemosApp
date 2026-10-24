# DEMOS — decisione preliminare sui 2 bit (DOC-054)

**Stato: raccomandazione provvisoria, NON autorizzazione a migrare.**
PR #247 resta in bozza. Nessuna modifica Supabase né deploy.

## Che cosa abbiamo realmente verificato

Il 24 ottobre 2026 è stata letta una baseline aggregata di
`opinioni_risposte`: **824 righe, 94 colonne di risposta,
8,32 risposte per account in media, mediana 6**. Le medie
`pg_column_size` della riga (754,3 B) e di `fonti_opinioni`
(680,8 B) NON sono equivalenti ai byte fisici allocati per account.
Le analisi CI successive riproducono soltanto questi aggregati
su **dati interamente inventati**, con cinque frequenze ipotetiche
di fonti (0%, 10%, 35%, 75%, 100%).

La prova `api/scripts/benchmark-opinion-mixed-sources.js` misura
la dimensione delle **tabelle PostgreSQL 17 sintetiche** includendo
heap, indici, TOAST e allocazione delle relazioni per 824 account.
Il nuovo `api/scripts/evaluate-opinion-two-bit-decision.js`
ripete `pg_total_relation_size` sulle trenta tabelle già
create e quantifica l'allocazione condivisa della tabella dei
cataloghi. È obbligatoriamente eseguito in CI con host e
password sintetici; non accede a Supabase.

### Scenario esemplificativo: fonti nel 35% delle righe

| Rappresentazione | Totale fisico per 824 righe | Media per riga | Differenza dal TEXT |
| --- | ---: | ---: | ---: |
| 94 colonne TEXT f/c/i/NULL | 385.024 B | 467,26 B | baseline |
| BYTEA sparse con `catalog_version` | 368.640 B | 447,38 B | −4,26% |
| BYTEA sparse con versione, fingerprint e encoding per riga | 425.984 B | 516,97 B | +10,64% |

Se la versione richiede **anche** una tabella condivisa di
catalogo, nel modello CI questa tabella occupa **32.768 B**.
Il risparmio della tabella versionata alle **824 righe**
è soltanto 16.384 B, cioè **inferiore** alla tabella dei cataloghi
di 32.768 B. Il saldo di queste due componenti è pertanto
**16.384 B in più** delle sole colonne TEXT, prima degli ulteriori
costi applicativi.

La somma non include tutte le tabelle DEMOS e non rappresenta
un benchmark di produzione. La posizione e la quantità effettiva
delle fonti, gli indici reali, la distribuzione dei NULL, il
costo RLS, i log/WAL, le cache e l'Android legacy possono cambiare
i risultati.

### Sensibilità teorica a numero di account più elevato

Il nuovo script calcola anche scenari nominali per 824, 10.000,
100.000 e 1.000.000 di account, **estrapolando linearmente**
la differenza di byte/riga della tabella a 824 righe e sommando
una sola tabella di catalogo. Questa è un'**esercitazione aritmetica**,
non una previsione dei costi di Supabase o della capienza del
piano Free: PostgreSQL alloca a pagine, mutano indici,
TOAST, WAL, retention, carico e dimensioni di altre tabelle.

## Raccomandazione provvisoria

**NON migrare ancora.** I risultati di laboratorio mostrano che
i risparmi possono essere piccoli o negativi quando si considerano
i metadati, mentre i test DOC-047–053 hanno confermato rischi
operativi e privacy significativi da gestire prima del passaggio.
Questo non esclude la codifica binaria per sempre, ma non
autorizza una conversione del database.

La via immediata a basso rischio è continuare a ottimizzare
il percorso **TEXT** già utilizzato (aggregazione delle query
Sondaggi anziché N+1, query selettive, monitoraggio read-only)
senza introdurre una migrazione del formato.

Per riaprire la decisione sui 2 bit servono: una baseline fisica
read-only **completa** dell'app reale, un confronto riproducibile
su staging con fonti e metadati rappresentativi, test end-to-end
delle API e del consenso/RLS, recupero da backup senza resurrezione
di dati cancellati, interoperabilità con Android legacy,
monitoraggio/rollback, analisi dei costi e una soglia di
vantaggio concordata prima di qualsiasi rilascio.

**Tracciamento:** OP-41 *In corso*, OP-42 *Da fare*,
KPI-23 *Non verificato*. Non dichiarare un GO per la migrazione
sulla sola base di misure sintetiche.

**CI DOC-054:** evidenza del nuovo script e risultati
da aggiornare solo dopo il superamento effettivo della pipeline.
