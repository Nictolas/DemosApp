# Permessi Token Axiom Necessari

## Problema Attuale
Il token API restituisce **403 Forbidden** quando si cerca di:
- Ottenere statistiche dataset via `/v1/datasets/{name}`
- Eseguire query APL via `/v1/datasets/_apl`

## Permessi Attualmente Attivi
Dal tuo token "demosapp-backup":
- ✅ **Ingest**: CREATE (attivato)
- ✅ **Query**: READ (attivato)
- ❌ **Data**: Nessun permesso
- ❌ **Datasets**: Nessun permesso

## Permessi Necessari per Statistiche Dataset

Per ottenere le statistiche reali (eventi e MB) dei dataset, devi attivare:

### Opzione 1: Permessi "Datasets"
- **Datasets**: READ ✅
  - Questo permette di leggere le informazioni sui dataset, incluse le statistiche

### Opzione 2: Permessi "Data"  
- **Data**: READ ✅
  - Questo potrebbe permettere di leggere i metadati dei dati

## Come Attivare

1. Vai su **Axiom Dashboard** → **Settings** → **API tokens**
2. Seleziona il token "demosapp-backup"
3. Nella sezione **"All datasets"** o **"Org level permissions"**:
   - Attiva **"Datasets"** → **READ** ✅
   - Oppure attiva **"Data"** → **READ** ✅
4. Salva le modifiche

## Verifica

Dopo aver attivato i permessi, esegui:
```bash
node scripts/test-dataset-api.js
```

Dovresti vedere le statistiche reali invece di 403.

