# 🔑 Come Ottenere il Token Axiom

## 📍 Dove si trova il file `.env`

Il file `.env` si trova nella **root del progetto**. Non inserire nel repository percorsi personali, token, password, connection string reali o salt di produzione.

## 🔍 Come Ottenere il Token da Axiom

### Metodo 1: Rigenera il Token "demosapp-backup" (Mostra il valore)

1. **Vai su Axiom:**
   - https://app.axiom.co/demos-institute-jrim/settings/api-tokens

2. **Seleziona il token "demosapp-backup"**

3. **Clicca "Regenerate token"**
   - ⚠️ **ATTENZIONE**: Questo genererà un NUOVO token
   - Il vecchio token smetterà di funzionare
   - **Copia il nuovo token** che viene mostrato (lo vedrai solo una volta!)

4. **Aggiorna il `.env` locale / secret manager:**
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

6. **Aggiorna il `.env` locale / secret manager:**
   ```
   AXIOM_API_TOKEN=AXIOM_TOKEN_REDACTED
   ```

## 📝 Formato del file `.env`

Usa solo placeholder nella documentazione e nel repository:

```env
# Database
DATABASE_URL=postgresql://username:password@host.example.invalid/database?sslmode=require

# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=xaat-...
AXIOM_ORG_ID=demos-institute-jrim
AXIOM_DATASET=centralized_logs
AXIOM_REALTIME_DATASET=real-time
AXIOM_REGION=eu
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=your-secure-random-salt-here

# Altri...
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
PORT=3001
NODE_ENV=development
```

## ⚠️ Importante

- Il token inizia con `xaat-`
- Una volta copiato, non potrai più vederlo su Axiom
- Se perdi il token, devi rigenerarlo o crearne uno nuovo
- I valori reali devono restare esclusivamente in variabili d'ambiente / secret manager (Render, locale protetto, CI secrets)
- Non committare mai token completi, password, salt reali o URI database con credenziali
