# Alternative AI Gratuite per Spiegazioni

## 🆓 Opzioni Gratuite Disponibili

### 1. **Groq API** ⭐ CONSIGLIATO
- **Costo**: Completamente gratuito
- **Velocità**: Molto veloce (inference ultra-rapida)
- **Modelli**: Llama 3, Mixtral, Gemma
- **Limiti**: Generosi, nessun limite di costo
- **Vantaggi**: 
  - Completamente gratuito
  - Molto veloce
  - Facile da integrare
  - Nessun costo nascosto

### 2. **Google Gemini API**
- **Costo**: Gratuito fino a certi limiti
- **Limiti gratuiti**: 
  - 15 richieste/minuto (RPM)
  - 1500 richieste/giorno (RPD)
- **Modelli**: gemini-pro, gemini-pro-vision
- **Vantaggi**: 
  - Tier gratuito generoso
  - Buona qualità
  - Supporto italiano

### 3. **Hugging Face Inference API**
- **Costo**: Gratuito con limiti
- **Limiti gratuiti**: 
  - ~30 richieste/minuto
  - Rate limiting variabile
- **Modelli**: Molti modelli open source disponibili
- **Vantaggi**: 
  - Molti modelli disponibili
  - Open source
  - Community support

### 4. **Ollama** (Self-hosted)
- **Costo**: Completamente gratuito (ma serve server)
- **Vantaggi**: 
  - Nessun costo API
  - Controllo completo
  - Privacy totale
- **Svantaggi**: 
  - Richiede server dedicato
  - Gestione infrastruttura

## 🎯 Raccomandazione: Groq API

**Perché Groq?**
1. ✅ Completamente gratuito
2. ✅ Molto veloce (inference ultra-rapida)
3. ✅ Facile da integrare
4. ✅ Nessun limite di costo
5. ✅ Buona qualità delle risposte

## 📋 Cosa Serve per Integrare Groq

1. **API Key**: Registrati su https://console.groq.com
2. **Pacchetto npm**: `npm install groq-sdk`
3. **Modifica codice**: Sostituire OpenAI con Groq nel servizio

## 📋 Cosa Serve per Integrare Gemini

1. **API Key**: Ottieni da https://makersuite.google.com/app/apikey
2. **Pacchetto npm**: `npm install @google/generative-ai`
3. **Modifica codice**: Sostituire OpenAI con Gemini nel servizio

## 💡 Quale Scegliere?

- **Groq**: Se vuoi la soluzione più semplice e veloce (consigliato)
- **Gemini**: Se preferisci Google e hai bisogno di più funzionalità
- **Hugging Face**: Se vuoi più controllo sui modelli
- **Ollama**: Se hai un server dedicato e vuoi privacy totale
