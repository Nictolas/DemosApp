# DEMOS — Piano di capacità e scenari di utilizzo

**Versione:** 2026-10-12
**Task:** F12-05  
**Modello riproducibile:** `api/scripts/capacityEstimate.js`

## 1. Regola fondamentale

Non esiste un solo numero corretto di “utenti massimi”. DEMOS ha almeno quattro grandezze diverse:

1. **utenti registrati**, che incidono soprattutto su storage e indici;
2. **DAU (utenti attivi giornalieri)**, che incidono su richieste e traffico;
3. **concorrenza/RPS di picco**, che incide su CPU, memoria e connessioni database;
4. **caricamenti frontend**, che incidono sulla CDN/trasferimento statico.

Questo documento stima **domanda e sensibilità**. Non sostituisce F12-31 (load/stress test), quindi non dichiara un RPS massimo o un numero di utenti simultanei non misurato.

## 2. Baseline misurate o osservate

### Frontend

Build Vite corrente misurata localmente:

- dimensione totale `client/dist`: **2,797,508 byte** (~2.67 MiB);
- JavaScript: **2,525,908 byte**;
- CSS: **234,346 byte**;
- trasferimento stimato del primo caricamento completo con gzip sui file comprimibili: **681,169 byte** (~665 KiB);
- asset JS principale non compresso: **2,380,169 byte**.

Il valore da **681,169 byte** è usato nel modello come caricamento shell “uncached”. È deliberatamente conservativo per visite ripetute, perché browser/CDN possono riutilizzare asset cacheati.

### Backend Render corrente

Ispezione read-only della configurazione effettiva:

- servizio: `demos-backend`;
- piano corrente: **Free**;
- regione: **Frankfurt**;
- istanze: **1**;
- limite memoria osservato dal provider: circa **512 MiB**;
- memoria osservata nei campioni disponibili: circa **85–97 MB**, quindi ~**16–18%** del limite;
- metrica CPU d'uso: dati insufficienti nel periodo interrogato;
- nessuna metrica HTTP recente sufficiente per ricavare RPS sostenibili o p95 affidabile.

**Conclusione:** la memoria, nei campioni disponibili, non appare il collo di bottiglia immediato. Non è però possibile dedurre la capacità backend da questo dato: senza CPU/RPS/latency sotto carico, la capacità di concorrenza resta **non qualificata**.

### Quota Render osservata nell'account

Nel pannello billing osservato l'11/10/2026:

- bandwidth incluso: **5 GB**;
- free instance hours: **750 h/mese**.

Questi sono limiti/quota del workspace osservato, **non** la capacità intrinseca del software. Il modello usa un budget operativo del **70%**, cioè 3.5 GB/mese, per non pianificare al 100% della quota.

### Database e frontend provider

Il tier/limite effettivo del database di produzione non è stato verificato tramite un connettore provider in questo checkpoint. Analogamente, il progetto DEMOS non è visibile nel team Vercel collegato a questa sessione.

Per questo il modello include soltanto due valori **di riferimento/sensibilità**, da riverificare prima di decisioni economiche o di go-live:

- **1 GB** di storage DB come scenario di riferimento;
- **100 GB/mese** di trasferimento frontend come scenario di riferimento.

Non sono dichiarati come limiti contrattuali correnti dell'account DEMOS.

## 3. Assunzioni di pianificazione

Le seguenti sono assunzioni esplicite, modificabili nello script:

| Assunzione | Valore | Significato |
|---|---:|---|
| Storage logico per utente registrato | 50 KB | Media modellata comprendente riga account, relazioni/indici e attività leggera; **non misurata** sul DB produzione |
| Traffico API per DAU/giorno | 3 MB | Scenario “tipico” di utilizzo API; **non misurato** in produzione |
| Primo caricamento frontend completo | 681,169 B | **Misurato** dalla build corrente |
| Caricamenti frontend completi/DAU/giorno | 1 | Assunzione conservativa per modellare la CDN |
| Giorni attivi/mese | 30 | Convenzione del modello |
| Budget storage/trasferimento | 70% | 30% di headroom operativo |

