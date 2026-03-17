# 📊 Analisi Organizzazione Dataset Axiom

## 🎯 Contesto
- **Limite tier gratuito**: 2 dataset interni
- **Dataset disponibili**: `centralized_logs`, `audit_logs`
- **Dati da organizzare**: 
  - Centralized logs (ERROR/WARN/INFO/DEBUG)
  - Audit logs
  - Performance metrics
  - Security events

---

## 📋 Opzioni di Organizzazione

### **Opzione 1: Per Tipo di Dato**
**Dataset 1: `logs`** (centralized_logs + audit_logs)
- Centralized logs (tutti i livelli)
- Audit logs
- **Volume**: ~321 GB/mese
- **Query tipiche**: 
  - "Errori ultime 24h"
  - "Audit per utente X"
  - "Log per endpoint Y"

**Dataset 2: `monitoring`** (performance + security)
- Performance metrics
- Security events
- **Volume**: ~50 MB/mese
- **Query tipiche**:
  - "CPU usage ultime 24h"
  - "Security events critici"
  - "Performance trends"

**Vantaggi:**
- ✅ Separazione logica chiara
- ✅ Query più veloci (dataset più piccoli)
- ✅ Dashboard dedicate per tipo

**Svantaggi:**
- ⚠️ Dataset `logs` molto grande (321 GB)
- ⚠️ Potrebbe superare limite con crescita

---

### **Opzione 2: Per Criticità**
**Dataset 1: `critical`** (errori + security + performance)
- Centralized logs ERROR/WARN
- Security events
- Performance metrics
- **Volume**: ~10 GB/mese
- **Query tipiche**:
  - "Errori critici"
  - "Security alerts"
  - "Performance degradation"

**Dataset 2: `audit`** (audit logs)
- Audit logs
- **Volume**: ~650 MB/mese
- **Query tipiche**:
  - "Audit per utente"
  - "Conformità GDPR"
  - "Tracciabilità azioni"

**Vantaggi:**
- ✅ Dataset `critical` ottimizzato (solo dati critici)
- ✅ Volume gestibile (10 GB vs 321 GB)
- ✅ Query più veloci su dati critici
- ✅ Audit separato (conformità)

**Svantaggi:**
- ⚠️ Log INFO/DEBUG non su Axiom (ma meno critici)

---

### **Opzione 3: Per Frequenza Accesso**
**Dataset 1: `real-time`** (performance + security + errori)
- Performance metrics (accesso frequente)
- Security events (accesso frequente)
- Centralized logs ERROR/WARN (accesso frequente)
- **Volume**: ~10 GB/mese
- **Query tipiche**:
  - Dashboard real-time
  - Alert monitoring
  - Performance trends

**Dataset 2: `audit`** (audit logs)
- Audit logs (accesso raro)
- **Volume**: ~650 MB/mese
- **Query tipiche**:
  - Audit su richiesta
  - Conformità GDPR
  - Analisi storiche

**Vantaggi:**
- ✅ Dataset `real-time` ottimizzato per dashboard
- ✅ Volume gestibile
- ✅ Separazione per frequenza accesso

**Svantaggi:**
- ⚠️ Log INFO/DEBUG non su Axiom

---

### **Opzione 4: Tutto in `centralized_logs`, Audit separato**
**Dataset 1: `centralized_logs`** (tutto tranne audit)
- Centralized logs (tutti i livelli)
- Performance metrics (con tag `log_type: "performance"`)
- Security events (con tag `log_type: "security"`)
- **Volume**: ~320 GB/mese
- **Query tipiche**:
  - "Errori ultime 24h"
  - "Performance metrics"
  - "Security events"

**Dataset 2: `audit_logs`** (audit)
- Audit logs
- **Volume**: ~650 MB/mese

**Vantaggi:**
- ✅ Tutti i log applicativi in un posto
- ✅ Filtraggio con tag `log_type`
- ✅ Audit separato (conformità)

**Svantaggi:**
- ⚠️ Dataset molto grande (320 GB)
- ⚠️ Query più lente su grandi volumi
- ⚠️ Rischio superare limite

---

### **Opzione 5: Solo Critical su Axiom, resto su Neon**
**Dataset 1: `centralized_logs`** (solo ERROR/WARN + performance + security)
- Centralized logs ERROR/WARN
- Performance metrics
- Security events
- **Volume**: ~10 GB/mese

**Dataset 2: `audit_logs`** (audit)
- Audit logs
- **Volume**: ~650 MB/mese

**Neon Database:**
- Centralized logs INFO/DEBUG
- (Performance metrics e security events possono rimanere su Neon se non servono real-time)

**Vantaggi:**
- ✅ Volume ottimizzato (10 GB)
- ✅ Solo dati critici su Axiom
- ✅ Query veloci
- ✅ Scalabile

**Svantaggi:**
- ⚠️ Log INFO/DEBUG non su Axiom (ma meno critici)

---

## 🏆 RACCOMANDAZIONE FINALE

### **Opzione 5: Solo Critical su Axiom**

**Dataset 1: `centralized_logs`**
- Centralized logs ERROR/WARN (`level: "ERROR"` o `"WARN"`)
- Performance metrics (`log_type: "performance"`)
- Security events (`log_type: "security"`)
- **Volume**: ~10 GB/mese ✅

**Dataset 2: `audit_logs`**
- Audit logs
- **Volume**: ~650 MB/mese ✅

**Neon Database:**
- Centralized logs INFO/DEBUG (meno critici)
- Performance metrics storiche (opzionale)
- Security events storici (opzionale)

---

## 💡 Perché questa organizzazione?

1. ✅ **Volume gestibile**: 10 GB vs 320 GB
2. ✅ **Query veloci**: Dataset più piccoli = query più rapide
3. ✅ **Dati critici real-time**: Errori, performance, security su Axiom
4. ✅ **Scalabilità**: Crescita gestibile
5. ✅ **Costi**: Entro limite gratuito
6. ✅ **Separazione logica**: Critical vs Audit

---

## 🔧 Implementazione

1. **Filtra centralized_logs**: Solo ERROR/WARN → Axiom
2. **Tag per tipo**: `log_type: "performance"` e `log_type: "security"`
3. **Audit separato**: Dataset dedicato per conformità
4. **INFO/DEBUG su Neon**: Meno critici, query più lente accettabili

---

## 📊 Query Esempi Axiom

```aql
// Errori critici
['centralized_logs']
| where level == "ERROR"
| summarize count() by bin(_time, 1h)

// Performance metrics
['centralized_logs']
| where log_type == "performance"
| summarize avg(cpu_usage) by bin(_time, 1h)

// Security events
['centralized_logs']
| where log_type == "security"
| summarize count() by type

// Audit logs
['audit_logs']
| where action == "DATA_ACCESS"
| summarize count() by user_id
```

