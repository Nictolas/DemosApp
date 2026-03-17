# 🔍 Verifica Deploy e Diagnosi Errore 500

## Problema
L'errore 500 persiste anche dopo aver aggiornato il modello Groq. Questo indica che:

1. **Il codice aggiornato non è stato deployato su Render**, OPPURE
2. **Il servizio su Render non è stato riavviato dopo il deploy**, OPPURE
3. **C'è un altro errore nei log del server**

## 🔍 Diagnosi Passo-Passo

### Step 1: Verifica che il codice sia stato committato

Controlla se le modifiche a `services/aiExplanationService.js` sono state committate:

```bash
git status
git log --oneline -5
```

Cerca un commit che modifica `aiExplanationService.js` con il modello `llama-3.3-70b-versatile`.

### Step 2: Verifica che Render abbia fatto il deploy

1. Vai su https://dashboard.render.com/
2. Seleziona il servizio "demos-c7k0"
3. Vai su "Events" o "Logs"
4. Controlla l'ultimo deploy:
   - Se l'ultimo deploy è **prima** di quando ho fatto le modifiche → **Devi fare deploy manuale**
   - Se l'ultimo deploy è **dopo** → Vai al Step 3

### Step 3: Controlla i log specifici dell'errore 500

**IMPORTANTE**: I log che hai fornito sono di altre chiamate API, non dell'errore 500 specifico.

Per trovare l'errore esatto:

1. Su Render, vai su "Logs"
2. Cerca messaggi che contengono:
   - `POST /api/voti-camera/votazione/16/spiegazione`
   - `❌ Errore nella generazione spiegazione`
   - `DEBUG Step`
   - `Groq AI configurato`
   - `model_decommissioned`
   - `BadRequestError`

3. Cerca l'errore più recente quando clicchi "Genera Spiegazione"

### Step 4: Verifica configurazione Groq su Render

1. Su Render, vai su "Environment"
2. Verifica che `GROQ_API_KEY` sia presente
3. Verifica che il valore sia corretto (inizia con `gsk_`)

## 🐛 Possibili Cause

### Causa 1: Codice non deployato
**Sintomo**: I log su Render mostrano ancora `llama-3.1-70b-versatile` o `model_decommissioned`

**Soluzione**: 
```bash
git add services/aiExplanationService.js
git commit -m "Fix: Aggiorna modello Groq a llama-3.3-70b-versatile"
git push
```

Poi aspetta che Render faccia il deploy automatico (2-3 minuti).

### Causa 2: Servizio non riavviato
**Sintomo**: Il codice è deployato ma i log mostrano ancora il vecchio modello

**Soluzione**: 
- Su Render, clicca "Manual Deploy" → "Deploy latest commit"

### Causa 3: Variabile d'ambiente non caricata
**Sintomo**: I log mostrano `❌ Nessuna API AI configurata`

**Soluzione**: 
- Verifica che `GROQ_API_KEY` sia in Render Environment
- Fai redeploy dopo aver aggiunto/modificato la variabile

### Causa 4: Altro errore
**Sintomo**: I log mostrano un errore diverso da `model_decommissioned`

**Soluzione**: 
- Condividi i log specifici dell'errore 500
- Cerca messaggi che iniziano con `❌` o `Error`

## 📋 Checklist Debug

- [ ] Codice aggiornato committato e pushato
- [ ] Render ha fatto deploy del codice aggiornato
- [ ] Log su Render mostrano `llama-3.3-70b-versatile` (non `llama-3.1-70b-versatile`)
- [ ] Log su Render mostrano `✅ Groq AI configurato (gratuito)`
- [ ] `GROQ_API_KEY` presente in Render Environment
- [ ] Servizio riavviato dopo modifiche

## 🎯 Cosa Fare Ora

1. **Fai commit e push delle modifiche** (se non l'hai già fatto)
2. **Aspetta 2-3 minuti** per il deploy automatico
3. **Controlla i log su Render** per vedere se appare `llama-3.3-70b-versatile`
4. **Riprova a generare la spiegazione**
5. **Se ancora non funziona**, condividi i log specifici dell'errore 500 da Render

## 📸 Cosa Cercare nei Log

Quando clicchi "Genera Spiegazione", nei log di Render dovresti vedere:

```
[DEBUG] Step 5: Caricamento servizio AI
[DEBUG] Step 7: Generazione spiegazione AI
[DEBUG] Usando modello Groq: llama-3.3-70b-versatile
✅ Spiegazione generata (groq) per: Separazione delle carriere...
```

Se vedi invece:
```
❌ Errore nella generazione spiegazione AI (groq): The model `llama-3.1-70b-versatile` has been decommissioned
```

Significa che il codice non è stato aggiornato su Render.
