# 🔍 Diagnosi Errore 500 - Generazione Spiegazione

## Problema
Errore 500 quando si clicca "Genera Spiegazione" per `votazione_id: 16`

## 📋 Cosa Serve per Diagnosticare

I log che hai fornito sono di `/api/notifiche`, non dell'errore 500 specifico.

**Per trovare l'errore esatto:**

1. Vai su **https://dashboard.render.com/**
2. Seleziona il servizio **"demos-c7k0"**
3. Vai su **"Logs"**
4. Cerca messaggi che contengono:
   - `POST /api/voti-camera/votazione/16/spiegazione`
   - `[DEBUG] Step` (Step 1, Step 2, Step 3, ecc.)
   - `❌ Errore`
   - `model_decommissioned`
   - `BadRequestError`
   - `Groq AI configurato`

5. **Copia e incolla** tutti i log che appaiono quando clicchi "Genera Spiegazione"

## 🔍 Possibili Cause (in ordine di probabilità)

### 1. Modello Groq Deprecato (PIÙ PROBABILE)
**Sintomo**: Log mostrano `model_decommissioned` o `llama-3.1-70b-versatile`

**Causa**: Render sta usando il vecchio modello deprecato

**Soluzione**: 
```bash
git add services/aiExplanationService.js
git commit -m "Fix: Aggiorna modello Groq a llama-3.3-70b-versatile"
git push
```

Poi aspetta 2-3 minuti per il deploy automatico.

### 2. Chiave API Non Caricata
**Sintomo**: Log mostrano `❌ Nessuna API AI configurata`

**Causa**: `GROQ_API_KEY` non presente o servizio non riavviato

**Soluzione**: 
- Verifica che `GROQ_API_KEY` sia in Render Environment
- Fai redeploy manuale

### 3. Errore nella Chiamata API Groq
**Sintomo**: Log mostrano `BadRequestError` o `401 Unauthorized`

**Causa**: Chiave API non valida o scaduta

**Soluzione**: 
- Verifica la chiave su https://console.groq.com/keys
- Ricrea la chiave se necessario

### 4. Errore nel Database
**Sintomo**: Log mostrano errori SQL o `votazione non trovata`

**Causa**: Problema con la query al database

**Soluzione**: Controlla i log per l'errore SQL specifico

## 🎯 Cosa Fare Ora

1. **Cerca i log specifici dell'errore 500** su Render (vedi sopra)
2. **Condividi i log** che trovi quando clicchi "Genera Spiegazione"
3. **Oppure** committa e pusha le modifiche che ho fatto:
   ```bash
   git add services/aiExplanationService.js
   git commit -m "Fix: Aggiorna modello Groq e migliora gestione errori"
   git push
   ```

## 📸 Cosa Cercare nei Log

Quando clicchi "Genera Spiegazione", dovresti vedere una sequenza come questa:

```
[DEBUG] ========== INIZIO GENERAZIONE SPIEGAZIONE ==========
[DEBUG] Step 1: Verifica autenticazione e ruolo admin
[DEBUG] Step 2: Votazione richiesta: ID=16
[DEBUG] Step 3: Query database per trovare votazione
[DEBUG] Step 5: Caricamento servizio AI
[DEBUG] Step 7: Generazione spiegazione AI
[DEBUG] Usando modello Groq: llama-3.3-70b-versatile  ← QUESTO È IMPORTANTE
```

Se vedi invece:
```
❌ Errore nella generazione spiegazione AI (groq): The model `llama-3.1-70b-versatile` has been decommissioned
```

Significa che il codice non è stato aggiornato su Render.
