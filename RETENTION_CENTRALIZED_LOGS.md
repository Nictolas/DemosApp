# 📋 Retention Policy per Centralized_Logs

## ❓ Domanda: I Centralized_Logs anche per 6 mesi?

### **❌ NO, dipende dal livello del log!**

I `centralized_logs` hanno **retention diverse** in base al **livello** (ERROR, WARN, INFO, DEBUG, TRACE).

---

## 📊 Retention Policy per Livello

### **Policy Implementata nel Tuo Progetto**

```javascript
// Da cleanup-centralized-logs.cjs
const RETENTION_POLICIES = {
  ERROR: {
    retention_days: 730,  // 2 anni
    reason: 'Errori critici - Sicurezza e debugging'
  },
  WARN: {
    retention_days: 365,  // 1 anno
    reason: 'Warning - Monitoraggio sistema'
  },
  INFO: {
    retention_days: 180,  // 6 mesi ✅
    reason: 'Informazioni generali - Audit trail'
  },
  DEBUG: {
    retention_days: 30,   // 30 giorni
    reason: 'Debug - Solo per sviluppo'
  },
  TRACE: {
    retention_days: 7,    // 7 giorni
    reason: 'Trace - Debugging dettagliato'
  }
};
```

---

## 📋 Tabella Retention Centralized_Logs

| Livello | Retention | Motivo | GDPR Compliant |
|---------|-----------|--------|----------------|
| **ERROR** | **2 anni (730 giorni)** | Errori critici, sicurezza, debugging | ✅ |
| **WARN** | **1 anno (365 giorni)** | Warning, monitoraggio sistema | ✅ |
| **INFO** | **6 mesi (180 giorni)** | Informazioni generali, audit trail | ✅ Minimo legale |
| **DEBUG** | **30 giorni** | Solo sviluppo | ✅ |
| **TRACE** | **7 giorni** | Debugging dettagliato | ✅ |

---

## 🎯 Perché Retention Diverse?

### **ERROR (2 anni)**
- ✅ **Errori critici** devono essere conservati più a lungo
- ✅ **Sicurezza**: Per analisi pattern di attacchi
- ✅ **Debugging**: Per risolvere problemi complessi
- ✅ **Conformità**: Dimostrare sicurezza del trattamento

### **WARN (1 anno)**
- ✅ **Monitoraggio**: Tendenze e pattern nel tempo
- ✅ **Analisi**: Identificare problemi ricorrenti
- ✅ **Sicurezza**: Warning possono indicare tentativi di attacco

### **INFO (6 mesi)**
- ✅ **Minimo legale**: Provvedimento Garante 2008
- ✅ **Audit trail**: Tracciabilità operazioni base
- ✅ **Analisi**: Statistiche e trend

### **DEBUG (30 giorni)**
- ✅ **Sviluppo**: Solo per debugging
- ✅ **Non critico**: Non necessario per produzione
- ✅ **GDPR**: Riduzione dati personali

### **TRACE (7 giorni)**
- ✅ **Sviluppo**: Debugging molto dettagliato
- ✅ **Non critico**: Solo per sviluppo
- ✅ **GDPR**: Riduzione dati personali

---

## 📊 Strategia di Archiviazione

### **Database Attivo (Hot Storage)**

**Mantieni nel database solo dati recenti:**

| Livello | Database | Cloud | Totale |
|---------|----------|-------|--------|
| **ERROR** | 30 giorni | 2 anni | 2 anni |
| **WARN** | 30 giorni | 1 anno | 1 anno |
| **INFO** | 14 giorni | 6 mesi | 6 mesi |
| **DEBUG** | 7 giorni | 30 giorni | 30 giorni |
| **TRACE** | 7 giorni | 7 giorni | 7 giorni |

### **Esempio Pratico: INFO Logs (6 mesi)**

```
Giorno 1-14:
  └─ Database: Log attivi (query veloci)

Giorno 15-180 (6 mesi):
  └─ Cloud: Archivio (anonimizzato, compresso)

Dopo 180 giorni:
  └─ Eliminazione automatica
```

### **Esempio Pratico: ERROR Logs (2 anni)**

```
Giorno 1-30:
  └─ Database: Log attivi (query veloci)

Giorno 31-730 (2 anni):
  └─ Cloud: Archivio (anonimizzato, compresso)

Dopo 730 giorni:
  └─ Eliminazione automatica
```

---

## ⚖️ Conformità GDPR

### **✅ Requisiti Legali**

1. **Provvedimento Garante 2008**: 
   - ✅ **6 mesi minimo** per log di sicurezza
   - ✅ INFO: 6 mesi ✅
   - ✅ ERROR/WARN: 2-1 anni (oltre minimo) ✅

2. **GDPR Art. 5(1)(e)**:
   - ✅ Conservazione limitata al necessario
   - ✅ ERROR/WARN: Conservati più a lungo per sicurezza ✅
   - ✅ DEBUG/TRACE: Conservati meno per privacy ✅

3. **GDPR Art. 32**:
   - ✅ Log di sicurezza essenziali per conformità
   - ✅ ERROR/WARN: Dimostrano sicurezza del trattamento ✅

---

## 💾 Implementazione

### **Pulizia Automatica**

```bash
# Esegui pulizia con retention per livello
node cleanup-centralized-logs.cjs
```

**Cosa fa:**
- ✅ Elimina ERROR oltre 2 anni
- ✅ Elimina WARN oltre 1 anno
- ✅ Elimina INFO oltre 6 mesi
- ✅ Elimina DEBUG oltre 30 giorni
- ✅ Elimina TRACE oltre 7 giorni

### **Archiviazione Automatica**

```javascript
// Strategy implementata
const ARCHIVE_STRATEGY = {
  centralized_logs: {
    active: 14,      // 2 settimane in database
    archive: 60,     // 2 mesi in archivio (per INFO)
    // ERROR/WARN archiviati più a lungo
  }
};
```

---

## 📋 Risposta Diretta

### **❓ I Centralized_Logs anche per 6 mesi?**

**DIPENDE dal livello:**

- ✅ **INFO**: Sì, **6 mesi** (minimo legale)
- ✅ **ERROR**: No, **2 anni** (sicurezza)
- ✅ **WARN**: No, **1 anno** (monitoraggio)
- ✅ **DEBUG**: No, **30 giorni** (sviluppo)
- ✅ **TRACE**: No, **7 giorni** (sviluppo)

**In pratica:**
- Solo i log **INFO** hanno retention di 6 mesi
- I log **ERROR** e **WARN** vengono conservati più a lungo (1-2 anni) per sicurezza
- I log **DEBUG** e **TRACE** vengono conservati meno (7-30 giorni) per privacy

---

## 🎯 Raccomandazione

**Per il tuo caso:**

1. **Database Neon**: Mantieni solo 14-30 giorni (costi minimi)
2. **Backblaze B2**: Archivio per periodo completo (ERROR: 2 anni, WARN: 1 anno, INFO: 6 mesi)
3. **Eliminazione**: Automatica dopo periodo di retention

**Conclusione:**
- ✅ **INFO**: 6 mesi (minimo legale) ✅
- ✅ **ERROR/WARN**: 1-2 anni (sicurezza) ✅
- ✅ **DEBUG/TRACE**: 7-30 giorni (sviluppo) ✅

---

**🎉 Retention policy differenziata per livello = GDPR compliant + Ottimizzazione costi!**