L'assunzione di **50 KB/utente** non implica che ogni utente consumerà sempre 50 KB: notifiche, attività, preferenze, eventi e crescita degli indici possono aumentare il footprint. Per questo è inclusa una sensibilità 20/50/200 KB.

## 4. Scenari di domanda

Tutti gli scenari assumono DAU pari al 20% degli utenti registrati soltanto per rendere confrontabili le grandezze. Non è una previsione di adozione.

| Scenario | Registrati | DAU | DB stimato @50 KB | API/mese @3 MB/DAU/giorno | Frontend/mese @1 full load/DAU/giorno | Totale modellato* |
|---|---:|---:|---:|---:|---:|---:|
| Closed beta | 100 | 20 | 0.005 GB | 1.8 GB | 0.41 GB | 2.21 GB |
| Pilot | 1,000 | 200 | 0.05 GB | 18 GB | 4.09 GB | 22.09 GB |
| Beta regionale | 10,000 | 2,000 | 0.5 GB | 180 GB | 40.87 GB | 220.87 GB |
| Scala nazionale | 100,000 | 20,000 | 5 GB | 1,800 GB | 408.70 GB | 2,208.70 GB |

\* Il “totale modellato” somma due canali che nella realtà possono essere fatturati da provider diversi. Serve a capire l'ordine di grandezza, non è una singola fattura.

## 5. Lettura degli scenari

### Closed beta — 100 registrati / 20 DAU

- Storage trascurabile nel modello: ~5 MB.
- API ~1.8 GB/mese.
- Con budget Render del 70% (3.5 GB su quota osservata di 5 GB), lo scenario rientra **solo sul traffico API modellato**.
- Non significa che il piano backend Free sia automaticamente adatto a una beta pubblica: disponibilità, cold start e capacità di picco vanno qualificati separatamente.

### Pilot — 1,000 registrati / 200 DAU

- Storage ~50 MB.
- API ~18 GB/mese.
- Supera ampiamente la quota Render di 5 GB osservata se tutto il traffico API è conteggiato nello stesso pool.
- Con queste assunzioni il **traffico**, non lo storage, richiede già un piano/provider con margine maggiore.
- La capacità CPU/RPS non è ancora dimostrata: prima di chiamarlo “supportato” serve F12-31.

### Beta regionale — 10,000 registrati / 2,000 DAU

- Storage ~0.5 GB a 50 KB/utente.
- API ~180 GB/mese.
- Frontend ~40.9 GB/mese nel caso conservativo di un full load per DAU/giorno.
- Un DB con solo 1 GB nominale inizierebbe ad avere poco margine se il footprint reale si avvicina o supera 50 KB/utente.
- Backend, database e traffico richiedono un dimensionamento esplicito e load test.

### Scala nazionale — 100,000 registrati / 20,000 DAU

- Storage ~5 GB a 50 KB/utente.
- API ~1.8 TB/mese.
- Frontend ~409 GB/mese nello scenario conservativo.
- Questo scenario è chiaramente fuori dalla logica di un singolo backend Free/singola istanza e richiede capacità pagata, osservabilità e scalabilità qualificate.

## 6. Sensibilità storage

Con **1 GB di storage di riferimento** e budget massimo del 70% (700 MB utilizzabili per pianificazione):

| Footprint medio modellato | Registrati prima del 70% |
|---:|---:|
| 20 KB/utente | 35,000 |
| 50 KB/utente | 14,000 |
| 200 KB/utente | 3,500 |

Questa tabella mostra perché “GB ÷ utenti” senza misurare il footprint reale può sbagliare di un ordine di grandezza.

### Misura da aggiungere dopo il lancio

Almeno settimanalmente durante pilot/beta:

- dimensione DB totale;
- dimensione tabelle/index principali;
- numero account registrati;
- rapporto `DB bytes / registered users`;
- crescita giornaliera assoluta e per DAU.

Dopo almeno alcune settimane di dati reali, sostituire 50 KB con p50/p90 osservati o con una stima derivata dalla crescita reale.

