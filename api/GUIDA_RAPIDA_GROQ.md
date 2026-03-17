# 🚀 Guida Rapida: Configurazione Groq API

## ✅ Configurazione Base Completata

Il file `.env` è già configurato con:
- `GROQ_API_KEY=gsk_...` (placeholder)
- `GROQ_MODEL=llama-3.3-70b-versatile`

## 📋 Passi per Completare la Configurazione

### 1. Ottieni la Chiave API Groq (2 minuti)

1. **Vai su**: https://console.groq.com
2. **Clicca** su "Sign Up" o "Sign In"
   - Puoi usare Google, GitHub o email
3. **Dopo il login**, vai su: https://console.groq.com/keys
4. **Clicca** su "Create API Key"
5. **Dai un nome** alla chiave (es. "DemosApp")
6. **Copia la chiave** (inizia con `gsk_...` e ha ~50 caratteri)

### 2. Aggiungi la Chiave al File .env

1. **Apri il file**: `C:\Users\Nicolas\Nuova cartella\DemosApp-1\api\.env`
2. **Trova la riga**: `GROQ_API_KEY=gsk_...`
3. **Sostituisci** `gsk_...` con la tua chiave API reale
4. **Salva** il file

Esempio:
```env
GROQ_API_KEY=gsk_tua_chiave_api_qui_50_caratteri_1234567890
```

### 3. Verifica la Configurazione

Esegui:
```bash
node verifica-configurazione-groq.js
```

Dovresti vedere:
```
✅ GROQ_API_KEY configurata
✅ Connessione Groq funziona!
✅ Groq è configurato e funzionante!
```

### 4. Riavvia il Server

Se il server è avviato, riavvialo:
```bash
npm start
# oppure
node server.js
```

Dovresti vedere nel log:
```
✅ Groq AI configurato per analisi leggi (gratuito)
```

## 🎯 Cosa Succede Dopo la Configurazione

Una volta configurato Groq:

1. **Le analisi delle leggi verranno generate automaticamente** quando:
   - Un utente apre il dialog "Dettagli" di una votazione
   - Non c'è ancora un'analisi in cache per quella votazione

2. **Verranno generate 3 cose**:
   - ✅ **Spiegazione Generale** (300 parole)
   - ✅ **Effetti Positivi** (elenco puntato)
   - ✅ **Effetti Negativi** (elenco puntato)

3. **Le analisi vengono salvate in cache** nella tabella `parlamento_analisi_legge`
   - La prima volta richiede ~2-3 secondi
   - Le volte successive sono istantanee (cache)

## 🔧 Troubleshooting

### Errore: "Invalid API Key"
- Verifica che la chiave sia corretta nel file `.env`
- Assicurati di aver copiato tutta la chiave (è lunga ~50 caratteri)
- Verifica che la chiave inizi con `gsk_`
- Controlla su https://console.groq.com/keys che la chiave sia attiva

### Errore: "GROQ_API_KEY non configurata"
- Verifica che il file `.env` esista nella directory `api/`
- Verifica che la riga `GROQ_API_KEY=...` sia presente
- Riavvia il server dopo aver modificato il file `.env`

### Le analisi non vengono generate
- Controlla i log del server per errori
- Verifica che Groq sia configurato correttamente: `node verifica-configurazione-groq.js`
- Assicurati che la votazione abbia un titolo valido

## 📚 Link Utili

- **Console Groq**: https://console.groq.com
- **Chiavi API**: https://console.groq.com/keys
- **Documentazione**: https://console.groq.com/docs
- **Modelli disponibili**: https://console.groq.com/docs/models

## ✅ Checklist

- [ ] Account Groq creato
- [ ] Chiave API creata e copiata
- [ ] Chiave aggiunta al file `.env`
- [ ] Configurazione verificata con `node verifica-configurazione-groq.js`
- [ ] Server riavviato
- [ ] Log mostra "✅ Groq AI configurato"

---

**Nota**: Groq è completamente gratuito, quindi puoi generare quante analisi vuoi senza limiti di costo! 🎉
