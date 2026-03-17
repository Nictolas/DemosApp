# 🔧 Istruzioni: Variabili d'Ambiente GDPR

## ✅ Variabile da Inserire

**Formato esatto:**
```env
GDPR_LOGGING_FILTER=true
```

## 📍 Dove Inserirla

### 1. **Render (Produzione)** ✅ OBBLIGATORIO

**Procedura:**
1. Vai su [Render Dashboard](https://dashboard.render.com)
2. Seleziona il tuo servizio backend
3. Vai su **Environment** (nel menu laterale)
4. Clicca su **Add Environment Variable**
5. Inserisci:
   - **Key**: `GDPR_LOGGING_FILTER`
   - **Value**: `true`
6. Clicca **Save Changes**
7. Render farà automaticamente il **redeploy**

**⚠️ IMPORTANTE**: Dopo aver aggiunto la variabile, Render farà automaticamente un redeploy. Verifica che il deploy sia completato.

### 2. **Locale (Sviluppo)** ✅ OPZIONALE (ma consigliato)

**Procedura:**
1. Apri il file `.env` nella root del progetto
2. Aggiungi questa riga:
   ```env
   GDPR_LOGGING_FILTER=true
   ```
3. Salva il file
4. Riavvia il server locale

**Nota**: Se non hai un file `.env`, copia `env.example` e rinominalo in `.env`:
```bash
cp env.example .env
```

## 📋 Variabili Opzionali

Se vuoi essere ancora più restrittivo, puoi aggiungere anche:

```env
# Modalità strict: logga SOLO endpoint GDPR-required
GDPR_LOGGING_STRICT=false
```

**Spiegazione:**
- `GDPR_LOGGING_STRICT=false` (default): Logga anche endpoint incerti (più sicuro)
- `GDPR_LOGGING_STRICT=true`: Logga SOLO endpoint esplicitamente GDPR-required (più restrittivo)

## ✅ Verifica

Dopo il deploy su Render, verifica che:

1. ✅ Il deploy sia completato con successo
2. ✅ I nuovi log su Axiom contengano solo 6 campi GDPR obbligatori
3. ✅ Il numero di log sia diminuito (circa 60-80% in meno)
4. ✅ Solo endpoint GDPR-required vengano loggati

## 🔍 Come Verificare che Funziona

1. **Controlla i log su Axiom:**
   - Vai su Axiom Dashboard → Stream → `centralized_logs`
   - Verifica che i nuovi log abbiano solo questi campi:
     - `_time`
     - `message`
     - `user_id`
     - `ip_address`
     - `endpoint`
     - `session_id`

2. **Verifica che endpoint pubblici non vengano loggati:**
   - Fai una richiesta a `/api/health`
   - Verifica che NON appaia nei log su Axiom

3. **Verifica che endpoint GDPR vengano loggati:**
   - Fai login o accedi a `/api/users/profile`
   - Verifica che appaia nei log su Axiom

## 📝 Riepilogo

| Ambiente | File/Luogo | Obbligatorio? |
|----------|------------|---------------|
| **Render** | Environment Variables nel Dashboard | ✅ **SÌ** |
| **Locale** | File `.env` nella root | ⚠️ Opzionale (consigliato) |

## ⚠️ Nota Importante

- **Formato**: Deve essere esattamente `GDPR_LOGGING_FILTER=true` (senza spazi, senza virgolette)
- **Case-sensitive**: La chiave è in maiuscolo
- **Valore**: Solo `true` o `false` (stringa, non booleano)

