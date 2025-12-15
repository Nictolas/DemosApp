# 📊 Migrazione Letture da Neon a Axiom - Progresso

## ✅ Completato

### 1. Utility Helper
- ✅ `api/utils/axiomQueryHelper.js` - Creato helper per query Axiom
  - `getAuditLogs()` - Ottiene audit logs da Axiom
  - `getCentralizedLogs()` - Ottiene centralized logs da Axiom
  - `getSecurityEvents()` - Ottiene security events da Axiom
  - `queryAxiom()` - Query generica APL
  - `countAxiomRecords()` - Conta record

### 2. Audit Dashboard (`api/routes/admin/audit-dashboard.js`)
- ✅ `/stats` - Statistiche generali (ora legge da Axiom)
- ✅ `/logs` - Lista log con filtri (ora legge da Axiom)
- ⏳ `/user/:userId` - Log per utente (usa AuditService.getUserAuditLogs - già modificato)
- ⏳ `/suspicious` - Attività sospette (da modificare)
- ⏳ Altri endpoint (da verificare)

### 3. Audit Service (`api/services/auditService.js`)
- ✅ `getUserAuditLogs()` - Ora legge da Axiom se abilitato
- ✅ `getUserAuditStats()` - Ora legge da Axiom se abilitato
- ✅ `logAction()` - Scrittura disabilitata su Neon (solo Axiom)

---

## ⏳ Da Completare

### Priorità Alta (Funzionalità Critiche):

1. **`api/routes/admin/audit-dashboard.js`**
   - ⏳ `/suspicious` - Attività sospette
   - ⏳ Altri endpoint che leggono da `audit_logs`

2. **`api/routes/admin/security-metrics.js`**
   - ⏳ Tutti gli endpoint leggono da `audit_logs_decompressed`
   - ⏳ Modificare per leggere da Axiom

3. **`api/routes/user/gdpr-rights.js`**
   - ⏳ Esportazione dati GDPR legge da `audit_logs` e `centralized_logs`
   - ⏳ Modificare per leggere da Axiom

4. **`api/routes/user/delete-account.js`**
   - ⏳ Cancella da `audit_logs` quando utente cancella account
   - ⏳ Modificare per cancellare da Axiom (se supportato) o rimuovere

### Priorità Media (Dashboard Admin):

5. **`api/routes/admin/logging.js`**
   - ⏳ Dashboard logging legge da `centralized_logs_decompressed`
   - ⏳ Modificare per leggere da Axiom

6. **`api/routes/admin/monitoring.js`**
   - ⏳ Monitoring legge da `centralized_logs`
   - ⏳ Modificare per leggere da Axiom

7. **`api/routes/ministero.js`**
   - ⏳ Endpoint `/logs` legge da `centralized_logs`
   - ⏳ Modificare per leggere da Axiom o disabilitare

### Priorità Bassa (Servizi Interni):

8. **`api/services/violationDetectionService.js`**
   - ⏳ Rileva violazioni leggendo da `audit_logs`
   - ⏳ Modificare per leggere da Axiom

9. **`api/jobs/auditCleanup.js`**
   - ⏳ Pulizia automatica `audit_logs`
   - ⏳ Disabilitare (non necessario con Axiom)

10. **`api/services/performanceMonitor.js`**
    - ⏳ Statistiche performance legge da `centralized_logs`
    - ⏳ Modificare per leggere da Axiom o disabilitare

11. **`api/services/healthCheckService.js`**
    - ⏳ Health check legge da `centralized_logs`
    - ⏳ Modificare o rimuovere

---

## 📝 Note Importanti

1. **Fallback a Neon**: Tutti i metodi modificati hanno un fallback a Neon se `AXIOM_ENABLED !== 'true'`
2. **Compatibilità**: I formati di risposta sono mantenuti compatibili con il frontend esistente
3. **Performance**: Le query Axiom possono essere più lente per dataset grandi - considerare caching se necessario
4. **Paginazione**: Axiom non supporta `offset` direttamente - implementato lato server

---

## 🚀 Prossimi Passi

1. Continuare con gli endpoint ad alta priorità
2. Testare che tutto funzioni correttamente
3. Verificare che il frontend non si rompa
4. Dopo test completi, cancellare le tabelle su Neon

