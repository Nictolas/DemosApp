# 🔑 Come Ottenere il Token Axiom

## 📍 Dove si trova il file `.env`

Il file `.env` si trova nella **root del progetto**:
```
C:\Users\Nicolas\Nuova cartella\DemosApp-1\.env
```

## 🔍 Come Ottenere il Token da Axiom

### Metodo 1: Rigenera il Token "demosapp-backup" (Mostra il valore)

1. **Vai su Axiom:**
   - https://app.axiom.co/demos-institute-jrim/settings/api-tokens

2. **Seleziona il token "demosapp-backup"** (quello che vedi nello screenshot)

3. **Clicca "Regenerate token"**
   - ⚠️ **ATTENZIONE**: Questo genererà un NUOVO token
   - Il vecchio token smetterà di funzionare
   - **Copia il nuovo token** che viene mostrato (lo vedrai solo una volta!)

4. **Aggiorna il `.env`:**
   ```
   AXIOM_API_TOKEN=nuovo-token-qui
   ```

### Metodo 2: Crea un Nuovo Token (Consigliato)

1. **Vai su Axiom:**
   - https://app.axiom.co/demos-institute-jrim/settings/api-tokens

2. **Clicca "New API token"** (bottone blu in alto a destra)

3. **Configura il token:**
   - **Name**: `Migration Token` o `DemosApp Production`
   - **Description**: (opzionale) "Token per migrazione log e produzione"

4. **Configura i permessi:**
   - Espandi "All datasets"
   - ✅ **Ingest**: seleziona "CREATE"
   - ✅ **Query**: seleziona "READ"
   - Lascia tutto il resto deselezionato

5. **Clicca "Create"**
   - **Copia il token** che viene mostrato (lo vedrai solo una volta!)
   - Inizia con `xaat-...`

6. **Aggiorna il `.env`:**
   ```
   AXIOM_API_TOKEN=AXIOM_TOKEN_REDACTED
   ```

## 📝 Formato del file `.env`

Il file `.env` dovrebbe contenere:

```env
# Database
DATABASE_URL=postgresql://username:password@host.db.neon.tech/neondb?sslmode=require

# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=xaat-il-tuo-token-qui
AXIOM_ORG_ID=demos-institute-jrim
AXIOM_DATASET=centralized_logs
AXIOM_REALTIME_DATASET=real-time
AXIOM_REGION=eu
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=c88eef574bfcb314db3c22b6474a08194e5bd18d903701eff3d68cdaba725b5c

# Altri...
JWT_SECRET=[REDACTED_JWT_SECRET]
PORT=3001
NODE_ENV=development
```

## ⚠️ Importante

- Il token inizia sempre con `xaat-`
- Una volta copiato, non potrai più vederlo su Axiom
- Se perdi il token, devi rigenerarlo o crearne uno nuovo
- Aggiorna anche su Render (Environment → AXIOM_API_TOKEN) se usi la migrazione via API

