# 🔍 Verifica Token Axiom

## Token Attuale nel `.env`

Il tuo file `.env` contiene:
```
AXIOM_API_TOKEN=xaat-...
```

## ⚠️ Problema

Questo token restituisce errore 403 Forbidden, anche se "demosapp-backup" ha i permessi corretti.

## ✅ Soluzione

### Opzione 1: Rigenera il Token "demosapp-backup"

1. **Vai su Axiom:**
   - https://app.axiom.co/demos-institute-jrim/settings/api-tokens

2. **Seleziona "demosapp-backup"**

3. **Clicca "Regenerate token"**
   - ⚠️ Questo genererà un NUOVO token
   - Il vecchio (`xaat-...`) smetterà di funzionare
   - **Copia il nuovo token** (lo vedrai solo una volta!)

4. **Aggiorna il `.env`:**
   - Apri il file `.env` nella root del progetto
   - Sostituisci la riga `AXIOM_API_TOKEN=...` con il nuovo token
   - Rimuovi eventuali duplicati (ce ne sono 2!)

### Opzione 2: Crea un Nuovo Token

1. **Vai su Axiom:**
   - https://app.axiom.co/demos-institute-jrim/settings/api-tokens

2. **Clicca "New API token"**

3. **Configura:**
   - Name: `Migration Token`
   - Permessi: **Ingest (CREATE)** e **Query (READ)**

4. **Copia il token** e aggiorna il `.env`

## 📝 Formato Corretto del `.env`

Dopo l'aggiornamento, il `.env` dovrebbe avere **UNA SOLA** riga:

```env
AXIOM_API_TOKEN=xaat-il-tuo-nuovo-token-qui
```

**NON** duplicare la riga!

## 🔄 Dopo l'Aggiornamento

1. **Aggiorna anche su Render:**
   - Vai su Render Dashboard → Environment
   - Aggiorna `AXIOM_API_TOKEN` con il nuovo token

2. **Riprova la migrazione:**
   ```bash
   node scripts/start-migration-with-login.js --confirm
   ```

