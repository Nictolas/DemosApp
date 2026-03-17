# 🚀 Istruzioni Migrazione Axiom - Esecuzione Locale

## ✅ Script Pronto

Ho creato `scripts/migrate-local.js` che:
- ✅ Si connette direttamente a Neon (non serve Render Shell)
- ✅ Si connette direttamente ad Axiom
- ✅ Può essere eseguito dal tuo computer
- ✅ Non richiede funzionalità a pagamento

## 📋 Prerequisiti

1. **DATABASE_URL da Neon:**
   - Vai su https://console.neon.tech
   - Seleziona il tuo progetto
   - Vai su "Connection Details" o "Settings"
   - Copia la connection string (postgresql://...)

2. **Credenziali Axiom** (già configurate nel .env):
   - `AXIOM_ENABLED=true`
   - `AXIOM_API_TOKEN=xaat-...`
   - `AXIOM_ORG_ID=demos-institute-jrim`
   - `AXIOM_DATASET=centralized_logs`
   - `AXIOM_REALTIME_DATASET=real-time`

## 🚀 Come Eseguire

### Opzione 1: Usando il file .env

1. Aggiungi al file `.env`:
   ```env
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   ```

2. Esegui:
   ```bash
   # Verifica quanti record ci sono
   node scripts/migrate-local.js dry-run
   
   # Avvia la migrazione
   node scripts/migrate-local.js migrate
   ```

### Opzione 2: Passando DATABASE_URL come parametro

```bash
# Verifica quanti record ci sono
node scripts/migrate-local.js dry-run --database-url="postgresql://..."

# Avvia la migrazione
node scripts/migrate-local.js migrate --database-url="postgresql://..."
```

### Opzione 3: Usando variabile d'ambiente (PowerShell)

```powershell
# Verifica quanti record ci sono
$env:DATABASE_URL="postgresql://..."; node scripts/migrate-local.js dry-run

# Avvia la migrazione
$env:DATABASE_URL="postgresql://..."; node scripts/migrate-local.js migrate
```

## 📊 Cosa Succede

1. **Legge dati da Neon** in batch da 1000 record
2. **Converte** nel formato Axiom
3. **Invia ad Axiom**:
   - `centralized_logs` → dataset `centralized_logs`
   - `audit_logs` → dataset `real-time` (con tag `log_type: "audit"`)
4. **Mostra progresso** in tempo reale

## ⏱️ Tempo Stimato

- ~1000 record/secondo
- 100.000 record = ~2 minuti
- 1.000.000 record = ~20 minuti

## ✅ Verifica

Dopo la migrazione, verifica su Axiom:
1. Vai su https://app.axiom.co/demos-institute-jrim/datasets
2. Seleziona `centralized_logs` o `real-time`
3. Clicca su "Query" e esegui: `['centralized_logs'] | count`

## 🆘 Problemi?

- **Errore DATABASE_URL**: Verifica che la connection string sia corretta
- **Errore Axiom**: Verifica le credenziali nel .env
- **Nessun dato su Axiom**: Attendi qualche minuto (Axiom ha un leggero delay)