## 7. Sensibilità traffico

### Frontend statico

Con **100 GB/mese di riferimento**, 70% di budget e shell misurata a 681,169 byte:

- circa **102,764 caricamenti completi non cacheati/mese**.

Senza il margine del 30% sarebbero circa 146,800. Il dato reale può essere molto migliore grazie alla cache, ma può anche peggiorare per immagini, aggiornamenti frequenti del bundle o asset aggiuntivi.

### Backend/API sul quota Render osservato

Con quota osservata **5 GB/mese**, budget 70% = 3.5 GB, e assunzione **3 MB/DAU/giorno**:

- circa **38 DAU** come bound di traffico modellato.

Questo **non** significa “Render supporta 38 utenti”: significa soltanto che, con quella specifica ipotesi di traffico, 38 DAU × 3 MB × 30 giorni consumano circa il budget mensile scelto. Un DAU che usa 0.5 MB/giorno o 20 MB/giorno produce risultati radicalmente diversi.

## 8. Backend: ciò che sappiamo e ciò che non sappiamo

### Sappiamo

- una sola istanza backend;
- ~512 MiB di limite memoria osservato;
- processo in idle/traffico minimo intorno a 85–97 MB nei campioni disponibili;
- pool PostgreSQL configurabile; il valore massimo di pool **non** equivale a utenti concorrenti;
- rate limiter differenziati; i limiti anti-abuso **non** equivalgono a capacità RPS.

### Non sappiamo ancora

- RPS sostenibile a p95/p99 accettabile;
- saturazione CPU sotto mix realistico di endpoint;
- connessioni PostgreSQL effettive sotto picco;
- memoria sotto carico prolungato;
- costo di endpoint pesanti, ranking/statistiche e sincronizzazioni in concorrenza;
- comportamento durante picchi da notifiche/eventi mediatici.

Perciò **non viene dichiarato un numero di utenti simultanei supportati** prima di F12-31.

## 9. Gate proposto per trasformare una stima in capacità qualificata

F12-31 dovrà eseguire almeno tre profili di carico su ambiente isolato/staging:

1. **read-heavy:** profilo, Eventi, Opinioni/Preferiti e feed;
2. **mixed:** letture + salvataggio Opinioni/preferenze + selezioni;
3. **burst:** picco breve 5–10× rispetto al traffico medio atteso.

Per ogni profilo registrare:

- RPS completati;
- p50/p95/p99;
- error rate;
- CPU e memoria;
- connessioni DB attive;
- query lente/timeouts;
- banda trasferita.

Solo dopo questi test si può scrivere una frase del tipo “questa configurazione supporta X RPS / Y utenti concorrenti con p95 < Z”. Fino ad allora ogni cifra di concorrenza è una previsione, non un risultato.

### Harness F12-31 disponibile localmente

Il runner `api/scripts/loadTestF1231.js` prepara i tre profili senza dipendenze esterne:

- `read-heavy`: `/api/auth/me`, `/api/eventi`, `/api/opinioni`, `/api/opinioni/profile`;
- `mixed`: le stesse letture più una scrittura idempotente sul percorso canonico `political-selection` del solo utente di carico;
- `burst`: stesso mix read-only con concorrenza moltiplicata.

Esempio locale, con numero richieste limitato:

```bash
DEMOS_LOAD_TOKEN=<token-test> node api/scripts/loadTestF1231.js --profile=read-heavy --requests=100 --concurrency=4
```

Contro staging remoto il runner è **fail-closed**: richiede `NODE_ENV=staging`, `DEMOS_LOAD_ALLOW_REMOTE=true` e un host che contenga `staging` oppure coincida con `DEMOS_LOAD_ALLOWED_HOST`. Il profilo `mixed` richiede inoltre `DEMOS_LOAD_ALLOW_MUTATIONS=true` e `DEMOS_LOAD_USER_ID`, così una prova non può scrivere accidentalmente su un account ordinario. Sopra 50 richieste concorrenti serve un secondo opt-in esplicito.

Il runner misura RPS completati, p50/p95/p99, error rate, stato HTTP, byte ricevuti e breakdown per endpoint.

