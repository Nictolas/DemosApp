# 🔒 Attivazione Filtro GDPR per Centralized Logs

## ✅ Modifiche Completate

1. **Rimosso `request_id`** dai log inviati ad Axiom (non necessario per GDPR)
2. **Aggiunto filtro GDPR** che logga solo richieste necessarie per conformità

## 📋 Cosa Fare Ora

### Opzione 1: Cancellare e Ricreare Dataset (CONSIGLIATO)

**Perché:**
- I 1.180 record attuali sono solo di oggi (log real-time)
- Contengono `request_id` (non GDPR-compliant)
- Alcuni potrebbero essere endpoint non GDPR-required
- Parti con un dataset pulito e GDPR-compliant

**Procedura:**
1. Vai su Axiom Dashboard → Datasets
2. Cancella il dataset `centralized_logs`
3. Ricrea il dataset `centralized_logs` (vuoto)
4. Attiva le variabili d'ambiente (vedi sotto)
5. I nuovi log saranno già filtrati e GDPR-compliant

### Opzione 2: Lasciare Dataset Così

**Se preferisci:**
- Mantenere i log di oggi per debugging
- Lasciare i log vecchi (non GDPR-compliant) nel dataset

**Procedura:**
1. Attiva solo le variabili d'ambiente (vedi sotto)
2. I nuovi log saranno filtrati, ma i vecchi rimangono

## 🔧 Variabili d'Ambiente da Aggiungere

Aggiungi queste variabili al tuo `.env` o alle variabili d'ambiente su Render:

```env
# Attiva il filtro GDPR (solo log necessari per GDPR)
GDPR_LOGGING_FILTER=true

# Modalità strict: logga SOLO endpoint GDPR-required (più restrittivo)
# Se false: logga anche endpoint incerti (default, più sicuro)
GDPR_LOGGING_STRICT=false
```

## 📊 Risultato Atteso

**Prima (senza filtro):**
- ~1.180 log/giorno
- Tutte le richieste HTTP loggate
- Include `request_id` (non GDPR)

**Dopo (con filtro):**
- ~200-400 log/giorno (60-80% in meno)
- Solo richieste GDPR-required loggate
- Senza `request_id`
- Solo endpoint che accedono a dati personali

## 🎯 Endpoint che Vengono Loggati (GDPR-Required)

✅ **Sempre loggati:**
- Errori (statusCode >= 400)
- `/api/users` - Dati utenti
- `/api/auth` - Autenticazione
- `/api/opinioni` - Opinion personali
- `/api/voti` - Voti personali
- `/api/comunicazioni` - Comunicazioni personali
- `/api/notifiche` - Notifiche personali
- `/api/admin` - Accesso admin
- `/api/gdpr` - Richieste GDPR
- Metodi POST/PUT/PATCH/DELETE (modifiche dati)

❌ **NON loggati (se filtro attivo):**
- `/api/health` - Health check
- `/api/ministero/iniziative` - Dati pubblici
- `/api/governo/ministri` - Dati pubblici
- `/api/statistiche` - Statistiche aggregate
- Altri endpoint pubblici senza dati personali

## ⚠️ Nota Importante

Dopo aver attivato il filtro, **devi fare il deploy** su Render per applicare le modifiche.

## 🔍 Verifica

Dopo il deploy, verifica che:
1. I nuovi log su Axiom non contengono `request_id`
2. I log sono solo per endpoint GDPR-required
3. Il numero di log è diminuito significativamente

