# ⚠️ Analisi Cancellazione Tabelle `centralized_logs` e `audit_logs`

## 📊 Situazione Attuale

### ✅ `centralized_logs` - Scrittura già disabilitata
- `api/services/centralizedLogger.js` - `writeToDatabase()` è **DISABILITATO** se `AXIOM_ENABLED=true` ✅
- I log vengono salvati solo su Axiom ✅

### ❌ `audit_logs` - Scrittura ancora attiva
- `api/services/auditService.js` - **SCRIVE ANCORA** su `audit_logs_compressed` (riga 56) ❌
- I log vengono salvati sia su Neon che su Axiom ❌

---

## 🔍 Riferimenti alle Tabelle nel Codice

### `centralized_logs` - Letture (da modificare):

1. **`api/routes/ministero.js`** (riga 354-485)
   - Endpoint: `GET /api/ministero/logs`
   - Legge da `centralized_logs` per mostrare log di sincronizzazione
   - **Azione**: Modificare per leggere da Axiom o disabilitare

2. **`api/routes/admin/logging.js`**
   - Dashboard admin per visualizzare log
   - Legge da `centralized_logs_decompressed`
   - **Azione**: Modificare per leggere da Axiom

3. **`api/routes/admin/monitoring.js`**
   - Monitoring dashboard
   - Legge da `centralized_logs`
   - **Azione**: Modificare per leggere da Axiom

4. **`api/routes/user/gdpr-rights.js`**
   - Esporta dati utente per GDPR
   - Legge da `centralized_logs_decompressed`
   - **Azione**: Modificare per leggere da Axiom

5. **`api/services/performanceMonitor.js`**
   - Statistiche performance
   - Legge da `centralized_logs`
   - **Azione**: Modificare per leggere da Axiom o disabilitare

6. **`api/services/healthCheckService.js`**
   - Health check
   - Legge da `centralized_logs`
   - **Azione**: Modificare per leggere da Axiom o rimuovere

### `audit_logs` - Scrittura e Letture (da modificare):

1. **`api/services/auditService.js`** (riga 56) ⚠️ **CRITICO**
   - **SCRIVE ANCORA** su `audit_logs_compressed`
   - **Azione**: Disabilitare scrittura su Neon (come fatto per centralized_logs)

2. **`api/routes/admin/audit-dashboard.js`**
   - Dashboard admin per audit logs
   - Legge da `audit_logs`
   - **Azione**: Modificare per leggere da Axiom

3. **`api/routes/admin/security-metrics.js`**
   - Metriche sicurezza
   - Legge da `audit_logs_decompressed`
   - **Azione**: Modificare per leggere da Axiom

4. **`api/routes/user/gdpr-rights.js`** (riga 391)
   - Esporta dati utente per GDPR
   - Legge da `audit_logs`
   - **Azione**: Modificare per leggere da Axiom

5. **`api/routes/user/delete-account.js`** (riga 90)
   - Cancella dati utente quando cancella account
   - Cancella da `audit_logs`
   - **Azione**: Modificare per cancellare da Axiom (se supportato) o rimuovere

6. **`api/services/violationDetectionService.js`**
   - Rileva violazioni GDPR
   - Legge da `audit_logs`
   - **Azione**: Modificare per leggere da Axiom

7. **`api/jobs/auditCleanup.js`**
   - Pulizia automatica audit logs
   - Cancella da `audit_logs`
   - **Azione**: Disabilitare o modificare per cancellare da Axiom

---

## ✅ Modifiche Necessarie Prima della Cancellazione

### Priorità 1 - CRITICO (blocca cancellazione):

1. **Disabilitare scrittura su `audit_logs`**:
   - Modificare `api/services/auditService.js` per non scrivere su Neon se Axiom è abilitato
   - Simile a quanto fatto per `centralized_logs`

### Priorità 2 - IMPORTANTE (funzionalità admin):

2. **Modificare dashboard admin**:
   - `api/routes/admin/audit-dashboard.js` → leggere da Axiom
   - `api/routes/admin/logging.js` → leggere da Axiom
   - `api/routes/admin/monitoring.js` → leggere da Axiom
   - `api/routes/admin/security-metrics.js` → leggere da Axiom

### Priorità 3 - GDPR (diritti utente):

3. **Modificare esportazione dati GDPR**:
   - `api/routes/user/gdpr-rights.js` → leggere da Axiom
   - `api/routes/user/delete-account.js` → cancellare da Axiom (se supportato)

### Priorità 4 - Servizi interni:

4. **Modificare servizi interni**:
   - `api/services/violationDetectionService.js` → leggere da Axiom
   - `api/jobs/auditCleanup.js` → disabilitare o modificare per Axiom
   - `api/routes/ministero.js` → modificare o disabilitare endpoint `/logs`
   - `api/services/performanceMonitor.js` → modificare o disabilitare
   - `api/services/healthCheckService.js` → modificare o rimuovere

---

## 🚨 RACCOMANDAZIONE

**NON cancellare le tabelle ancora!**

Prima di cancellare, devi:
1. ✅ Disabilitare scrittura su `audit_logs` (come fatto per `centralized_logs`)
2. ⏳ Modificare tutti gli endpoint che leggono da queste tabelle per usare Axiom
3. ⏳ Testare che tutto funzioni correttamente
4. ⏳ Verificare che i dati siano stati migrati completamente su Axiom

**Alternativa più sicura**: 
- Mantieni le tabelle ma disabilita la scrittura
- Le tabelle esistenti possono servire come backup storico
- Puoi cancellarle in un secondo momento quando sei sicuro che tutto funziona con Axiom

