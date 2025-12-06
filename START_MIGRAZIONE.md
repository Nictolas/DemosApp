# 🚀 Avvia Migrazione Axiom - Istruzioni Rapide

## ✅ Tutto è Pronto!

Ho preparato tutto per la migrazione. Ecco come procedere:

## 📋 Step 1: Ottieni DATABASE_URL da Neon

1. Vai su **https://console.neon.tech**
2. Seleziona il tuo progetto **DEMOS**
3. Vai su **"Connection Details"** o **"Settings"**
4. Copia la **connection string** (inizia con `postgresql://...`)

## 📋 Step 2: Esegui la Migrazione

### Opzione A: Aggiungi al .env (Consigliato)

1. Apri il file `.env` nella root del progetto
2. Aggiungi/modifica questa riga:
   ```env
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   ```
   (Sostituisci con la connection string reale da Neon)

3. Esegui:
   ```bash
   # Prima verifica quanti record ci sono
   node scripts/migrate-local.js dry-run
   
   # Poi avvia la migrazione
   node scripts/migrate-local.js migrate
   ```

### Opzione B: Passa come Parametro

```bash
# Verifica statistiche
node scripts/migrate-local.js dry-run --database-url="postgresql://..."

# Avvia migrazione
node scripts/migrate-local.js migrate --database-url="postgresql://..."
```

### Opzione C: Variabile d'Ambiente (PowerShell)

```powershell
# Verifica statistiche
$env:DATABASE_URL="postgresql://..."; node scripts/migrate-local.js dry-run

# Avvia migrazione  
$env:DATABASE_URL="postgresql://..."; node scripts/migrate-local.js migrate
```

## 📊 Cosa Succede Durante la Migrazione

1. ✅ Si connette a Neon e legge i dati
2. ✅ Converte nel formato Axiom
3. ✅ Invia ad Axiom in batch da 1000 record
4. ✅ Mostra progresso in tempo reale

**Mapping:**
- `centralized_logs` (Neon) → `centralized_logs` (Axiom)
- `audit_logs` (Neon) → `real-time` (Axiom, con tag `log_type: "audit"`)

## ⏱️ Tempo Stimato

- ~1000 record/secondo
- 100.000 record = ~2 minuti
- 1.000.000 record = ~20 minuti

## ✅ Verifica su Axiom

Dopo la migrazione:

1. Vai su **https://app.axiom.co/demos-institute-jrim/datasets**
2. Seleziona il dataset (`centralized_logs` o `real-time`)
3. Clicca su **"Query"** e esegui:
   ```
   ['centralized_logs'] | count
   ```

## 🆘 Problemi?

- **Errore DATABASE_URL**: Verifica che la connection string sia completa e corretta
- **Errore Axiom**: Le credenziali sono già nel .env, verifica che siano corrette
- **Nessun dato su Axiom**: Attendi 1-2 minuti (Axiom ha un leggero delay)

## 📝 Note

- ✅ La migrazione **NON elimina** i dati da Neon (rimangono entrambi)
- ✅ La migrazione è **sicura** e può essere interrotta e ripresa
- ✅ I dati vengono inviati in batch con pausa di 1 secondo tra batch

---

**Pronto per iniziare?** Esegui il comando con il DATABASE_URL e la migrazione partirà! 🚀

