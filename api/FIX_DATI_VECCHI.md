# Fix Dati Vecchi - Votazioni Parlamento

## 🐛 Problema

Le votazioni mostrate erano del **2023** invece del **2026**, e i nomi erano generici ("Articolo 4", "Articolo 5") invece di descrittivi.

## 🔍 Cause Identificate

1. **Ordinamento errato**: Le query SPARQL ordinavano per `DESC(?votazione)` invece di `DESC(?sedutaData)`
2. **Cache database**: L'endpoint usava dati vecchi dal database invece di recuperare da SPARQL
3. **Nessun refresh automatico**: Non c'era controllo per verificare se i dati erano obsoleti

## ✅ Soluzioni Implementate

### 1. Ordinamento Corretto
**File**: `routes/voti-politici.js`, `jobs/votiParlamentoSyncJob.js`

Modificato da:
```sparql
ORDER BY DESC(?votazione)
```

a:
```sparql
ORDER BY DESC(?sedutaData) DESC(?votazione)
```

### 2. Controllo Automatico Dati Vecchi
**File**: `routes/voti-politici.js`

Aggiunto controllo: se i dati nel database sono più vecchi di **24 ore**, recupera automaticamente da SPARQL invece di usare la cache.

```javascript
// Controlla se ci sono dati recenti (ultime 24 ore) nel database
const checkRecent = await pool.query(`
  SELECT MAX(data_sincronizzazione) as last_sync, MAX(data_votazione) as last_date
  FROM parlamento
  WHERE camera = $1
`, [camera]);

const shouldRefresh = !lastSync || new Date(lastSync) < oneDayAgo;
```

### 3. Parametro Refresh Forzato
**File**: `routes/voti-politici.js`

Aggiunto parametro `refresh=true` per forzare il refresh anche se ci sono dati recenti:
```javascript
const forceRefresh = req.query.refresh === 'true';
```

### 4. Frontend - Refresh Automatico
**File**: `client/src/pages/VotiParlamento.tsx`

- Aggiunto `&refresh=true` alla chiamata API
- Impostato `staleTime: 0` per forzare sempre il refresh
- Impostato `cacheTime: 0` per non cache i dati

## 🎯 Risultato Atteso

Dopo queste modifiche:
- ✅ Votazioni del **2026** (più recenti) invece del 2023
- ✅ Nomi descrittivi come "Disegno di legge n. 1718. Votazione questione fiducia" invece di "Articolo X"
- ✅ Dati sempre aggiornati (refresh automatico ogni volta che si visita la pagina)
- ✅ Controllo automatico: se i dati sono vecchi, recupera da SPARQL

## 📝 Test Eseguiti

Test con `test-sparql-recenti.js` ha confermato:
- ✅ Senato: Recupera votazioni del 2026-01-08 (più recenti)
- ✅ Nomi descrittivi: "Disegno di legge n. 1718. Votazione questione fiducia"
- ✅ Ordinamento per data funziona correttamente

## 🚀 Prossimi Passi

1. **Deploy**: Le modifiche devono essere deployate sul server
2. **Test**: Verificare che la pagina mostri dati del 2026
3. **Monitoraggio**: Controllare i log per verificare che il refresh funzioni

## 💡 Nota

Se i dati continuano a essere vecchi dopo il deploy:
1. Verificare che le modifiche siano state deployate
2. Controllare i log del server per vedere se il refresh viene eseguito
3. Provare a chiamare manualmente: `/api/voti-politici/ultime?limit=3&refresh=true`
