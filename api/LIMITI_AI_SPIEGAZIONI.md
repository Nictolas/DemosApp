# Limiti e Protezioni per le Spiegazioni AI

## 🆓 Soluzione Gratuita: Groq API

**Raccomandato**: Usa Groq API che è completamente gratuita!

- ✅ Nessun costo
- ✅ Nessun limite di costo giornaliero
- ✅ Molto veloce
- ✅ Facile da configurare

Vedi `CONFIGURAZIONE_GROQ.md` per la configurazione.

---

## ⚠️ Limitazioni e Costi (Solo se usi OpenAI)

### Limitazioni OpenAI API

L'API di OpenAI ha diversi limiti che possono influenzare l'uso:

1. **Rate Limiting**: 
   - Tier gratuito: ~3 richieste/minuto
   - Tier a pagamento: varia in base al piano (es. 500-5000 richieste/minuto)
   - Se superi il limite, ricevi errore 429 (Too Many Requests)

2. **Costi**:
   - `gpt-4o-mini`: ~$0.00015 per 1K token input, ~$0.0006 per 1K token output
   - Ogni spiegazione: ~$0.0001-0.0002
   - **100 spiegazioni**: ~$0.01-0.02
   - **1000 spiegazioni**: ~$0.10-0.20
   - **10000 spiegazioni**: ~$1-2

3. **Quota mensile**: Dipende dal piano OpenAI scelto

### Protezioni Implementate

#### 1. Limite Giornaliero (Configurabile)

**Variabile d'ambiente**: `OPENAI_DAILY_LIMIT` (default: 50 spiegazioni/giorno)

```env
OPENAI_DAILY_LIMIT=50  # Massimo 50 spiegazioni al giorno
```

Questo limite previene:
- Costi eccessivi
- Rate limiting di OpenAI
- Abuso da parte di admin

#### 2. Cache Intelligente

- Le spiegazioni **non vengono rigenerate** se già esistenti
- Evita chiamate duplicate all'API
- Risparmia costi e tempo

#### 3. Rate Limiting API

Gli endpoint per generare spiegazioni sono protetti da:
- Autenticazione obbligatoria
- Solo admin possono generare manualmente
- Rate limiting generale dell'applicazione (200 richieste/15min per admin)

#### 4. Generazione Automatica Limitata

Durante la sincronizzazione:
- Le spiegazioni vengono generate solo se mancanti
- Non vengono rigenerate se già presenti
- Il processo non si blocca se la generazione fallisce

#### 5. Limite per Batch

Quando si generano spiegazioni in batch:
- Massimo **50 spiegazioni per richiesta**
- Verifica del limite giornaliero prima di avviare
- Generazione in background per non bloccare l'API

## 📊 Monitoraggio

### Verifica Limite Giornaliero

```javascript
const { verificaLimiteGiornaliero } = require('./services/aiExplanationService');
const limite = await verificaLimiteGiornaliero();

console.log(`Spiegazioni generate oggi: ${limite.count}/${limite.limite}`);
console.log(`Rimanenti: ${limite.limite - limite.count}`);
```

### Endpoint per Verificare Limite

Puoi aggiungere un endpoint GET per verificare il limite:

```javascript
// GET /api/voti-camera/limite-spiegazioni
router.get('/limite-spiegazioni', verifyToken, async (req, res) => {
  const { verificaLimiteGiornaliero } = require('../services/aiExplanationService');
  const limite = await verificaLimiteGiornaliero();
  
  return res.json({
    success: true,
    limite
  });
});
```

## 💰 Stima Costi Mensili

### Scenario Conservativo
- **50 spiegazioni/giorno** × 30 giorni = **1,500 spiegazioni/mese**
- Costo: ~$0.15-0.30/mese

### Scenario Moderato
- **100 spiegazioni/giorno** × 30 giorni = **3,000 spiegazioni/mese**
- Costo: ~$0.30-0.60/mese

### Scenario Aggressivo
- **200 spiegazioni/giorno** × 30 giorni = **6,000 spiegazioni/mese**
- Costo: ~$0.60-1.20/mese

## 🔧 Configurazione Consigliata

### Per Sviluppo/Test
```env
OPENAI_DAILY_LIMIT=10
OPENAI_MODEL=gpt-4o-mini
```

### Per Produzione Piccola
```env
OPENAI_DAILY_LIMIT=50
OPENAI_MODEL=gpt-4o-mini
```

### Per Produzione Media
```env
OPENAI_DAILY_LIMIT=100
OPENAI_MODEL=gpt-4o-mini
```

### Per Produzione Grande
```env
OPENAI_DAILY_LIMIT=200
OPENAI_MODEL=gpt-4o-mini
```

## 🚨 Gestione Errori

### Rate Limiting OpenAI
Se OpenAI restituisce errore 429:
- L'errore viene loggato
- La generazione viene saltata
- Il processo continua senza bloccare l'app

### Limite Giornaliero Raggiunto
- Gli endpoint restituiscono errore 429
- Messaggio chiaro all'utente
- Possibilità di verificare il limite rimanente

### API Key Non Configurata
- Le spiegazioni non vengono generate
- Nessun errore bloccante
- L'app continua a funzionare normalmente

## 📝 Best Practices

1. **Monitora i costi**: Controlla regolarmente l'uso su OpenAI Dashboard
2. **Imposta limiti conservativi**: Inizia con limiti bassi e aumenta se necessario
3. **Usa cache**: Non rigenerare spiegazioni esistenti
4. **Genera in batch**: Usa la generazione batch invece di singole richieste
5. **Monitora errori**: Controlla i log per errori di rate limiting

## 🔄 Reset Limite Giornaliero

Il limite si resetta automaticamente ogni giorno alle 00:00 UTC.

Per resettare manualmente (solo per test):
```sql
-- NON RACCOMANDATO IN PRODUZIONE
-- Resetta tutte le spiegazioni generate oggi
UPDATE voti_camera 
SET spiegazione = NULL 
WHERE ultimo_aggiornamento >= CURRENT_DATE;
```

## ⚡ Performance

- **Tempo per spiegazione**: ~1-3 secondi
- **Generazione batch**: ~1 secondo per spiegazione (con pausa di 1 secondo tra richieste)
- **Non blocca l'API**: Tutte le generazioni avvengono in background

## 🛡️ Sicurezza

- Solo admin possono generare spiegazioni manualmente
- Autenticazione obbligatoria per tutti gli endpoint
- Rate limiting per prevenire abusi
- Validazione input per prevenire injection
