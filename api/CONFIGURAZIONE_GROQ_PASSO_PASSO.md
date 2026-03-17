# 🚀 Configurazione Groq - Guida Passo Passo

## ⚡ Quick Start (5 minuti)

### 1️⃣ Crea Account Groq
👉 **Vai su**: https://console.groq.com/
- Clicca "Sign Up"
- Registrati con Google o email
- Completa la registrazione

### 2️⃣ Ottieni API Key
👉 **Dopo il login**:
- Clicca su **"API Keys"** nel menu
- Clicca **"Create API Key"**
- Dai un nome (es: "DemosApp")
- **COPIA LA CHIAVE** (appare solo una volta!)
  - Formato: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3️⃣ Configura su Render
👉 **Vai su**: https://dashboard.render.com/

1. Seleziona il tuo servizio **"demos-c7k0"** (o il nome del tuo servizio)
2. Vai su **"Environment"** (menu laterale)
3. Scorri fino a **"Environment Variables"**
4. Clicca **"Add Environment Variable"**
5. Inserisci:
   - **Key**: `GROQ_API_KEY`
   - **Value**: incolla la chiave copiata (es: `gsk_xxxxxxxx...`)
6. Clicca **"Save Changes"**
7. **IMPORTANTE**: Fai redeploy del servizio
   - Clicca su **"Manual Deploy"** → **"Deploy latest commit"**

### 4️⃣ Verifica
👉 **Dopo il redeploy**:
1. Vai su https://www.demos.community/voti-politici
2. Clicca su **"Genera Spiegazione"** per una votazione
3. ✅ Dovrebbe funzionare!

---

## 📸 Screenshot Guide

### Screenshot 1: Console Groq - API Keys
```
1. Login su console.groq.com
2. Menu laterale → "API Keys"
3. Clicca "Create API Key"
4. Copia la chiave (gsk_...)
```

### Screenshot 2: Render Dashboard - Environment
```
1. Dashboard Render → Il tuo servizio
2. Menu laterale → "Environment"
3. "Environment Variables" → "Add Environment Variable"
4. Key: GROQ_API_KEY
5. Value: incolla la chiave
6. Save → Manual Deploy
```

---

## ✅ Checklist

- [ ] Account Groq creato
- [ ] API Key generata e copiata
- [ ] Variabile `GROQ_API_KEY` aggiunta su Render
- [ ] Servizio riavviato/redeployato
- [ ] Test generazione spiegazione funziona

---

## 🆘 Problemi?

### "Nessuna API AI configurata"
→ Verifica che `GROQ_API_KEY` sia in Render Environment
→ Assicurati di aver fatto redeploy

### "Invalid API Key"
→ Controlla di aver copiato l'intera chiave (inizia con `gsk_`)
→ Verifica che non ci siano spazi

### "500 Internal Server Error"
→ Controlla i log su Render
→ Cerca messaggi che iniziano con `✅ Groq AI configurato`

---

## 🎯 Prossimi Passi

Dopo la configurazione:
1. ✅ Le spiegazioni verranno generate automaticamente
2. ✅ Puoi generare spiegazioni manualmente cliccando "Genera"
3. ✅ Le spiegazioni saranno condivise tra tutti i politici con la stessa votazione

---

**Hai bisogno di aiuto?** Controlla i log su Render o esegui `node test-genera-spiegazione.js` localmente.
