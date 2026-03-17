# 🔍 Troubleshooting Migrazione Axiom

## Problema: Non Vedo Log di Migrazione

Se nei log di Render vedi solo richieste di status ma non messaggi di migrazione, potrebbe significare che:

1. **La migrazione non è partita** - L'endpoint ha risposto ma la migrazione non si è avviata
2. **La migrazione si è bloccata** - Si è avviata ma si è fermata
3. **I log non sono visibili** - La migrazione è in corso ma i log non vengono mostrati

## Come Verificare

### 1. Controlla se la Migrazione è Partita

Cerca nei log di Render (ultime 1-2 ore) questi messaggi:
- `🚀 Avvio migrazione dati da Neon a Axiom...`
- `📊 Migrazione centralized_logs da Neon a Axiom...`
- `✅ Batch 1: 1000 record`

**Se NON li vedi**, la migrazione non è partita.

### 2. Verifica su Axiom (Pagina Corretta)

**NON** usare la pagina "Ingest method" - quella è solo per configurare come inviare dati.

**Usa invece:**
1. Vai su: https://app.axiom.co/demos-institute-jrim/datasets/centralized_logs
2. Clicca su **"Query"** (in alto) o vai direttamente alla tab "Query"
3. Esegui questa query:
   ```apl
   centralized_logs
   | count
   ```
4. Se vedi un numero > 0, i dati stanno arrivando!

### 3. Riprova la Migrazione

Se la migrazione non è partita, riprova:

```bash
node scripts/start-migration-with-login.js --confirm
```

Poi controlla immediatamente i log su Render per vedere se parte.

## Cosa Cercare nei Log

**Messaggi positivi:**
- ✅ `🚀 Avvio migrazione dati da Neon a Axiom...`
- ✅ `📊 Migrazione centralized_logs...`
- ✅ `✅ Batch X: Y record`
- ✅ `🎉 Migrazione completata!`

**Messaggi di errore:**
- ❌ `❌ Errore durante la migrazione`
- ❌ `Cannot find module 'pg'`
- ❌ `Axiom API error: 403`

## Verifica Rapida

1. **Esegui lo script di verifica:**
   ```bash
   node scripts/check-migration-status.js
   ```

2. **Controlla i log su Render** (ultime 2 ore):
   - Cerca "migrazione" o "Batch"
   - Filtra per "ERROR" o "WARN"

3. **Verifica su Axiom Query:**
   - Vai su Query tab
   - Esegui: `centralized_logs | count`

