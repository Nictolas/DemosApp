# 🔍 Verifica Configurazione Groq su Render

## ⚠️ Problema: Errore 500 dopo aver configurato GROQ_API_KEY

Se hai già aggiunto `GROQ_API_KEY` su Render ma ancora ricevi errore 500, segui questi passi:

---

## 📋 Checklist Verifica

### 1. Verifica che la variabile sia presente su Render

1. Vai su **https://dashboard.render.com/**
2. Seleziona il servizio **"demos-c7k0"** (o il nome del tuo servizio)
3. Vai su **"Environment"** (menu laterale)
4. Scorri fino a **"Environment Variables"**
5. **Verifica** che `GROQ_API_KEY` sia presente nella lista
6. **Controlla** che il valore sia corretto (inizia con `gsk_`)

### 2. Verifica che il servizio sia stato riavviato

**IMPORTANTE**: Dopo aver aggiunto/modificato una variabile d'ambiente, Render **NON riavvia automaticamente** il servizio!

**Cosa fare:**
1. Su Render, vai nella sezione **"Events"** o **"Logs"** del tuo servizio
2. Cerca l'ultimo deploy/riavvio
3. Se l'ultimo deploy è **prima** di quando hai aggiunto `GROQ_API_KEY`, devi fare un **redeploy manuale**:
   - Clicca su **"Manual Deploy"** (in alto a destra)
   - Seleziona **"Deploy latest commit"**
   - Oppure fai un **commit vuoto** per triggerare un nuovo deploy

### 3. Controlla i log su Render

1. Su Render, vai nella sezione **"Logs"** del tuo servizio
2. Cerca messaggi che iniziano con:
   - `✅ Groq AI configurato (gratuito)` → ✅ **Funziona!**
   - `❌ Nessuna API AI configurata` → ❌ **Chiave non caricata**
   - `❌ Errore inizializzazione Groq` → ❌ **Chiave non valida**

### 4. Verifica formato chiave API

La chiave Groq deve:
- Iniziare con `gsk_`
- Essere lunga circa 51 caratteri
- Non avere spazi prima/dopo

**Esempio corretto:**
```
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
```

---

## 🔧 Soluzione: Redeploy Manuale

Se la variabile è presente ma il servizio non è stato riavviato:

### Opzione 1: Redeploy da Render Dashboard
1. Vai su **"Manual Deploy"** (in alto a destra)
2. Clicca su **"Deploy latest commit"**
3. Attendi 2-3 minuti per il deploy

### Opzione 2: Commit vuoto (trigger deploy)
```bash
git commit --allow-empty -m "Trigger deploy per caricare GROQ_API_KEY"
git push
```

### Opzione 3: Riavvio manuale
1. Vai su **"Settings"** del servizio
2. Cerca **"Restart"** o **"Redeploy"**
3. Clicca per riavviare

---

## 🧪 Test dopo Redeploy

Dopo il redeploy, controlla i log:

1. Vai su **"Logs"** su Render
2. Cerca questo messaggio all'avvio:
   ```
   ✅ Groq AI configurato (gratuito)
      API Key: gsk_jSLLgj...
   ```
3. Se vedi questo messaggio → ✅ **Configurazione corretta!**
4. Se vedi `❌ Nessuna API AI configurata` → La variabile non è stata caricata

---

## 🐛 Se ancora non funziona

### Problema: "Invalid API Key"
- Verifica che la chiave sia corretta su https://console.groq.com/keys
- Controlla che non ci siano spazi nella variabile su Render
- Ricrea la chiave se necessario

### Problema: "Rate limit exceeded"
- Groq ha rate limits anche se gratuito
- Aspetta qualche minuto e riprova

### Problema: Log mostrano "Nessuna API AI configurata"
- Verifica che il nome della variabile sia esattamente `GROQ_API_KEY` (case-sensitive)
- Assicurati di aver fatto redeploy dopo aver aggiunto la variabile
- Controlla che non ci siano spazi nel nome della variabile

---

## 📞 Debug Avanzato

Se vuoi vedere esattamente cosa sta succedendo, aggiungi questo log temporaneo in `services/aiExplanationService.js`:

```javascript
console.log('🔍 DEBUG - Variabili ambiente:');
console.log('   GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'PRESENTE (' + process.env.GROQ_API_KEY.substring(0, 10) + '...)' : 'NON PRESENTE');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'PRESENTE' : 'NON PRESENTE');
```

Poi fai commit e push, e controlla i log su Render.

---

## ✅ Verifica Finale

Dopo aver fatto tutto:
1. ✅ Variabile `GROQ_API_KEY` presente su Render
2. ✅ Servizio riavviato/redeployato
3. ✅ Log mostrano "✅ Groq AI configurato"
4. ✅ Test generazione spiegazione funziona

Se tutti i punti sono ✅, dovrebbe funzionare! 🚀
