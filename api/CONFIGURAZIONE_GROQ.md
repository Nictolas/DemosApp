# Configurazione Groq API (Gratuita)

## 🆓 Perché Groq?

- ✅ **Completamente gratuito** - Nessun costo nascosto
- ✅ **Molto veloce** - Inference ultra-rapida
- ✅ **Facile da configurare** - Solo una chiave API
- ✅ **Nessun limite di costo** - Puoi generare quante spiegazioni vuoi

## 📋 Passi per Configurare

### 1. Registrati su Groq

1. Vai su https://console.groq.com
2. Clicca su "Sign Up" o "Sign In"
3. Crea un account (puoi usare Google/GitHub)

### 2. Ottieni la Chiave API

1. Dopo il login, vai su https://console.groq.com/keys
2. Clicca su "Create API Key"
3. Dai un nome alla chiave (es. "DemosApp")
4. Copia la chiave API (inizia con `gsk_...`)

### 3. Configura nel Progetto

Aggiungi al file `.env`:

```env
GROQ_API_KEY=gsk_tua_chiave_api_qui
```

### 4. Riavvia il Server

```bash
npm start
# oppure
npm run dev
```

## ✅ Verifica Configurazione

Dovresti vedere nel log del server:

```
✅ Groq AI configurato (gratuito)
```

## 🎯 Modelli Disponibili

Puoi scegliere il modello nel `.env`:

```env
GROQ_MODEL=llama-3.1-70b-versatile  # Default (consigliato)
GROQ_MODEL=llama-3.1-8b-instant     # Più veloce, qualità leggermente inferiore
GROQ_MODEL=mixtral-8x7b-32768       # Alternativa
```

## 🚀 Pronto!

Ora le spiegazioni AI funzioneranno completamente gratis! 

Non ci sono limiti di costo, quindi puoi generare quante spiegazioni vuoi senza preoccuparti dei costi.

## 🔧 Troubleshooting

### Errore: "Groq API key not found"
- Verifica che `GROQ_API_KEY` sia nel file `.env`
- Assicurati che la chiave inizi con `gsk_`
- Riavvia il server dopo aver aggiunto la chiave

### Errore: "Invalid API key"
- Verifica che la chiave sia corretta su https://console.groq.com/keys
- Assicurati di aver copiato tutta la chiave (è lunga)

### Le spiegazioni non vengono generate
- Controlla i log del server per errori
- Verifica che la votazione non sia vuota
- Assicurati che il modello sia disponibile su Groq

## 📚 Documentazione

- Console Groq: https://console.groq.com
- Documentazione API: https://console.groq.com/docs
- Modelli disponibili: https://console.groq.com/docs/models