Dal 12/10/2026 è disponibile anche `api/scripts/stagingLoadSelfTest.js`, collegato al flag `DEMOS_STAGING_LOAD_E2E=true`. Questo gate gira **dentro il servizio staging**, genera internamente il token dell'utente sintetico e chiama soltanto `127.0.0.1`, quindi non richiede di esportare JWT o altri segreti. `read-heavy` e `burst` sono read-only; `mixed` abilita esclusivamente una scrittura idempotente `political-selection` sullo user E2E sintetico fisso. Override remoti/mutazioni esterne restano rifiutati. Il gate limita la concorrenza e passa solo con zero richieste fallite e metriche valide.

### F12-31 — misura staging reale del 12/10/2026

Esecuzione finale riproducibile con **60 richieste per profilo**:

| Profilo | Concorrenza | Richieste | Errori | RPS | p50 | p95 | p99 | Max | Byte risposta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| read-heavy | 4 | 60 | 0 | 12.29 | 294.2 ms | 700.1 ms | 917.1 ms | 917.1 ms | 19,470 |
| burst | 20 effettivi (4×5) | 60 | 0 | 13.05 | 1,391.6 ms | 2,894.8 ms | 3,296.7 ms | 3,296.7 ms | 19,470 |
| mixed | 4 | 60 | 0 | 14.95 | 199.3 ms | 705.1 ms | 904.2 ms | 904.2 ms | 17,292 |

Una precedente esecuzione continua da 10 secondi ha confermato lo stesso andamento: read-heavy ~12.45 RPS / p95 ~799 ms, burst ~14.05 RPS / p95 ~2.39 s, mixed ~15.72 RPS / p95 ~605 ms, sempre con zero errori. Durante quella matrice Render ha campionato **CPU backend ~0.117/0.15 (~78%)**, memoria backend ~103 MB/512 MiB, **CPU PostgreSQL 0.1/0.1 (100%)**, memoria DB ~86 MB/256 MiB e 4 connessioni attive.

Quindi F12-31 è **qualificato**: la configurazione Free regge il profilo read/mixed testato a concorrenza 4 senza errori, mentre il burst a 20 concorrenti è uno **stress point di saturazione**, non una capacità operativa dichiarabile. Il self-test è loopback, quindi i byte del runner misurano il payload API ma non il percorso Internet/CDN né una banda esterna Render confrontabile con traffico utente reale.

## 10. Decisioni operative risultanti da F12-05

1. **Closed beta:** tecnicamente compatibile con gli ordini di grandezza di storage/traffico osservati, ma la configurazione backend Free non va considerata automaticamente production-ready.
2. **Pilot da ~1,000 registrati / 200 DAU:** con l'ipotesi di traffico corrente richiede già più quota API rispetto ai 5 GB osservati.
3. **10,000+ registrati:** storage, banda e compute devono essere dimensionati con dati reali; un riferimento DB da 1 GB ha margine insufficiente nello scenario medio/pesante.
4. **100,000 registrati:** richiede architettura/piani scalabili; l'attuale singola istanza Free non è un target di capacità plausibile.
5. **Prima di acquistare/definire piani:** verificare i limiti account-specific effettivi di database e frontend; i valori 1 GB/100 GB in questo documento sono solo sensibilità.
6. **Prima del go-live:** completare F12-31 e trasformare almeno un profilo di carico in capacità misurata.

## 11. Aggiornamento del modello

Eseguire:

```bash
node api/scripts/capacityEstimate.js
```

Quando cambiano bundle, provider o pattern d'uso:

- aggiornare `MEASURED` soltanto con misure reali;
- aggiornare `CURRENT_ACCOUNT_OBSERVED` soltanto dopo verifica account/provider;
- mantenere i limiti non verificati in `REFERENCE_ONLY`;
- modificare `ASSUMPTIONS` dichiarando la fonte o il motivo;
- aggiornare i test nello stesso checkpoint.

Il modello deve sempre distinguere **misura**, **quota osservata**, **riferimento esterno** e **assunzione**.
