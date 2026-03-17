# Fix Ordinamento SPARQL - Votazioni Recenti

## 🐛 Problema Identificato

Le votazioni mostrate erano del **2023** invece del **2026**, e i nomi erano generici ("Articolo 3", "Articolo 4") invece di descrittivi.

## 🔍 Causa

Le query SPARQL ordinavano per `ORDER BY DESC(?votazione)` invece di `ORDER BY DESC(?sedutaData)`, causando:
- Recupero di votazioni vecchie invece delle più recenti
- Nomi generici perché le votazioni vecchie hanno label meno descrittive

## ✅ Soluzione

Modificato l'ordinamento in tutte le query SPARQL da:
```sparql
ORDER BY DESC(?votazione)
```

a:
```sparql
ORDER BY DESC(?sedutaData) DESC(?votazione)
```

Questo ordina prima per data (più recenti prima), poi per URI votazione.

## 📝 File Modificati

1. **`routes/voti-politici.js`**:
   - Query Senato: `ORDER BY DESC(?sedutaData) DESC(?votazione)`
   - Query Camera: `ORDER BY DESC(?sedutaData) DESC(?votazione)`

2. **`jobs/votiParlamentoSyncJob.js`**:
   - Query Senato: `ORDER BY DESC(?sedutaData) DESC(?votazione)`
   - Query Camera: `ORDER BY DESC(?sedutaData) DESC(?votazione)`

## 🎯 Risultato Atteso

Dopo questa modifica:
- ✅ Votazioni del **2026** (più recenti) invece del 2023
- ✅ Nomi più descrittivi come "Disegno di legge n. 1718. Votazione questione fiducia" invece di "Articolo X"
- ✅ Dati aggiornati e corretti

## 🧪 Test Eseguiti

Test eseguito con `test-sparql-recenti.js`:
- ✅ Senato: Recupera votazioni del 2026-01-08 (più recenti)
- ✅ Nomi descrittivi: "Disegno di legge n. 1718. Votazione questione fiducia"
- ✅ Camera: Query aggiornata (da testare con dati reali)

## 📌 Nota sui Voti Nominali

Per ottenere i voti nominali (chi ha votato cosa), come suggerito dall'utente:
- **Senato**: Usare prefissi `osr:` per persone e espressioni di voto
- **Camera**: Usare prefissi `ocp:` per voti nominali e deputati

Questo richiede query separate e può essere implementato in futuro se necessario.
