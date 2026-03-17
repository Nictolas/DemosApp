# Guida Configurazione Groq API

## 🎯 Perché Groq?
- ✅ **Completamente gratuito** (nessun limite di chiamate)
- ✅ **Velocissimo** (inferenza ultra-rapida)
- ✅ **Modelli potenti** (Llama 3.1 70B, Mixtral, ecc.)
- ✅ **Nessuna carta di credito richiesta**

---

## 📋 Passo 1: Crea Account Groq

1. Vai su **https://console.groq.com/**
2. Clicca su **"Sign Up"** o **"Get Started"**
3. Scegli come registrarti:
   - Con Google (più veloce)
   - Con email (inserisci email e password)
4. Completa la registrazione

---

## 🔑 Passo 2: Crea API Key

1. Dopo il login, vai su **"API Keys"** nel menu laterale (o cerca "API Keys" nella barra di ricerca)
2. Clicca su **"Create API Key"**
3. Dai un nome alla chiave (es: "DemosApp-Production")
4. Clicca su **"Submit"**
5. **IMPORTANTE**: Copia subito la chiave API! Apparirà solo una volta.
   - Formato: `[REDACTED_GROQ_API_KEY]`
   - Salvala in un posto sicuro (non perderla!)

---

## 🌐 Passo 3: Configura su Render

### Metodo A: Dashboard Render (Consigliato)

1. Vai su **https://dashboard.render.com/**
2. Accedi al tuo account
3. Seleziona il servizio **"demos-c7k0"** (o il nome del tuo servizio API)
4. Vai nella sezione **"Environment"** (menu laterale sinistro)
5. Scorri fino a **"Environment Variables"**
6. Clicca su **"Add Environment Variable"**
7. Compila:
   - **Key**: `GROQ_API_KEY`
   - **Value**: incolla la tua chiave API (es: `gsk_xxxxxxxx...`)
8. Clicca su **"Save Changes"**
9. **IMPORTANTE**: Render richiederà un **redeploy** del servizio
   - Clicca su **"Manual Deploy"** → **"Deploy latest commit"**
   - Oppure aspetta il prossimo deploy automatico

### Metodo B: Render CLI (Alternativo)

Se usi Render CLI:
```bash
render env:set GROQ_API_KEY=[REDACTED_GROQ_API_KEY]
```

---

## ✅ Passo 4: Verifica Configurazione

### Test Locale (opzionale)

1. Crea un file `.env` nella cartella `api/` (se non esiste già):
```bash
GROQ_API_KEY=[REDACTED_GROQ_API_KEY]
DATABASE_URL=your_database_url
# ... altre variabili
```

2. Esegui il test:
```bash
cd api
node test-genera-spiegazione.js
```

Dovresti vedere:
```
✅ GROQ_API_KEY: ✅ Configurata
✅ Spiegazione generata con successo!
```

### Test su Render

1. Dopo il redeploy, vai su **https://www.demos.community/voti-politici**
2. Clicca su **"Genera Spiegazione"** per una votazione
3. Dovrebbe funzionare senza errori 500!

---

## 🔍 Passo 5: Verifica Logs (se non funziona)

1. Su Render, vai nella sezione **"Logs"** del tuo servizio
2. Cerca messaggi che iniziano con:
   - `✅ Groq AI configurato (gratuito)` → ✅ Funziona!
   - `⚠️ Nessuna API AI configurata` → ❌ Chiave non caricata
   - `❌ Errore nella generazione spiegazione AI` → Problema con l'API

---

## 🐛 Risoluzione Problemi

### Problema: "Nessuna API AI configurata"
**Soluzione**: 
- Verifica che `GROQ_API_KEY` sia presente in Render Environment
- Assicurati di aver fatto redeploy dopo aver aggiunto la variabile
- Controlla che il nome della variabile sia esattamente `GROQ_API_KEY` (case-sensitive)

### Problema: "Invalid API Key"
**Soluzione**:
- Verifica di aver copiato l'intera chiave (inizia con `gsk_`)
- Assicurati che non ci siano spazi prima/dopo la chiave
- Controlla che la chiave non sia scaduta (ricreala se necessario)

### Problema: "Rate limit exceeded"
**Soluzione**:
- Groq è gratuito ma ha rate limits
- Aspetta qualche minuto e riprova
- Se persiste, contatta il supporto Groq

---

## 📝 Note Importanti

1. **Sicurezza**: Non committare mai la chiave API nel codice!
   - Usa sempre variabili d'ambiente
   - Non condividere la chiave pubblicamente

2. **Limiti Groq**:
   - Gratuito ma con rate limits ragionevoli
   - Per uso intensivo, considera un account a pagamento

3. **Modello Default**:
   - Il codice usa `llama-3.1-70b-versatile` (gratuito)
   - Puoi cambiarlo con la variabile `GROQ_MODEL` se necessario

---

## 🎉 Fatto!

Una volta configurato, le spiegazioni AI verranno generate automaticamente per tutte le votazioni!

Per testare:
1. Vai su `/voti-politici`
2. Clicca su "Genera Spiegazione"
3. Dovrebbe funzionare! 🚀
