# 🔍 Diagnostica Errore 403 Axiom

## ❌ Problema

Anche la **lista datasets** restituisce 403, il che significa che:
- Il token **non ha permessi base** per accedere all'API
- O l'**Org ID non corrisponde** al token

## 🔧 Cosa Verificare

### 1. Verifica Org ID su Axiom

1. Vai su **Axiom Dashboard** → **Settings** → **Organization**
2. **Copia l'Organization ID esatto** (dovrebbe essere `demos-institute-jrim`)
3. **Confronta** con quello nel `.env` e su Render

### 2. Verifica Token su Axiom

1. Vai su **Settings** → **API Tokens**
2. **Clicca sul token** che stai usando
3. Verifica:
   - **Organization**: Deve essere `demos-institute-jrim`
   - **Permissions**: Deve avere almeno "Ingest" e "Query"
   - **Status**: Deve essere "Active"

### 3. Possibile Problema

Se il token è stato creato per un'**altra organization** o in un'**altra regione**, non funzionerà.

## 🎯 Soluzione

1. **Crea un nuovo token** direttamente dalla pagina del dataset `centralized_logs`:
   - Vai su **Datasets** → **centralized_logs**
   - Clicca **"Create a new token"** (pulsante in alto a destra)
   - Questo crea un token **specifico per quel dataset** con i permessi corretti

2. **Oppure** crea un token generico:
   - Vai su **Settings** → **API Tokens** → **Create Token**
   - Seleziona **Organization**: `demos-institute-jrim`
   - Permessi: **Ingest** e **Query**
   - **Copia il token** (lo vedrai solo una volta!)

3. **Aggiorna** il token in:
   - `.env` locale
   - **Render Environment Variables**

## 💡 Nota Importante

Il token deve essere creato per l'**organization corretta** (`demos-institute-jrim`). Se crei il token per un'altra organization, non funzionerà anche se ha i permessi corretti.


