# 🧹 Istruzioni per Pulizia Dataset Real-Time

## 📋 Obiettivo

Pulire il dataset `real-time` su Axiom per mantenere solo i campi GDPR-obbligatori:
- ✅ Audit logs (9 campi GDPR-obbligatori)
- ✅ Security events (7 campi GDPR-obbligatori)
- ❌ Performance metrics (disabilitati - non GDPR-required)

---

## 🔧 Modifiche Codice Completate

✅ **Codice già modificato** per inviare solo campi GDPR-obbligatori:
- `api/services/auditService.js` - Audit logs puliti
- `api/middleware/securityMonitoring.js` - Security events puliti
- `api/services/performanceMonitor.js` - Performance metrics disabilitati

---

## 📝 Procedura

### Opzione 1: Cancellare e Ricreare Manualmente (Consigliato)

1. **Cancella il dataset su Axiom Dashboard:**
   - Vai su https://app.axiom.co
   - Seleziona il dataset `real-time`
   - Clicca "Delete Dataset"
   - Conferma la cancellazione

2. **Ricrea il dataset:**
   - Clicca "Create Dataset"
   - Nome: `real-time`
   - Descrizione: "Real-time logs GDPR-compliant (audit + security only)"

3. **Verifica:**
   - I nuovi log inviati conterranno solo campi GDPR-obbligatori
   - Le performance metrics non verranno più inviate

### Opzione 2: Usare lo Script di Pulizia

⚠️ **ATTENZIONE**: Lo script estrae tutti i record, li pulisce e li re-ingesta. 
Questo può richiedere molto tempo per dataset grandi.

```bash
# Esegui lo script di pulizia
node scripts/clean-realtime-gdpr.js
```

Lo script:
1. Estrae tutti i record dal dataset `real-time`
2. Filtra solo audit e security logs (esclude performance)
3. Pulisce i campi non GDPR-obbligatori
4. Cancella il dataset originale
5. Ricrea il dataset
6. Re-ingesta i record puliti

---

## ✅ Verifica Post-Pulizia

1. **Verifica campi nel dataset:**
   - Vai su Axiom Dashboard → Dataset `real-time` → Fields
   - Dovresti vedere solo:
     - Audit logs: `_time`, `user_id`, `ip_address`, `action`, `resource`, `resource_id`, `success`, `error_message`, `session_id`
     - Security events: `_time`, `user_id`, `ip_address`, `type`, `severity`, `details`, `session_id`

2. **Verifica che performance metrics non vengano più inviate:**
   - Controlla i log dell'applicazione
   - Non dovrebbero esserci più log di tipo `performance`

3. **Verifica nuovi log:**
   - Genera alcuni audit logs e security events
   - Verifica su Axiom che contengano solo campi GDPR-obbligatori

---

## 📊 Campi GDPR-Obbligatori

### Audit Logs (9 campi):
- `_time` - Quando è successo
- `user_id` - Chi ha fatto l'azione
- `ip_address` - Da dove (anonimizzato)
- `action` - Cosa è stato fatto
- `resource` - Su quale risorsa
- `resource_id` - ID specifico risorsa
- `success` - Se l'azione è riuscita
- `error_message` - Dettagli errore
- `session_id` - Identifica la sessione utente

### Security Events (7 campi):
- `_time` - Quando è successo
- `user_id` - Chi (se disponibile)
- `ip_address` - Da dove (anonimizzato)
- `type` - Tipo evento sicurezza
- `severity` - Gravità evento
- `details` - Dettagli evento (solo essenziali)
- `session_id` - Identifica la sessione utente

---

## ⚠️ Note Importanti

1. **Performance Metrics**: Non vengono più inviati ad Axiom (non GDPR-required)
2. **Campi Rimossi**: `log_type`, `type` (duplicato), `user_agent`, `user_email`, `details.*` nested fields
3. **Session ID**: Generato automaticamente se non disponibile (stesso approccio di `centralized_logs`)
4. **Anonymization**: Se `AXIOM_ANONYMIZE=true`, IP viene anonimizzato automaticamente

---

## 🚀 Deploy

Dopo aver pulito il dataset, fai il deploy delle modifiche:

```bash
# Commit delle modifiche
git add .
git commit -m "feat: GDPR compliance per dataset real-time"

# Push e deploy su Render
git push origin main
```

Render eseguirà automaticamente il deploy e i nuovi log inviati conterranno solo campi GDPR-obbligatori.

