# 📊 Analisi Tabelle Non Necessarie per GDPR

## ✅ Tabelle su Neon che NON servono per GDPR

### 1. **`performance_metrics`** ❌ NON GDPR
- **Cosa contiene**: Metriche tecniche (CPU, memoria, database, event loop delay, uptime)
- **GDPR**: ❌ **NON NECESSARIA** (solo tecnico, non riguarda dati personali)
- **Stato**: 
  - ✅ Scrittura su Axiom **DISABILITATA** (non vengono più inviati)
  - ⚠️ Potrebbe ancora esistere su Neon (da verificare)
- **Azione**: Può essere cancellata da Neon se esiste

### 2. **`health_checks`** ❌ NON GDPR
- **Cosa contiene**: Controlli di salute del sistema (status, checks JSONB, summary JSONB)
- **GDPR**: ❌ **NON NECESSARIA** (solo tecnico, non riguarda dati personali)
- **Stato**: 
  - ⚠️ Potrebbe ancora esistere su Neon (da verificare)
  - Non viene inviata ad Axiom
- **Azione**: Può essere cancellata da Neon se esiste

### 3. **`centralized_logs`** ⚠️ Già migrata su Axiom
- **Cosa contiene**: Log applicativi centralizzati (errori, warning, info, debug)
- **GDPR**: ⚠️ **PARZIALMENTE NECESSARIA** (alcuni log possono contenere dati personali)
- **Stato**: 
  - ✅ Scrittura su Neon **DISABILITATA** (se `AXIOM_ENABLED=true`)
  - ✅ Dati migrati su Axiom nel dataset `centralized_logs`
  - ⚠️ Potrebbe ancora esistere su Neon con dati storici
- **Azione**: Può essere cancellata da Neon dopo verifica migrazione completa

### 4. **`audit_logs`** / **`audit_logs_compressed`** ⚠️ Già migrata su Axiom
- **Cosa contiene**: Log di audit per conformità (azioni utente, accessi dati)
- **GDPR**: ✅ **NECESSARIA** (Articolo 30 GDPR - Registro attività trattamento)
- **Stato**: 
  - ✅ Scrittura su Neon **DISABILITATA** (se `AXIOM_ENABLED=true`)
  - ✅ Dati migrati su Axiom nel dataset `real-time` (come Audit Logs)
  - ⚠️ Potrebbe ancora esistere su Neon con dati storici
- **Azione**: Può essere cancellata da Neon dopo verifica migrazione completa

### 5. **`security_events`** ✅ Già migrata su Axiom
- **Cosa contiene**: Eventi di sicurezza e tentativi di accesso sospetti
- **GDPR**: ✅ **NECESSARIA** (Articolo 32 GDPR - Sicurezza del trattamento)
- **Stato**: 
  - ✅ Scrittura su Neon **DISABILITATA** (se `AXIOM_ENABLED=true`)
  - ✅ Dati migrati su Axiom nel dataset `real-time` (come Security Events)
  - ✅ Tabella già cancellata da Neon (verificato)
- **Azione**: ✅ Completata

### 6. **`access_audit`** ✅ Già migrata su Axiom
- **Cosa contiene**: Audit di tutti gli accessi e operazioni utente
- **GDPR**: ⚠️ **PARZIALMENTE NECESSARIA** (alcuni dati possono essere utili)
- **Stato**: 
  - ✅ Non viene più utilizzata (sostituita da AuditService)
  - ✅ Dati gestiti tramite AuditService che scrive su Axiom
  - ✅ Tabella già cancellata da Neon (verificato)
- **Azione**: ✅ Completata

---

## 📋 Tabelle su Axiom che NON servono per GDPR

### 1. **Performance Metrics nel dataset `real-time`** ❌ NON GDPR
- **Stato**: ✅ **DISABILITATO** - Non vengono più inviati ad Axiom
- **Azione**: Se ci sono dati storici, possono essere rimossi dal dataset `real-time`

---

## 🎯 Riepilogo Tabelle da Verificare/Cancellare

### Su Neon (da verificare esistenza):
1. ✅ `security_events` - **GIÀ CANCELLATA**
2. ✅ `access_audit` - **GIÀ CANCELLATA**
3. ⏳ `performance_metrics` - **DA VERIFICARE** (non GDPR)
4. ⏳ `health_checks` - **DA VERIFICARE** (non GDPR)
5. ⏳ `centralized_logs` - **DA VERIFICARE** (già migrata su Axiom)
6. ⏳ `audit_logs` / `audit_logs_compressed` - **DA VERIFICARE** (già migrata su Axiom)
7. ⏳ `centralized_logs_compressed` - **DA VERIFICARE** (se esiste, già migrata)
8. ⏳ `centralized_logs_decompressed` - **DA VERIFICARE** (VIEW, se esiste)
9. ⏳ `audit_logs_decompressed` - **DA VERIFICARE** (VIEW, se esiste)

### Su Axiom:
1. ⏳ Performance Metrics nel dataset `real-time` - **DA VERIFICARE** (dati storici, non GDPR)

---

## 📝 Query SQL per Verificare Esistenza

```sql
-- Verifica quali tabelle di logging esistono su Neon
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size('public.' || table_name)) as dimensione,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name AND table_schema = 'public') as colonne
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'performance_metrics',
    'health_checks',
    'centralized_logs',
    'centralized_logs_compressed',
    'centralized_logs_decompressed',
    'audit_logs',
    'audit_logs_compressed',
    'audit_logs_decompressed',
    'security_events',
    'access_audit'
  )
ORDER BY table_name;
```

---

## ⚠️ Note Importanti

1. **Prima di cancellare qualsiasi tabella**:
   - Verifica che i dati siano stati migrati completamente su Axiom
   - Verifica che la scrittura su Neon sia disabilitata (`AXIOM_ENABLED=true`)
   - Esegui un backup se necessario

2. **Performance Metrics e Health Checks**:
   - Non sono necessarie per GDPR
   - Possono essere utili per monitoring interno
   - Se non vengono più utilizzate, possono essere cancellate

3. **Centralized Logs e Audit Logs**:
   - Contengono dati che possono essere necessari per GDPR
   - Ma sono già migrati su Axiom
   - Possono essere cancellate da Neon dopo verifica migrazione completa

